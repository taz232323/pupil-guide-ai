# Backend Improvement Summary

Date: 2026-05-17  
Repo: `/Users/harish.desai/pupil-guide-ai`

## Implemented

- Added invite-gated teacher signup with `teacher_invites` and `teacher_invite_hash()`.
- Added server-owned RPCs for critical mutations:
  - `save_assignment_progress`
  - `submit_assignment`
  - `grade_assignment_submission`
  - `create_shop_purchase`
  - `resolve_shop_purchase`
- Removed frontend direct writes for assignment submission, grading, shop purchase creation, and privilege resolution.
- Added audit infrastructure with `security_audit_log` plus role/coin audit triggers.
- Added rate-limit state and `check_edge_rate_limit()` for Edge Functions.
- Added database constraints/indexes for coin balances, grade scores, practice status/types, and practice answer uniqueness.
- Hardened Edge Functions with request-size checks, JSON validation, UUID validation where relevant, provider-context clipping, rate limits, and configurable `APP_ORIGIN` CORS.
- Added server-owned assignment status changes with `set_assignment_status()` and removed direct student writes for assignment answers, submissions, and status rows.
- Hardened message integrity:
  - Recipients can only mark messages as read; they cannot edit received message content.
  - Teachers can add only themselves or enrolled class members to class group chats.
- Added rich-content sanitization with DOMPurify and unsafe-link rejection for stored module HTML.
- Added executable Supabase pgTAP RLS/integration tests in `supabase/tests/database/backend_security_rls.test.sql`.
- Added frontend/backend safety tests in `src/test/backend-security.test.ts` and `src/test/rich-content-security.test.tsx`.
- Ran Codex Security repository-wide and saved the final report to `output/security/codex-security-report.md`.

## Deployment Notes

- Apply these new migrations before deploying the frontend and Edge Functions:
  - `supabase/migrations/20260517040000_security_hardening.sql`
  - `supabase/migrations/20260517053000_backend_control_plane.sql`
  - `supabase/migrations/20260517061500_message_integrity_hardening.sql`
  - `supabase/migrations/20260517062000_db_lint_cleanup.sql`
- Configure `APP_ORIGIN` on each Edge Function deployment to avoid wildcard CORS in production.
- Configure `CRON_SECRET` for scheduled functions.
- Create teacher invites by inserting a hash generated with:

```sql
INSERT INTO public.teacher_invites (code_hash, invited_email, expires_at)
VALUES (
  public.teacher_invite_hash('plain-code'),
  'teacher@example.com',
  now() + interval '14 days'
);
```

## Verification

- `npm ci --ignore-scripts --no-audit --no-fund`: passed.
- `npm audit`: passed, `found 0 vulnerabilities`.
- `./node_modules/.bin/tsc --noEmit --pretty false`: passed.
- `npm test`: passed, 3 files / 10 tests.
- `npm run build`: passed with non-blocking warnings.
- `npm run lint`: passed with 0 errors and existing warnings.
- Playwright smoke: `/` and `/auth` loaded with 0 console errors; teacher signup shows the invite-code field.
- `npx --yes supabase test db`: passed, 37 pgTAP tests.
- `npx --yes supabase db lint --local`: passed, no schema errors.
- `npx --yes supabase db advisors --local --type security --level warn`: passed, no issues found.
- `git diff --check`: passed.

## Security Result

Codex Security found and fixed three medium-priority issues:

- Stored rich HTML XSS risk in module content rendering.
- Recipient-side message tampering beyond `read_at`.
- Teacher ability to add non-class users to owned group chats.

No high or critical findings remain after the fixes. The Supabase security advisor also returned no warning-level issues.

## Local Caveat

Full Supabase stack start initially failed because Edge Runtime could not fetch a remote Deno import due to a local certificate error. The database stack was started without Edge Runtime, which is sufficient for migration, RLS, and pgTAP validation.
