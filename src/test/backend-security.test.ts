import { describe, expect, it } from "vitest";
import { readFileSync } from "node:fs";
import { join } from "node:path";

const root = process.cwd();

function read(path: string) {
  return readFileSync(join(root, path), "utf8");
}

describe("backend security control plane", () => {
  const migration = read("supabase/migrations/20260517053000_backend_control_plane.sql");
  const messageMigration = read("supabase/migrations/20260517061500_message_integrity_hardening.sql");

  it("gates teacher signup with one-time invite codes", () => {
    expect(migration).toContain("CREATE TABLE IF NOT EXISTS public.teacher_invites");
    expect(migration).toContain("teacher_invite_code");
    expect(migration).toContain("used_at IS NULL");
    expect(migration).toContain("_role := 'teacher'");
  });

  it("keeps critical assignment mutations server-owned", () => {
    expect(migration).toContain("CREATE OR REPLACE FUNCTION public.set_assignment_status");
    expect(migration).toContain("CREATE OR REPLACE FUNCTION public.save_assignment_progress");
    expect(migration).toContain("CREATE OR REPLACE FUNCTION public.submit_assignment");
    expect(migration).toContain("CREATE OR REPLACE FUNCTION public.grade_assignment_submission");
    expect(migration).toContain("DROP POLICY IF EXISTS \"Students insert submissions for joined assignments\"");
    expect(migration).toContain("DROP POLICY IF EXISTS \"Students insert own answers before submission\"");
    expect(migration).toContain("DROP POLICY IF EXISTS \"Students insert status for joined-class assignments\"");
    expect(migration).toContain("DROP POLICY IF EXISTS \"Teachers grade answers for own assignments\"");
    expect(migration).toContain("DROP POLICY IF EXISTS \"Teachers manage grades for own assignments\"");
  });

  it("keeps shop purchase creation and resolution server-owned", () => {
    expect(migration).toContain("CREATE OR REPLACE FUNCTION public.create_shop_purchase");
    expect(migration).toContain("CREATE OR REPLACE FUNCTION public.resolve_shop_purchase");
    expect(migration).toContain("DROP POLICY IF EXISTS \"Students create own purchases\"");
    expect(migration).toContain("DROP POLICY IF EXISTS \"Teachers resolve purchases for their classes\"");
  });

  it("adds audit trails, rate-limit state, and backend invariants", () => {
    expect(migration).toContain("CREATE TABLE IF NOT EXISTS public.security_audit_log");
    expect(migration).toContain("CREATE TABLE IF NOT EXISTS public.edge_rate_limits");
    expect(migration).toContain("CREATE OR REPLACE FUNCTION public.check_edge_rate_limit");
    expect(migration).toContain("student_coins_nonnegative");
    expect(migration).toContain("idx_daily_practice_answers_session_position");
  });

  it("wires critical frontend flows to backend RPCs", () => {
    const studentAssignment = read("src/pages/StudentAssignmentDetail.tsx");
    const studentAssignments = read("src/pages/StudentAssignments.tsx");
    const teacherAssignment = read("src/pages/TeacherAssignmentDetail.tsx");
    const teacherGradebook = read("src/pages/TeacherGradebook.tsx");
    const shop = read("src/pages/Shop.tsx");
    const privilegeRequests = read("src/pages/TeacherPrivilegeRequests.tsx");

    expect(studentAssignment).toContain('rpc("save_assignment_progress"');
    expect(studentAssignment).toContain('rpc("submit_assignment"');
    expect(studentAssignments).toContain('rpc("set_assignment_status"');
    expect(teacherAssignment).toContain('rpc("grade_assignment_submission"');
    expect(teacherGradebook).toContain('rpc("grade_assignment_submission"');
    expect(shop).toContain('rpc("create_shop_purchase"');
    expect(privilegeRequests).toContain('rpc("resolve_shop_purchase"');
  });

  it("rate-limits AI and reward-bearing edge functions", () => {
    expect(read("supabase/functions/study-buddy/index.ts")).toContain("check_edge_rate_limit");
    expect(read("supabase/functions/daily-practice-generate/index.ts")).toContain("check_edge_rate_limit");
    expect(read("supabase/functions/daily-practice-submit/index.ts")).toContain("check_edge_rate_limit");
  });

  it("hardens message integrity and group membership boundaries", () => {
    expect(messageMigration).toContain("CREATE OR REPLACE FUNCTION public.enforce_message_recipient_read_update");
    expect(messageMigration).toContain("Recipients can only update message read_at");
    expect(messageMigration).toContain("public.is_class_member(g.class_id, user_id)");
    expect(messageMigration).toContain("public.is_class_teacher(class_id, auth.uid())");
  });

  it("sanitizes stored rich module HTML before rendering", () => {
    const richEditor = read("src/components/RichEditor.tsx");
    expect(richEditor).toContain('import DOMPurify from "dompurify"');
    expect(richEditor).toContain("function sanitizeRichHtml");
    expect(richEditor).toContain("dangerouslySetInnerHTML={{ __html: sanitizeRichHtml(html) }}");
  });
});
