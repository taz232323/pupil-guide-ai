import { DashboardShell } from "@/components/DashboardShell";
import { MountainSketch } from "@/components/MountainSketch";
import { Messages } from "./Messages";

export default function MessagesPage() {
  return (
    <DashboardShell
      title="Messages"
      subtitle="Connect with your classes and keep everyone informed."
    >
      <div className="relative mb-6 hidden sm:block h-0 overflow-visible">
        <MountainSketch
          variant="range"
          className="pointer-events-none absolute -top-20 right-0 w-64 text-muted-foreground/30"
        />
      </div>
      <div className="animate-page-enter">
        <Messages />
      </div>
    </DashboardShell>
  );
}
