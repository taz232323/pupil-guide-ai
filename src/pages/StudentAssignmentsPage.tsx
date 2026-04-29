import { DashboardShell } from "@/components/DashboardShell";
import { StudentAssignments } from "./StudentAssignments";

export default function StudentAssignmentsPage() {
  return (
    <DashboardShell title="Assignments" subtitle="Your upcoming and submitted work.">
      <StudentAssignments />
    </DashboardShell>
  );
}