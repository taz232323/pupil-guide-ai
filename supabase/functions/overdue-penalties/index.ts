// Daily scheduled function: penalize students for overdue, unsubmitted assignments.
// Penalty per assignment = days_overdue (1 on day 1, 2 on day 2, ...).
// Total deduction per student per day capped at 5, allocated to most-overdue first.
// Never takes balance below 0. Logs each deduction to coin_transactions.

import { createClient } from "https://esm.sh/@supabase/supabase-js@2.45.0";

const corsHeaders = {
  "Access-Control-Allow-Origin": Deno.env.get("APP_ORIGIN") ?? "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type, x-cron-secret",
};

const DAILY_CAP = 5;

function isAuthorizedCronRequest(req: Request) {
  const configuredSecret = Deno.env.get("CRON_SECRET");
  if (configuredSecret) {
    return req.headers.get("x-cron-secret") === configuredSecret;
  }

  const serviceRoleKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY");
  const authHeader = req.headers.get("Authorization") || "";
  return !!serviceRoleKey && authHeader === `Bearer ${serviceRoleKey}`;
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }
  if (!isAuthorizedCronRequest(req)) {
    return json({ error: "Unauthorized" }, 401);
  }

  const supabase = createClient(
    Deno.env.get("SUPABASE_URL")!,
    Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!,
  );

  try {
    const now = new Date();
    const nowIso = now.toISOString();

    // 1. Find all overdue assignments (has a due_date in the past).
    const { data: overdueAsgns, error: aErr } = await supabase
      .from("assignments")
      .select("id, title, due_date, class_id")
      .lt("due_date", nowIso)
      .not("due_date", "is", null);
    if (aErr) throw aErr;

    if (!overdueAsgns || overdueAsgns.length === 0) {
      return json({ ok: true, processed: 0, students_penalized: 0 });
    }

    const asgnIds = overdueAsgns.map((a) => a.id);
    const classIds = Array.from(new Set(overdueAsgns.map((a) => a.class_id)));

    // 2. Fetch class memberships for affected classes.
    const { data: members, error: mErr } = await supabase
      .from("class_members")
      .select("class_id, student_id")
      .in("class_id", classIds);
    if (mErr) throw mErr;

    // 3. Fetch all submissions for these assignments.
    const { data: subs, error: sErr } = await supabase
      .from("submissions")
      .select("assignment_id, student_id")
      .in("assignment_id", asgnIds);
    if (sErr) throw sErr;

    // 4. Fetch submitted statuses (in case status was set without a submission row).
    const { data: statuses, error: stErr } = await supabase
      .from("assignment_status_records")
      .select("assignment_id, student_id, status")
      .in("assignment_id", asgnIds)
      .eq("status", "submitted");
    if (stErr) throw stErr;

    const submittedSet = new Set<string>();
    for (const s of subs ?? []) submittedSet.add(`${s.assignment_id}:${s.student_id}`);
    for (const s of statuses ?? []) submittedSet.add(`${s.assignment_id}:${s.student_id}`);

    // Index assignments by class.
    const byClass = new Map<string, typeof overdueAsgns>();
    for (const a of overdueAsgns) {
      const arr = byClass.get(a.class_id) ?? [];
      arr.push(a);
      byClass.set(a.class_id, arr);
    }

    // 5. Build per-student list of overdue assignments with days_overdue.
    type Owe = { assignment_id: string; title: string; days: number };
    const byStudent = new Map<string, Owe[]>();
    for (const m of members ?? []) {
      const asgns = byClass.get(m.class_id) ?? [];
      for (const a of asgns) {
        if (submittedSet.has(`${a.id}:${m.student_id}`)) continue;
        const days = Math.max(
          1,
          Math.floor(
            (now.getTime() - new Date(a.due_date as string).getTime()) /
              86_400_000,
          ),
        );
        const arr = byStudent.get(m.student_id) ?? [];
        arr.push({ assignment_id: a.id, title: a.title, days });
        byStudent.set(m.student_id, arr);
      }
    }

    if (byStudent.size === 0) {
      return json({ ok: true, processed: 0, students_penalized: 0 });
    }

    // 6. Fetch current balances.
    const studentIds = Array.from(byStudent.keys());
    const { data: coins, error: cErr } = await supabase
      .from("student_coins")
      .select("student_id, star_coins")
      .in("student_id", studentIds);
    if (cErr) throw cErr;
    const balanceMap = new Map<string, number>();
    for (const c of coins ?? []) balanceMap.set(c.student_id, c.star_coins);

    let totalPenalized = 0;
    let studentsPenalized = 0;

    // 7. Process each student.
    for (const [studentId, owes] of byStudent) {
      const balance = balanceMap.get(studentId) ?? 0;
      if (balance <= 0) continue;

      // Sort: most overdue first (largest days first).
      owes.sort((a, b) => b.days - a.days);

      // Allocate up to DAILY_CAP, taking each assignment's `days` amount,
      // but trimming the last one if needed to stay under the cap.
      let remainingCap = DAILY_CAP;
      const deductions: { owe: Owe; amount: number }[] = [];
      for (const owe of owes) {
        if (remainingCap <= 0) break;
        const take = Math.min(owe.days, remainingCap);
        deductions.push({ owe, amount: take });
        remainingCap -= take;
      }

      // Apply, never going below 0. Trim from the back if balance is low.
      let totalToDeduct = deductions.reduce((s, d) => s + d.amount, 0);
      if (totalToDeduct > balance) {
        // Trim from least-overdue (end) down.
        let excess = totalToDeduct - balance;
        for (let i = deductions.length - 1; i >= 0 && excess > 0; i--) {
          const trim = Math.min(deductions[i].amount, excess);
          deductions[i].amount -= trim;
          excess -= trim;
        }
        // Remove zero-amount entries.
        for (let i = deductions.length - 1; i >= 0; i--) {
          if (deductions[i].amount <= 0) deductions.splice(i, 1);
        }
        totalToDeduct = deductions.reduce((s, d) => s + d.amount, 0);
      }

      if (totalToDeduct <= 0) continue;

      // Update balance.
      const newBalance = balance - totalToDeduct;
      const { error: uErr } = await supabase
        .from("student_coins")
        .update({ star_coins: newBalance, updated_at: nowIso })
        .eq("student_id", studentId);
      if (uErr) {
        console.error("balance update failed", studentId, uErr);
        continue;
      }

      // Log each deduction.
      const txRows = deductions.map((d) => ({
        student_id: studentId,
        amount: -d.amount,
        currency: "star",
        reason: "overdue_penalty",
        assignment_id: d.owe.assignment_id,
        note: `Overdue: "${d.owe.title}" (${d.owe.days} day${
          d.owe.days === 1 ? "" : "s"
        } late) — -${d.amount} ⭐`,
      }));
      const { error: txErr } = await supabase
        .from("coin_transactions")
        .insert(txRows);
      if (txErr) console.error("tx log failed", studentId, txErr);

      totalPenalized += totalToDeduct;
      studentsPenalized += 1;
    }

    return json({
      ok: true,
      students_penalized: studentsPenalized,
      total_coins_deducted: totalPenalized,
      ran_at: nowIso,
    });
  } catch (e) {
    console.error("overdue-penalties error", e);
    return json({ error: String(e?.message ?? e) }, 500);
  }
});

function json(body: unknown, status = 200) {
  return new Response(JSON.stringify(body), {
    status,
    headers: { ...corsHeaders, "Content-Type": "application/json" },
  });
}
