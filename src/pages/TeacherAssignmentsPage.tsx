import { DashboardShell } from "@/components/DashboardShell";
import { TeacherAssignments } from "./TeacherAssignments";

export default function TeacherAssignmentsPage() {
  return (
    <DashboardShell title="Assignments" subtitle="Create and manage assignments.">
      <TeacherAssignments />
    </DashboardShell>
  );
}