import { DashboardShell } from "@/components/DashboardShell";
import { Shop } from "./Shop";
import { StudentClasses } from "./StudentClasses";

export default function StudentDashboard() {
  return (
    <DashboardShell title="Student dashboard">
      <div className="space-y-4">
        <StudentClasses />
        <Shop />
      </div>
    </DashboardShell>
  );
}