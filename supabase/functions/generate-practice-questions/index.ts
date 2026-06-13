import { createClient } from "https://esm.sh/@supabase/supabase-js@2.49.4";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

const GEMINI_API_KEY = Deno.env.get("GEMINI_API_KEY") ?? Deno.env.get("gemini_api_key");
const SUPABASE_URL = Deno.env.get("SUPABASE_URL");
const SUPABASE_ANON_KEY = Deno.env.get("SUPABASE_ANON_KEY");

function json(obj: unknown, status = 200) {
  return new Response(JSON.stringify(obj), {
    status,
    headers: { ...corsHeaders, "Content-Type": "application/json" },
  });
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: corsHeaders });

  try {
    if (!GEMINI_API_KEY || !SUPABASE_URL || !SUPABASE_ANON_KEY) {
      return json({ error: "AI question generation is not configured yet" }, 500);
    }

    const authHeader = req.headers.get("Authorization");
    if (!authHeader) return json({ error: "Unauthorized" }, 401);

    const userClient = createClient(SUPABASE_URL, SUPABASE_ANON_KEY, {
      global: { headers: { Authorization: authHeader } },
    });
    const { data: userData, error: userErr } = await userClient.auth.getUser();
    if (userErr || !userData.user) return json({ error: "Unauthorized" }, 401);
    const user = userData.user;

    const body = await req.json().catch(() => ({}));
    const classId = String(body.classId ?? "").trim();
    const topic = String(body.topic ?? "").trim().slice(0, 400);
    const count = Math.max(1, Math.min(10, Number(body.count) || 5));
    const difficulty = ["easy", "medium", "hard"].includes(body.difficulty) ? body.difficulty : "medium";
    const grade = body.grade ? String(body.grade).slice(0, 40) : "";

    if (!classId || !topic) return json({ error: "classId and topic are required" }, 400);

    // The caller must be the teacher who owns this class (RLS-scoped read).
    const { data: cls } = await userClient
      .from("classes").select("id, name, subject, teacher_id").eq("id", classId).maybeSingle();
    if (!cls || cls.teacher_id !== user.id) {
      return json({ error: "You don't teach this class" }, 403);
    }

    const systemPrompt =
      `You are an expert ${cls.subject} teacher writing practice questions for the class "${cls.name}" (${cls.subject}).\n` +
      `Generate exactly ${count} ${difficulty}-difficulty multiple-choice questions about: "${topic}".` +
      (grade ? ` Target grade level: ${grade}.` : "") + `\n` +
      `Rules:\n` +
      `- Each question has exactly 4 answer options.\n` +
      `- Exactly one option is correct; "correctIndex" is its 0-based position (0–3).\n` +
      `- Options must be plausible, mutually exclusive, and concise. No "all of the above".\n` +
      `- Keep prompts clear and grade-appropriate. Do not reference images.`;

    const responseSchema = {
      type: "OBJECT",
      properties: {
        questions: {
          type: "ARRAY",
          items: {
            type: "OBJECT",
            properties: {
              prompt: { type: "STRING" },
              options: { type: "ARRAY", items: { type: "STRING" } },
              correctIndex: { type: "INTEGER" },
            },
            required: ["prompt", "options", "correctIndex"],
          },
        },
      },
      required: ["questions"],
    };

    const geminiUrl =
      `https://generativelanguage.googleapis.com/v1beta/models/gemini-2.5-flash:generateContent?key=${GEMINI_API_KEY}`;
    const resp = await fetch(geminiUrl, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        systemInstruction: { parts: [{ text: systemPrompt }] },
        contents: [{ role: "user", parts: [{ text: `Generate the ${count} questions now.` }] }],
        generationConfig: {
          temperature: 0.8,
          maxOutputTokens: 2048,
          responseMimeType: "application/json",
          responseSchema,
        },
      }),
    });

    if (!resp.ok) {
      const errText = await resp.text();
      console.error("Gemini error:", resp.status, errText);
      return json({ error: "AI request failed", detail: errText.slice(0, 300) }, 502);
    }

    const data = await resp.json();
    const rawText: string =
      data?.candidates?.[0]?.content?.parts?.map((p: any) => p.text).filter(Boolean).join("") || "{}";

    let parsed: any = {};
    try {
      parsed = JSON.parse(rawText);
    } catch {
      return json({ error: "AI returned malformed output" }, 502);
    }

    const questions = (Array.isArray(parsed.questions) ? parsed.questions : [])
      .map((q: any) => ({
        prompt: String(q?.prompt ?? "").trim(),
        options: Array.isArray(q?.options) ? q.options.map((o: any) => String(o).trim()).filter(Boolean).slice(0, 4) : [],
        correctIndex: Number(q?.correctIndex),
      }))
      .filter((q: any) => q.prompt && q.options.length === 4 && q.correctIndex >= 0 && q.correctIndex <= 3)
      .slice(0, count);

    return json({ questions });
  } catch (e) {
    console.error("generate-practice-questions fatal:", e);
    return json({ error: e instanceof Error ? e.message : "Unknown error" }, 500);
  }
});
