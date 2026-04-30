import { DashboardShell } from "@/components/DashboardShell";
import { TeacherShopManagement } from "./TeacherShopManagement";

export default function TeacherShopPage() {
  return (
    <DashboardShell title="Shop" subtitle="Manage cosmetics, privileges, and pending requests.">
      <TeacherShopManagement />
    </DashboardShell>
  );
}
