import { DashboardShell } from "@/components/DashboardShell";
import { Shop } from "./Shop";

export default function StudentDashboard() {
  return (
    <DashboardShell title="Student dashboard">
      <div className="space-y-4">
        <Shop />
      </div>
    </DashboardShell>
  );
}