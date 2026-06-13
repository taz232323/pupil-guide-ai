import { DashboardShell } from "@/components/DashboardShell";
import { StudentClasses } from "./StudentClasses";

export default function StudentClassesPage() {
  return (
    <DashboardShell title="My classes" subtitle="Your enrolled classes and classmates.">
      <div className="animate-page-enter">
        <StudentClasses />
      </div>
    </DashboardShell>
  );
}