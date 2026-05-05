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
  // Reminder windows: 3 days before and 24 hours before. Hourly cron, ±30min slack.
  const windows = [
    { kind: "3d", hoursAhead: 72, label: "in 3 days" },
    { kind: "1d", hoursAhead: 24, label: "in 24 hours" },
  ];

  let inserted = 0;
  for (const w of windows) {
    const center = new Date(now.getTime() + w.hoursAhead * 60 * 60 * 1000);
    const lo = new Date(center.getTime() - 30 * 60 * 1000);
    const hi = new Date(center.getTime() + 30 * 60 * 1000);

    const { data: assignments } = await supabase
      .from("assignments")
      .select("id, title, class_id, due_date, reminders_enabled, classes(name)")
      .eq("reminders_enabled", true)
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

      const { data: profs } = await supabase
        .from("profiles").select("id, inapp_reminders_enabled").in("id", studentIds);
      const inappOk = new Map<string, boolean>();
      (profs ?? []).forEach((p: any) => inappOk.set(p.id, p.inapp_reminders_enabled !== false));

      const { data: alreadySent } = await supabase
        .from("assignment_reminder_log")
        .select("student_id")
        .eq("assignment_id", a.id).eq("kind", w.kind).eq("channel", "inapp");
      const sentSet = new Set((alreadySent ?? []).map((r: any) => r.student_id));

      const link = `/student/assignments/${a.id}`;
      const className = (a as any).classes?.name ?? "your class";

      for (const sid of studentIds) {
        if (submitted.has(sid)) continue;
        if (sentSet.has(sid)) continue;
        if (inappOk.get(sid) === false) continue;

        const message = `"${a.title}" (${className}) is due ${w.label}`;
        const { error: notifErr } = await supabase.from("notifications").insert({
          user_id: sid, type: "assignment_reminder", message, link,
        });
        if (notifErr) continue;
        await supabase.from("assignment_reminder_log").insert({
          assignment_id: a.id, student_id: sid, kind: w.kind, channel: "inapp",
        });
        inserted++;
      }
    }
  }

  return new Response(JSON.stringify({ ok: true, inserted }), {
    headers: { ...corsHeaders, "Content-Type": "application/json" },
  });
});