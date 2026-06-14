import { DashboardShell } from "@/components/DashboardShell";
import { Shop } from "./Shop";

export default function ShopPage() {
  return (
    <DashboardShell title="Shop" subtitle="Spend your coins on rewards that inspire your learning.">
      <Shop />
    </DashboardShell>
  );
}