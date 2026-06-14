import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";

/**
 * useStreakFlames — batch-loads current streak counts for the given student ids.
 * Returns a Map<studentId, streak>. Missing entries mean 0 / no streak.
 */
export function useStreakFlames(studentIds: string[] | undefined | null) {
  const [map, setMap] = useState<Map<string, number>>(new Map());

  const key = (studentIds ?? []).slice().sort().join(",");

  useEffect(() => {
    let cancelled = false;
    const ids = Array.from(new Set((studentIds ?? []).filter(Boolean)));
    if (ids.length === 0) {
      setMap(new Map());
      return;
    }
    (async () => {
      const { data, error } = await (supabase as any).rpc("get_student_streaks", {
        _student_ids: ids,
      });
      if (cancelled) return;
      if (error) {
        console.warn("get_student_streaks failed:", error.message);
        setMap(new Map());
        return;
      }
      const next = new Map<string, number>();
      (data ?? []).forEach((r: any) => next.set(r.student_id, r.current_streak ?? 0));
      setMap(next);
    })();
    return () => {
      cancelled = true;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [key]);

  return map;
}
