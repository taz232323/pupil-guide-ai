import { createClient } from "https://esm.sh/@supabase/supabase-js@2.45.0";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: corsHeaders });

  try {
    const authHeader = req.headers.get("Authorization") || "";
    const supabase = createClient(
      Deno.env.get("SUPABASE_URL")!,
      Deno.env.get("SUPABASE_ANON_KEY")!,
      { global: { headers: { Authorization: authHeader } } },
    );
    const admin = createClient(
      Deno.env.get("SUPABASE_URL")!,
      Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!,
    );

    const { data: userData } = await supabase.auth.getUser();
    const user = userData?.user;
    if (!user) return json({ error: "Unauthorized" }, 401);

    const body = await req.json().catch(() => ({}));
    const classId: string = body.classId;
    const batchSize: number = Math.min(Math.max(Number(body.batchSize) || 5, 1), 10);
    if (!classId) return json({ error: "classId required" }, 400);

    // Verify class & enrollment & enabled
    const { data: cls, error: clsErr } = await admin
      .from("classes")
      .select("id, name, subject, syllabus, daily_practice_enabled")
      .eq("id", classId)
      .maybeSingle();
    if (clsErr || !cls) return json({ error: "Class not found" }, 404);
    if (!cls.daily_practice_enabled) return json({ error: "Daily practice is not enabled for this class" }, 400);

    const { data: membership } = await admin
      .from("class_members")
      .select("id")
      .eq("class_id", classId)
      .eq("student_id", user.id)
      .maybeSingle();
    if (!membership) return json({ error: "Not enrolled in this class" }, 403);

    // Gather context: assignments + module items titles
    const { data: assignments } = await admin
      .from("assignments")
      .select("title, description, unit_tag")
      .eq("class_id", classId)
      .order("created_at", { ascending: false })
      .limit(20);
    const { data: modules } = await admin
      .from("modules")
      .select("id, title, description")
      .eq("class_id", classId);
    const moduleIds = (modules || []).map((m: any) => m.id);
    let items: any[] = [];
    if (moduleIds.length) {
      const { data: mi } = await admin
        .from("module_items")
        .select("title, module_id, item_type")
        .in("module_id", moduleIds)
        .limit(40);
      items = mi || [];
    }

    // Get or create today's session
    const today = new Date().toISOString().slice(0, 10);
    let { data: session } = await admin
      .from("daily_practice_sessions")
      .select("*")
      .eq("student_id", user.id)
      .eq("class_id", classId)
      .eq("practice_date", today)
      .maybeSingle();
    if (!session) {
      const { data: created, error: cErr } = await admin
        .from("daily_practice_sessions")
        .insert({ student_id: user.id, class_id: classId, practice_date: today })
        .select()
        .single();
      if (cErr) return json({ error: cErr.message }, 500);
      session = created;
    }
    if (session.status === "submitted") {
      return json({ error: "Today's session already submitted" }, 400);
    }

    // Existing answers count for position
    const { count: existingCount } = await admin
      .from("daily_practice_answers")
      .select("id", { count: "exact", head: true })
      .eq("session_id", session.id);
    const startPos = existingCount || 0;

    // Build context for Gemini
    const context = {
      class: { name: cls.name, subject: cls.subject, syllabus: cls.syllabus || "" },
      units: Array.from(new Set((assignments || []).map((a: any) => a.unit_tag).filter(Boolean))),
      assignments: (assignments || []).map((a: any) => a.title),
      modules: (modules || []).map((m: any) => m.title),
      module_items: items.map((m: any) => m.title),
    };

    const apiKey = Deno.env.get("GEMINI_API_KEY");
    if (!apiKey) return json({ error: "GEMINI_API_KEY not configured" }, 500);

    const prompt = `You are creating a short daily practice quiz for a student in the class "${cls.name}" (${cls.subject}).
Use the following class context to ground your questions in topics the student has actually studied:
${JSON.stringify(context, null, 2)}

Generate exactly ${batchSize} practice questions. Mix multiple_choice and short_answer roughly 50/50.
Return ONLY valid JSON matching this schema, no prose, no markdown:
{
  "questions": [
    {
      "type": "multiple_choice",
      "prompt": "...",
      "options": ["A","B","C","D"],
      "correct_index": 0
    },
    {
      "type": "short_answer",
      "prompt": "...",
      "expected_answer": "concise model answer"
    }
  ]
}`;

    const geminiResp = await fetch(
      `https://generativelanguage.googleapis.com/v1beta/models/gemini-2.0-flash:generateContent?key=${apiKey}`,
      {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          contents: [{ role: "user", parts: [{ text: prompt }] }],
          generationConfig: { temperature: 0.7, responseMimeType: "application/json" },
        }),
      },
    );
    if (!geminiResp.ok) {
      const t = await geminiResp.text();
      console.error("Gemini error:", geminiResp.status, t);
      return json({ error: "Failed to generate questions" }, 500);
    }
    const gj = await geminiResp.json();
    const text = gj?.candidates?.[0]?.content?.parts?.[0]?.text || "{}";
    let parsed: any;
    try { parsed = JSON.parse(text); } catch { parsed = { questions: [] }; }
    const qs = Array.isArray(parsed.questions) ? parsed.questions : [];
    if (qs.length === 0) return json({ error: "No questions generated" }, 500);

    const rows = qs.map((q: any, i: number) => {
      const isMc = q.type === "multiple_choice" && Array.isArray(q.options);
      return {
        session_id: session.id,
        student_id: user.id,
        position: startPos + i,
        question_type: isMc ? "multiple_choice" : "short_answer",
        prompt: String(q.prompt || ""),
        options: isMc ? q.options : null,
        correct_index: isMc && Number.isInteger(q.correct_index) ? q.correct_index : null,
        expected_answer: !isMc ? String(q.expected_answer || "") : null,
      };
    });

    const { data: inserted, error: insErr } = await admin
      .from("daily_practice_answers")
      .insert(rows)
      .select();
    if (insErr) return json({ error: insErr.message }, 500);

    return json({ session, questions: inserted });
  } catch (e) {
    console.error(e);
    return json({ error: e instanceof Error ? e.message : "Unknown error" }, 500);
  }

  function json(b: unknown, status = 200) {
    return new Response(JSON.stringify(b), {
      status,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});