import { createClient } from "https://esm.sh/@supabase/supabase-js@2.45.0";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

const MIN_QUESTIONS = 5;
const BASE_COINS = 5;
const BONUS_PER_EXTRA = 1;
const MILESTONES: Record<number, number> = { 3: 5, 7: 10, 30: 25 };

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: corsHeaders });

  function json(b: unknown, status = 200) {
    return new Response(JSON.stringify(b), {
      status,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }

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

    const { sessionId } = await req.json();
    if (!sessionId) return json({ error: "sessionId required" }, 400);

    const { data: session, error: sErr } = await admin
      .from("daily_practice_sessions")
      .select("*")
      .eq("id", sessionId)
      .eq("student_id", user.id)
      .maybeSingle();
    if (sErr || !session) return json({ error: "Session not found" }, 404);
    if (session.status === "submitted") return json({ error: "Already submitted" }, 400);

    const { data: answers } = await admin
      .from("daily_practice_answers")
      .select("*")
      .eq("session_id", sessionId)
      .order("position", { ascending: true });

    const answeredRows = (answers || []).filter(
      (a: any) => a.selected_index !== null || (a.text_response && a.text_response.trim().length > 0),
    );
    const answered = answeredRows.length;
    if (answered < MIN_QUESTIONS) {
      return json({ error: `Answer at least ${MIN_QUESTIONS} questions to submit` }, 400);
    }

    // Grade short answers via Gemini if any are ungraded
    const ungradedShort = answeredRows.filter(
      (a: any) => a.question_type === "short_answer" && a.is_correct === null,
    );
    if (ungradedShort.length) {
      const apiKey = Deno.env.get("GEMINI_API_KEY");
      if (apiKey) {
        const prompt = `Grade these short-answer questions. Return ONLY JSON: {"results":[{"id":"...","is_correct":true|false}]}.
Mark a response correct if it captures the key idea of the expected answer (allow reasonable wording differences).

${JSON.stringify(
  ungradedShort.map((a: any) => ({
    id: a.id,
    prompt: a.prompt,
    expected: a.expected_answer,
    response: a.text_response,
  })),
  null,
  2,
)}`;
        try {
          const r = await fetch(
            `https://generativelanguage.googleapis.com/v1beta/models/gemini-2.0-flash:generateContent?key=${apiKey}`,
            {
              method: "POST",
              headers: { "Content-Type": "application/json" },
              body: JSON.stringify({
                contents: [{ role: "user", parts: [{ text: prompt }] }],
                generationConfig: { temperature: 0, responseMimeType: "application/json" },
              }),
            },
          );
          if (r.ok) {
            const gj = await r.json();
            const text = gj?.candidates?.[0]?.content?.parts?.[0]?.text || "{}";
            const parsed = JSON.parse(text);
            const results: any[] = parsed.results || [];
            for (const res of results) {
              await admin
                .from("daily_practice_answers")
                .update({ is_correct: !!res.is_correct })
                .eq("id", res.id);
            }
          }
        } catch (e) {
          console.error("grading error", e);
        }
      }
    }

    // Re-fetch with updated grades
    const { data: finalAnswers } = await admin
      .from("daily_practice_answers")
      .select("*")
      .eq("session_id", sessionId);
    const finalAnswered = (finalAnswers || []).filter(
      (a: any) => a.selected_index !== null || (a.text_response && a.text_response.trim().length > 0),
    );
    const correct = finalAnswered.filter((a: any) => a.is_correct === true).length;
    const extras = Math.max(0, finalAnswered.length - MIN_QUESTIONS);
    const bonusCoins = extras * BONUS_PER_EXTRA;
    const baseCoins = BASE_COINS;

    // Streak update
    const today = session.practice_date as string;
    const todayDate = new Date(today + "T00:00:00Z");
    const yesterday = new Date(todayDate);
    yesterday.setUTCDate(todayDate.getUTCDate() - 1);
    const yStr = yesterday.toISOString().slice(0, 10);
    let autoAppliedShields = 0;

    const { data: autoApplyResult, error: autoApplyError } = await supabase.rpc("auto_apply_streak_shields", {
      _class_id: session.class_id,
    });
    if (autoApplyError) {
      console.warn("auto_apply_streak_shields failed:", autoApplyError.message);
    } else {
      autoAppliedShields = Number((autoApplyResult as any)?.shieldsConsumed ?? 0);
    }

    const { data: streak } = await admin
      .from("daily_practice_streaks")
      .select("*")
      .eq("student_id", user.id)
      .eq("class_id", session.class_id)
      .maybeSingle();

    let current = 1;
    let longest = 1;
    let milestonesAwarded: number[] = [];
    let shieldsConsumed = autoAppliedShields;
    if (streak) {
      milestonesAwarded = Array.isArray(streak.milestones_awarded) ? [...streak.milestones_awarded] : [];
      if (streak.last_practice_date === today) {
        current = streak.current_streak;
      } else if (streak.last_practice_date === yStr) {
        current = streak.current_streak + 1;
      } else {
        // Try to bridge the gap with active streak shields for the missing days
        const last = streak.last_practice_date
          ? new Date(streak.last_practice_date + "T00:00:00Z")
          : null;
        const missingDates: string[] = [];
        if (last) {
          const cursor = new Date(last);
          cursor.setUTCDate(cursor.getUTCDate() + 1);
          while (cursor < todayDate) {
            missingDates.push(cursor.toISOString().slice(0, 10));
            cursor.setUTCDate(cursor.getUTCDate() + 1);
          }
        }
        if (missingDates.length > 0) {
          const { data: shields } = await admin
            .from("streak_freeze_activations")
            .select("id, shield_date")
            .eq("student_id", user.id)
            .eq("class_id", session.class_id)
            .eq("consumed", false)
            .in("shield_date", missingDates);
          const covered = new Set((shields ?? []).map((s: any) => s.shield_date));
          const allCovered = missingDates.every((d) => covered.has(d));
          if (allCovered && shields && shields.length > 0) {
            await admin
              .from("streak_freeze_activations")
              .update({ consumed: true, consumed_at: new Date().toISOString() })
              .in("id", shields.map((s: any) => s.id));
            shieldsConsumed += shields.length;
            current = streak.current_streak + missingDates.length + 1;
          } else {
            current = 1;
          }
        } else {
          current = 1;
        }
      }
      longest = Math.max(streak.longest_streak || 0, current);
    }

    let milestoneBonus = 0;
    let milestoneHit: number | null = null;
    for (const days of Object.keys(MILESTONES).map(Number).sort((a, b) => a - b)) {
      if (current >= days && !milestonesAwarded.includes(days)) {
        milestoneBonus += MILESTONES[days];
        milestonesAwarded.push(days);
        milestoneHit = days;
      }
    }

    const totalCoins = baseCoins + bonusCoins + milestoneBonus;

    // Award coins
    await admin.rpc("reload_schema_cache").catch(() => {});
    const { data: existingCoins } = await admin
      .from("student_coins")
      .select("star_coins")
      .eq("student_id", user.id)
      .maybeSingle();
    if (existingCoins) {
      await admin
        .from("student_coins")
        .update({ star_coins: (existingCoins.star_coins || 0) + totalCoins, updated_at: new Date().toISOString() })
        .eq("student_id", user.id);
    } else {
      await admin.from("student_coins").insert({ student_id: user.id, star_coins: totalCoins });
    }

    // Update session
    await admin
      .from("daily_practice_sessions")
      .update({
        status: "submitted",
        total_answered: finalAnswered.length,
        total_correct: correct,
        coins_awarded: baseCoins,
        bonus_coins_awarded: bonusCoins + milestoneBonus,
        submitted_at: new Date().toISOString(),
      })
      .eq("id", sessionId);

    // Upsert streak
    if (streak) {
      await admin
        .from("daily_practice_streaks")
        .update({
          current_streak: current,
          longest_streak: longest,
          last_practice_date: today,
          milestones_awarded: milestonesAwarded,
          updated_at: new Date().toISOString(),
        })
        .eq("id", streak.id);
    } else {
      await admin.from("daily_practice_streaks").insert({
        student_id: user.id,
        class_id: session.class_id,
        current_streak: current,
        longest_streak: longest,
        last_practice_date: today,
        milestones_awarded: milestonesAwarded,
      });
    }

    return json({
      answered: finalAnswered.length,
      correct,
      baseCoins,
      bonusCoins,
      milestoneBonus,
      milestoneHit,
      currentStreak: current,
      longestStreak: longest,
      shieldsConsumed,
    });
  } catch (e) {
    console.error(e);
    return json({ error: e instanceof Error ? e.message : "Unknown error" }, 500);
  }
});
