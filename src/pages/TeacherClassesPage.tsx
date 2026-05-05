import { DashboardShell } from "@/components/DashboardShell";
import { TeacherClasses } from "./TeacherClasses";

export default function TeacherClassesPage() {
  return (
    <DashboardShell title="My Classes" subtitle="Manage your classes and join codes.">
      <TeacherClasses />
    </DashboardShell>
  );
}