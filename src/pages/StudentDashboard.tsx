import { DashboardShell } from "@/components/DashboardShell";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";

export default function StudentDashboard() {
  return (
    <DashboardShell title="Student dashboard">
      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
        <Card>
          <CardHeader><CardTitle className="text-base">My classes</CardTitle></CardHeader>
          <CardContent className="text-sm text-muted-foreground">
            You haven't joined any classes yet.
          </CardContent>
        </Card>
        <Card>
          <CardHeader><CardTitle className="text-base">Assignments</CardTitle></CardHeader>
          <CardContent className="text-sm text-muted-foreground">No assignments yet.</CardContent>
        </Card>
        <Card>
          <CardHeader><CardTitle className="text-base">Coins</CardTitle></CardHeader>
          <CardContent className="text-sm text-muted-foreground">⭐ 0 Star · 👑 0 Crown</CardContent>
        </Card>
      </div>
    </DashboardShell>
  );
}