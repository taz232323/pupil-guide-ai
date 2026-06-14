import { DashboardShell } from "@/components/DashboardShell";
import { TeacherAssignments } from "./TeacherAssignments";

export default function TeacherAssignmentsPage() {
  return (
    <DashboardShell title="Assignments" subtitle="Create meaningful work and track student progress.">
      <TeacherAssignments />
    </DashboardShell>
  );
}