# Security hardening plan

## Findings up front (good news)

- **All 12 tables already have RLS enabled** with policies (verified in the schema).
- **No exposed secrets in the frontend.** `.env` only contains the Supabase URL, project ID, and the publishable (anon) key — these are designed to be public. There are no service-role keys, no third-party API keys, and no hardcoded credentials in `src/`.

So the "enable RLS on every table / move keys to env" parts of the request are already done. The real work is fixing **policy logic flaws** and **trigger gaps** flagged by the security scan.

## Issues to fix (one table at a time)

### 1. `shop_purchases` — economy bypass (ERROR)
Students can call PostgREST directly and insert a row with `cost: 1`, `currency: 'star'` for a crown item, or `status: 'approved'` for a privilege — bypassing pricing and teacher approval.

**Fix (migration):**
- Create a server-side canonical price table `shop_items (item_key, item_name, kind, currency, cost)` and seed it with the 6 cosmetics + 2 privileges currently hardcoded in `src/pages/Shop.tsx`.
- Add a `BEFORE INSERT` trigger on `shop_purchases` that:
  - Looks up `item_key` in `shop_items`.
  - Overwrites `cost`, `currency`, `kind`, `item_name` from the canonical row (ignoring client input).
  - Forces `status = 'pending'` for `kind='privilege'`, `status = 'approved'` for `kind='cosmetic'`.
  - Rejects unknown `item_key`.
- Keep existing `handle_shop_purchase` trigger (balance deduction) — it now runs against trusted values.

### 2. `submissions` — stored XSS via `link_url` (ERROR)
A student can submit `link_url = 'javascript:...'`; teacher clicks it in `TeacherSubmissions.tsx` and runs attacker JS.

**Fix:**
- Migration: add `CHECK (link_url IS NULL OR link_url ~* '^https?://')` on `submissions`.
- `src/pages/StudentAssignments.tsx` (and any other submission entry point): validate scheme client-side before insert, show a clear error.
- `TeacherSubmissions.tsx`: already opens in `target="_blank" rel="noreferrer"` — keep that; defense in depth.

### 3. `assignment_status_records` — cross-class inserts (WARN)
Current "Students manage own status" policy only checks `auth.uid() = student_id`. A student can insert a status row for an assignment in a class they haven't joined.

**Fix (migration):** replace the ALL policy with split policies whose `WITH CHECK` confirms the assignment's `class_id` is one the student belongs to:
```sql
EXISTS (
  SELECT 1 FROM assignments a
  WHERE a.id = assignment_id
    AND public.is_class_member(a.class_id, auth.uid())
)
```

### 4. SECURITY DEFINER functions exposed to authenticated role (6 WARN)
The Supabase linter flags six `SECURITY DEFINER` helpers (`has_role`, `is_class_member`, `is_class_teacher`, `get_current_user_role`, `can_message`, `generate_join_code`) as directly callable by signed-in users via PostgREST RPC.

`generate_join_code` is the only risky one — a student could RPC it and spam codes. The others are pure read helpers that already gate on the caller's `auth.uid()` inside RLS expressions.

**Fix (migration):**
- `REVOKE EXECUTE ... FROM PUBLIC, anon, authenticated` on all six (RLS policies still call them internally — they run as the policy owner, not the API caller, so policies keep working).
- Keep `join_class_by_code` callable (it's the legitimate student RPC).

### 5. Verify each remaining table is locked down
Quick confirmation pass — for each of: `assignments`, `class_members`, `classes`, `messages`, `notifications`, `profiles`, `student_coins`, `unit_crowns`, `user_roles` — re-read the existing policies and confirm:
- RLS is on.
- No `USING (true)` except `profiles` SELECT (intentional — needed for showing names in messages/submissions; no PII beyond `full_name` and `avatar_items`).
- No INSERT/UPDATE/DELETE missing where it should be denied.

These already look correct from the schema dump; this step is just a final sweep, no migration expected.

## Frontend secrets sweep
- `.env` → only `VITE_SUPABASE_URL`, `VITE_SUPABASE_PROJECT_ID`, `VITE_SUPABASE_PUBLISHABLE_KEY`. Public keys, safe.
- `rg` for `service_role|sk_|api[_-]?key` across `src/` — nothing found in this review; will re-grep during implementation to be sure.
- Edge function `delete-account` correctly reads `SUPABASE_SERVICE_ROLE_KEY` from `Deno.env`, never exposed to client.

## Order of execution
1. Create one migration containing: canonical `shop_items` table + seed + trigger, `submissions` URL check, `assignment_status_records` policy rewrite, `REVOKE EXECUTE` on the six helpers.
2. Update `src/pages/Shop.tsx` so `buy()` no longer sends `cost`/`currency`/`status`/`item_name` (only `item_key`, `student_id`, `class_id`, `kind`) — the trigger fills the rest.
3. Update `src/pages/StudentAssignments.tsx` to validate `link_url` scheme client-side.
4. Re-run `security--run_security_scan` and `supabase--linter` to confirm clean.

## Out of scope / not changing
- `profiles` table stays readable by authenticated users (needed across the app to render names/avatars; no sensitive PII stored).
- `messages` policy allowing the realtime SELECT for any student/teacher — required for Supabase Realtime to subscribe; row-level filtering still enforced by the sender/recipient policy.
