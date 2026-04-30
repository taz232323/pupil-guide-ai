import { useEffect, useState } from "react";
import { Download, ExternalLink, FileText, Inbox } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { toast } from "sonner";
import { EmptyState } from "@/components/EmptyState";
import { RelativeTime } from "@/components/RelativeTime";

type Submission = {
  id: string;
  assignment_id: string;
  student_id: string;
  file_path: string | null;
  link_url: string | null;
  submitted_at: string;
};

type Grouped = {
  assignmentId: string;
  title: string;
  className: string;
  items: (Submission & { studentName: string })[];
};

export const TeacherSubmissions = () => {
  const [groups, setGroups] = useState<Grouped[]>([]);
  const [loading, setLoading] = useState(true);

  const load = async () => {
    setLoading(true);
    const { data: subs, error } = await supabase
      .from("submissions")
      .select("id, assignment_id, student_id, file_path, link_url, submitted_at")
      .order("submitted_at", { ascending: false });
    if (error) { toast.error(error.message); setLoading(false); return; }

    const aIds = Array.from(new Set((subs ?? []).map((s) => s.assignment_id)));
    const sIds = Array.from(new Set((subs ?? []).map((s) => s.student_id)));

    const [{ data: asgn }, { data: profs }] = await Promise.all([
      aIds.length
        ? supabase.from("assignments").select("id, title, class_id").in("id", aIds)
        : Promise.resolve({ data: [] as any[] }),
      sIds.length
        ? supabase.from("profiles").select("id, full_name").in("id", sIds)
        : Promise.resolve({ data: [] as any[] }),
    ]);
    const cIds = Array.from(new Set((asgn ?? []).map((a: any) => a.class_id)));
    const { data: cls } = cIds.length
      ? await supabase.from("classes").select("id, name").in("id", cIds)
      : { data: [] as any[] };

    const aMap = new Map<string, { title: string; className: string }>();
    const classMap = new Map((cls ?? []).map((c: any) => [c.id, c.name]));
    (asgn ?? []).forEach((a: any) => aMap.set(a.id, {
      title: a.title, className: classMap.get(a.class_id) ?? "Class",
    }));
    const pMap = new Map((profs ?? []).map((p: any) => [p.id, p.full_name || "Student"]));

    const byAssignment = new Map<string, Grouped>();
    (subs ?? []).forEach((s: any) => {
      const meta = aMap.get(s.assignment_id);
      if (!meta) return;
      const g = byAssignment.get(s.assignment_id) ?? {
        assignmentId: s.assignment_id,
        title: meta.title,
        className: meta.className,
        items: [],
      };
      g.items.push({ ...s, studentName: pMap.get(s.student_id) ?? "Student" });
      byAssignment.set(s.assignment_id, g);
    });

    setGroups(Array.from(byAssignment.values()));
    setLoading(false);
  };

  useEffect(() => { load(); }, []);

  const openFile = async (path: string) => {
    const { data, error } = await supabase.storage
      .from("submissions")
      .createSignedUrl(path, 60 * 5);
    if (error || !data) { toast.error(error?.message ?? "Failed"); return; }
    window.open(data.signedUrl, "_blank");
  };

  return (
    <Card>
      <CardHeader><CardTitle className="text-base">Submissions</CardTitle></CardHeader>
      <CardContent>
        {loading ? (
          <p className="text-sm text-muted-foreground">Loading...</p>
        ) : groups.length === 0 ? (
          <EmptyState
            icon={Inbox}
            title="No submissions yet"
            description="When students turn in work, it will show up here for review."
          />
        ) : (
          <div className="space-y-5">
            {groups.map((g) => (
              <div key={g.assignmentId}>
                <div className="mb-2">
                  <p className="font-medium">{g.title}</p>
                  <p className="text-xs text-muted-foreground">{g.className} · {g.items.length} submission{g.items.length !== 1 ? "s" : ""}</p>
                </div>
                <div className="divide-y divide-border border border-border rounded-md">
                  {g.items.map((s) => (
                    <div key={s.id} className="px-3 py-2 flex items-center justify-between gap-3">
                      <div className="min-w-0">
                        <p className="text-sm font-medium truncate">{s.studentName}</p>
                        <p className="text-xs text-muted-foreground">
                          submitted <RelativeTime date={s.submitted_at} />
                        </p>
                      </div>
                      {s.file_path ? (
                        <Button size="sm" variant="outline" onClick={() => openFile(s.file_path!)}>
                          <Download className="h-3.5 w-3.5 mr-1" />File
                        </Button>
                      ) : s.link_url ? (
                        <a href={s.link_url} target="_blank" rel="noreferrer">
                          <Button size="sm" variant="outline">
                            <ExternalLink className="h-3.5 w-3.5 mr-1" />Link
                          </Button>
                        </a>
                      ) : (
                        <span className="text-xs text-muted-foreground inline-flex items-center gap-1">
                          <FileText className="h-3 w-3" />—
                        </span>
                      )}
                    </div>
                  ))}
                </div>
              </div>
            ))}
          </div>
        )}
      </CardContent>
    </Card>
  );
};