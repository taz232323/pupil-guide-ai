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

    // Gather comprehensive context: assignments, modules, lesson content, existing questions
    const { data: assignments } = await admin
      .from("assignments")
      .select("id, title, description, unit_tag")
      .eq("class_id", classId)
      .order("created_at", { ascending: false })
      .limit(20);
    
    // Get existing assignment questions for context
    const assignmentIds = (assignments || []).map((a: any) => a.id);
    let existingQuestions: any[] = [];
    if (assignmentIds.length) {
      const { data: aq } = await admin
        .from("assignment_questions")
        .select("prompt, question_type, options")
        .in("assignment_id", assignmentIds)
        .limit(30);
      existingQuestions = aq || [];
    }
    
    const { data: modules } = await admin
      .from("modules")
      .select("id, title, description")
      .eq("class_id", classId);
    const moduleIds = (modules || []).map((m: any) => m.id);
    let items: any[] = [];
    if (moduleIds.length) {
      const { data: mi } = await admin
        .from("module_items")
        .select("title, module_id, item_type, content_html")
        .in("module_id", moduleIds)
        .limit(40);
      items = mi || [];
    }
    
    // Get teacher-submitted practice questions from the question bank
    const { data: teacherQuestions } = await admin
      .from("practice_question_bank")
      .select("id, question_type, prompt, options, correct_index, expected_answer")
      .eq("class_id", classId);

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

    // Helper to strip HTML tags for cleaner context
    const stripHtml = (html: string) => html?.replace(/<[^>]*>/g, ' ').replace(/\s+/g, ' ').trim() || '';
    
    // Build comprehensive context for Gemini
    const context = {
      class: { name: cls.name, subject: cls.subject, syllabus: cls.syllabus || "" },
      units: Array.from(new Set((assignments || []).map((a: any) => a.unit_tag).filter(Boolean))),
      assignments: (assignments || []).map((a: any) => ({
        title: a.title,
        description: a.description || "",
        unit: a.unit_tag || "",
      })),
      modules: (modules || []).map((m: any) => ({
        title: m.title,
        description: m.description || "",
      })),
      lesson_content: items
        .filter((m: any) => m.content_html)
        .map((m: any) => ({
          title: m.title,
          content: stripHtml(m.content_html).slice(0, 1000), // Limit content length
        })),
      existing_questions: existingQuestions.slice(0, 15).map((q: any) => ({
        prompt: q.prompt,
        type: q.question_type,
      })),
    };

    // Determine how many teacher questions to use vs AI-generated
    const availableTeacherQs = teacherQuestions || [];
    const teacherQsToUse = availableTeacherQs.slice(0, batchSize);
    const aiQsNeeded = Math.max(0, batchSize - teacherQsToUse.length);

    const apiKey = Deno.env.get("LOVABLE_API_KEY");

    let aiQuestions: any[] = [];
    
    // Only call AI if we need more questions
    if (aiQsNeeded > 0) {
      const prompt = `You are creating a daily practice quiz for a student in the class "${cls.name}" (${cls.subject}).

IMPORTANT: Generate questions ONLY about topics from the actual class content provided below. Do NOT create generic questions.

CLASS CONTENT:
${JSON.stringify(context, null, 2)}

Based on the modules, lessons, and assignments above, generate exactly ${aiQsNeeded} practice questions that test the student on what they have actually been learning.

Guidelines:
- Questions should directly relate to the lesson content, module topics, or assignment material
- Mix multiple_choice and short_answer roughly 50/50
- For multiple choice, provide 4 plausible options
- Make questions specific to the content, not generic

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

      if (!apiKey) {
        console.warn("LOVABLE_API_KEY is missing. Returning deterministic daily-practice fallback.");
        aiQuestions = buildFallbackQuestions(context, aiQsNeeded);
      } else {
        const aiResp = await fetch("https://ai.gateway.lovable.dev/v1/chat/completions", {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
            Authorization: `Bearer ${apiKey}`,
          },
          body: JSON.stringify({
            model: "google/gemini-2.5-flash",
            messages: [
              { role: "system", content: "You generate practice quizzes based on actual class content. Always return valid JSON only. Questions must be specific to the provided lesson material." },
              { role: "user", content: prompt },
            ],
            response_format: { type: "json_object" },
          }),
        });
        if (!aiResp.ok) {
          const t = await aiResp.text();
          console.error("AI gateway error:", aiResp.status, t);
          aiQuestions = buildFallbackQuestions(context, aiQsNeeded);
        } else {
          const gj = await aiResp.json();
          const text = gj?.choices?.[0]?.message?.content || "{}";
          let parsed: any;
          try { parsed = JSON.parse(text); } catch { parsed = { questions: [] }; }
          aiQuestions = Array.isArray(parsed.questions) ? parsed.questions : [];
        }
      }
    }

    if (aiQuestions.length < aiQsNeeded) {
      aiQuestions = [
        ...aiQuestions,
        ...buildFallbackQuestions(context, aiQsNeeded - aiQuestions.length, aiQuestions.length),
      ];
    }

    // Combine teacher questions first, then AI questions
    const allQuestions = [
      ...teacherQsToUse.map((q: any) => ({
        type: q.question_type,
        prompt: q.prompt,
        options: q.options,
        correct_index: q.correct_index,
        expected_answer: q.expected_answer,
        is_teacher_question: true,
      })),
      ...aiQuestions,
    ];

    if (allQuestions.length === 0) return json({ error: "No questions available" }, 500);

    const rows = allQuestions.map((q: any, i: number) => {
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

function buildFallbackQuestions(context: any, count: number, offset = 0) {
  const className = clean(context?.class?.name) || "this class";
  const subject = clean(context?.class?.subject) || "the subject";
  const assignments = Array.isArray(context?.assignments) ? context.assignments : [];
  const modules = Array.isArray(context?.modules) ? context.modules : [];
  const lessonContent = Array.isArray(context?.lesson_content) ? context.lesson_content : [];

  const topicPool = [
    ...assignments.map((item: any) => ({
      kind: "assignment",
      title: clean(item.title),
      detail: clean(item.description || item.unit),
    })),
    ...modules.map((item: any) => ({
      kind: "module",
      title: clean(item.title),
      detail: clean(item.description),
    })),
    ...lessonContent.map((item: any) => ({
      kind: "lesson",
      title: clean(item.title),
      detail: clean(item.content),
    })),
  ].filter((item) => item.title || item.detail);

  const baseTopics = topicPool.length
    ? topicPool
    : [{ kind: "class", title: className, detail: subject }];

  const templates = [
    (topic: any) => ({
      type: "short_answer",
      prompt: `In one or two sentences, explain the main idea of ${topic.title || subject}.`,
      expected_answer: `A good answer should name the main idea and connect it to ${subject}.`,
    }),
    (topic: any) => ({
      type: "multiple_choice",
      prompt: `Which choice best describes what ${topic.title || className} is about?`,
      options: [
        topic.detail ? shorten(topic.detail, 90) : `A key topic in ${subject}`,
        "A completely unrelated topic",
        "Only a classroom rule",
        "A random detail with no connection to the lesson",
      ],
      correct_index: 0,
    }),
    (topic: any) => ({
      type: "short_answer",
      prompt: `What is one detail from ${topic.title || className} that a student should remember?`,
      expected_answer: topic.detail || `One important detail should connect back to ${subject}.`,
    }),
    (topic: any) => ({
      type: "multiple_choice",
      prompt: `If you were reviewing ${topic.title || subject}, what should you focus on first?`,
      options: [
        "The central idea and evidence from the lesson",
        "The color of the page",
        "A topic from a different class",
        "Only the due date",
      ],
      correct_index: 0,
    }),
    (topic: any) => ({
      type: "short_answer",
      prompt: `How does ${topic.title || "today's topic"} connect to what you are learning in ${className}?`,
      expected_answer: `A good answer should explain a clear connection to the class content.`,
    }),
  ];

  return Array.from({ length: count }, (_, index) => {
    const topic = baseTopics[(index + offset) % baseTopics.length];
    const template = templates[(index + offset) % templates.length];
    return template(topic);
  });
}

function clean(value: unknown) {
  return String(value ?? "").replace(/\s+/g, " ").trim();
}

function shorten(value: string, maxLength: number) {
  const cleanValue = clean(value);
  return cleanValue.length <= maxLength ? cleanValue : `${cleanValue.slice(0, maxLength - 1).trim()}…`;
}
