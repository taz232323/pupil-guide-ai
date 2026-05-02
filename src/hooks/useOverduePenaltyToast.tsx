import { useEffect } from "react";
import { toast } from "sonner";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";

const STORAGE_KEY = "overdue_penalty_last_seen_v1";

/**
 * Shows a toast on login if the student lost Star Coins to overdue
 * assignment penalties since the last time they saw the notice.
 */
export function useOverduePenaltyToast() {
  const { user, role } = useAuth();

  useEffect(() => {
    if (!user || role !== "student") return;

    const key = `${STORAGE_KEY}:${user.id}`;
    const lastSeen = localStorage.getItem(key);
    const since = lastSeen ?? new Date(Date.now() - 7 * 86_400_000).toISOString();

    (async () => {
      const { data, error } = await supabase
        .from("coin_transactions" as any)
        .select("amount, created_at")
        .eq("student_id", user.id)
        .eq("reason", "overdue_penalty")
        .gt("created_at", since)
        .order("created_at", { ascending: false });

      if (error || !data || data.length === 0) {
        localStorage.setItem(key, new Date().toISOString());
        return;
      }

      const total = (data as any[]).reduce(
        (sum, r) => sum + Math.abs(Number(r.amount) || 0),
        0,
      );
      if (total > 0) {
        toast.warning(
          `You lost ${total} Star Coin${total === 1 ? "" : "s"} due to overdue assignments.`,
          {
            description:
              `Across ${data.length} deduction${data.length === 1 ? "" : "s"}. Submit overdue work to stop the penalty.`,
            duration: 8000,
          },
        );
      }
      localStorage.setItem(key, new Date().toISOString());
    })();
  }, [user, role]);
}