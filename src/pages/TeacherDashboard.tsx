import { DashboardShell } from "@/components/DashboardShell";
import { TeacherClasses } from "./TeacherClasses";
import { TeacherAssignments } from "./TeacherAssignments";
import { TeacherPrivilegeRequests } from "./TeacherPrivilegeRequests";

export default function TeacherDashboard() {
  return (
    <DashboardShell title="Teacher dashboard">
      <div className="space-y-4">
        <TeacherClasses />
        <TeacherAssignments />
        <TeacherPrivilegeRequests />
      </div>
    </DashboardShell>
  );
}