import { DashboardShell } from "@/components/DashboardShell";
import { TeacherProgress } from "./TeacherProgress";

export default function TeacherProgressPage() {
  return (
    <DashboardShell title="Student progress" subtitle="See completion rates per student and unit.">
      <TeacherProgress />
    </DashboardShell>
  );
}