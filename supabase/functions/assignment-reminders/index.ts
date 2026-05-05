import { createClient } from "https://esm.sh/@supabase/supabase-js@2.45.0";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: corsHeaders });

  const supabase = createClient(
    Deno.env.get("SUPABASE_URL")!,
    Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!,
  );

  const now = new Date();
  const windows = [
    { days: 3, label: "in 3 days" },
    { days: 1, label: "tomorrow" },
  ];

  let inserted = 0;
  for (const w of windows) {
    const center = new Date(now.getTime() + w.days * 24 * 60 * 60 * 1000);
    const lo = new Date(center.getTime() - 60 * 60 * 1000); // ±1h window for hourly cron
    const hi = new Date(center.getTime() + 60 * 60 * 1000);

    const { data: assignments } = await supabase
      .from("assignments")
      .select("id, title, class_id, due_date, classes(name)")
      .gte("due_date", lo.toISOString())
      .lte("due_date", hi.toISOString());

    for (const a of assignments ?? []) {
      const { data: members } = await supabase
        .from("class_members").select("student_id").eq("class_id", a.class_id);
      const studentIds = (members ?? []).map((m: any) => m.student_id);
      if (studentIds.length === 0) continue;

      const { data: subs } = await supabase
        .from("submissions").select("student_id").eq("assignment_id", a.id).in("student_id", studentIds);
      const submitted = new Set((subs ?? []).map((s: any) => s.student_id));
      const link = `/student/assignments/${a.id}`;
      const className = (a as any).classes?.name ?? "your class";

      for (const sid of studentIds) {
        if (submitted.has(sid)) continue;
        // dedup: skip if same notification exists within last 12h
        const since = new Date(Date.now() - 12 * 60 * 60 * 1000).toISOString();
        const { data: existing } = await supabase
          .from("notifications").select("id")
          .eq("user_id", sid).eq("link", link)
          .ilike("message", `%${w.label}%`)
          .gte("created_at", since).limit(1);
        if (existing && existing.length > 0) continue;

        const message = `"${a.title}" (${className}) is due ${w.label}`;
        await supabase.from("notifications").insert({
          user_id: sid, type: "assignment", message, link,
        });
        inserted++;
      }
    }
  }

  return new Response(JSON.stringify({ ok: true, inserted }), {
    headers: { ...corsHeaders, "Content-Type": "application/json" },
  });
});