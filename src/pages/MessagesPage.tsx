import { DashboardShell } from "@/components/DashboardShell";
import { Messages } from "./Messages";

export default function MessagesPage() {
  return (
    <DashboardShell title="Messages" subtitle="Direct messages within your classes.">
      <Messages />
    </DashboardShell>
  );
}