# Codex Security Report: pupil-guide-ai

Repository: `/Users/harish.desai/pupil-guide-ai`  
Baseline commit: `20b7da3`  
Scan timestamp: `2026-05-17T04:20:37Z`  
Full artifacts: `/tmp/codex-security-scans/pupil-guide-ai/20b7da3_20260517T042037Z/artifacts`

## Summary

Codex Security was run repository-wide using the required phases: threat model, finding discovery, validation, attack-path analysis, and final report assembly.

Three reportable issues were found and fixed in this working tree:

- Stored module rich HTML could be rendered without sanitization. Fixed with DOMPurify sanitization on editor output and render, plus unsafe-link rejection.
- Message recipients could update received message rows beyond `read_at`. Fixed with a database trigger that enforces read-only message content for recipients.
- Teachers could add non-class users to owned group chats through direct Supabase inserts. Fixed by requiring inserted group members to be the teacher or enrolled in the group class.

No high or critical findings remain after the fixes and verification below.

## Fixed Findings

### Stored Rich HTML XSS

- Priority before fix: P2
- Severity before fix: medium
- Confidence: high
- CWE: CWE-79
- Affected lines:
  - [RichEditor.tsx](/Users/harish.desai/pupil-guide-ai/src/components/RichEditor.tsx:28)
  - [RichEditor.tsx](/Users/harish.desai/pupil-guide-ai/src/components/RichEditor.tsx:61)
  - [RichEditor.tsx](/Users/harish.desai/pupil-guide-ai/src/components/RichEditor.tsx:131)
- Fix: sanitize stored rich HTML with DOMPurify before persistence/rendering and reject non-http/https/mailto/site-relative links.
- Validation: [rich-content-security.test.tsx](/Users/harish.desai/pupil-guide-ai/src/test/rich-content-security.test.tsx:5) confirms script/img removal and blocks `javascript:` links.

### Message Recipient Tampering

- Priority before fix: P2
- Severity before fix: medium
- Confidence: high
- CWE: CWE-639 / CWE-862
- Affected lines:
  - [20260517061500_message_integrity_hardening.sql](/Users/harish.desai/pupil-guide-ai/supabase/migrations/20260517061500_message_integrity_hardening.sql:4)
  - [backend_security_rls.test.sql](/Users/harish.desai/pupil-guide-ai/supabase/tests/database/backend_security_rls.test.sql:568)
- Fix: added `enforce_message_recipient_read_update()` so recipients can only update `read_at`.
- Validation: pgTAP verifies body tampering is rejected and marking read still works.

### Group Membership Boundary

- Priority before fix: P2
- Severity before fix: medium
- Confidence: high
- CWE: CWE-639 / CWE-862
- Affected lines:
  - [20260517061500_message_integrity_hardening.sql](/Users/harish.desai/pupil-guide-ai/supabase/migrations/20260517061500_message_integrity_hardening.sql:43)
  - [backend_security_rls.test.sql](/Users/harish.desai/pupil-guide-ai/supabase/tests/database/backend_security_rls.test.sql:543)
- Fix: tightened group-member insert policy so teachers can add only themselves or enrolled class members.
- Validation: pgTAP verifies enrolled members can be added and non-class users are rejected.

## Coverage Closure

- Teacher onboarding: invite-gated teacher role creation is implemented and pgTAP verified.
- Assignment submission/answers/status: server-owned RPCs are implemented and direct browser writes are blocked.
- Grading: teacher grading is RPC-owned; student grading attempts are blocked.
- Shop purchases and privilege resolution: RPC-owned; direct forged purchase/resolution paths are blocked.
- Edge Functions: AI/reward paths authenticate users, cap body size, validate ids, clip prompts, and use service-role-only DB rate limiting. Scheduled functions require cron secret or service-role bearer.
- Database advisors: Supabase security advisor returned no issues.
- Dependencies: `npm audit` returned no vulnerabilities.

## Verification

- `npx --yes supabase test db`: passed, 37 pgTAP tests.
- `npx --yes supabase db lint --local`: passed, no schema errors.
- `npx --yes supabase db advisors --local --type security --level warn`: passed, no issues found.
- `npm audit`: passed, `found 0 vulnerabilities`.
- `./node_modules/.bin/tsc --noEmit --pretty false`: passed.
- `npm test`: passed, 3 files / 10 tests.

## Notes

- Full Supabase stack start initially failed when Edge Runtime tried to fetch a remote Deno import with a local certificate error. Database tests were run with Supabase started without Edge Runtime, which is sufficient for migration/RLS/pgTAP validation.
- No surviving Codex Security findings require inline review comments.
