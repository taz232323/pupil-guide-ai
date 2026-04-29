import { DashboardShell } from "@/components/DashboardShell";
import { Shop } from "./Shop";

export default function ShopPage() {
  return (
    <DashboardShell title="Shop" subtitle="Spend Star and Crown coins on rewards.">
      <Shop />
    </DashboardShell>
  );
}