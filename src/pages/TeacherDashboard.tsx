import { DashboardShell } from "@/components/DashboardShell";
import { TeacherClasses } from "./TeacherClasses";

export default function TeacherDashboard() {
  return (
    <DashboardShell title="Teacher dashboard">
      <TeacherClasses />
    </DashboardShell>
  );
}