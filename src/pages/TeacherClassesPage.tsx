import { DashboardShell } from "@/components/DashboardShell";
import { TeacherClasses } from "./TeacherClasses";

export default function TeacherClassesPage() {
  return (
    <DashboardShell title="My classes" subtitle="Manage your classes and join codes.">
      <TeacherClasses />
    </DashboardShell>
  );
}