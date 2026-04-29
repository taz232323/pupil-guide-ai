import { useEffect, useMemo, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from "@/components/ui/select";
import {
  Table, TableBody, TableCell, TableHead, TableHeader, TableRow,
} from "@/components/ui/table";
import { toast } from "sonner";

type ClassRow = { id: string; name: string };
type Assignment = { id: string; class_id: string; unit_tag: string | null };
type Member = { class_id: string; student_id: string };
type Profile = { id: string; full_name: string | null };
type Sub = { assignment_id: string; student_id: string };

type StudentRow = {
  id: string;
  name: string;
  total: number;
  submitted: number;
  rate: number; // 0-1
  submittedUnits: string[];
  missingUnits: string[];
};

const UNTAGGED = "Untagged";

const statusFor = (rate: number, total: number) => {
  if (total === 0) return { label: "No work assigned", cls: "bg-secondary text-secondary-foreground" };
  if (rate >= 0.8) return { label: "On track", cls: "bg-emerald-500/15 text-emerald-600 dark:text-emerald-400" };
  if (rate >= 0.4) return { label: "Behind", cls: "bg-amber-500/15 text-amber-600 dark:text-amber-400" };
  return { label: "Missing", cls: "bg-destructive/15 text-destructive" };
};

const barColor = (rate: number) => {
  if (rate >= 0.8) return "bg-emerald-500";
  if (rate >= 0.4) return "bg-amber-500";
  return "bg-destructive";
};

export const TeacherProgress = () => {
  const [classes, setClasses] = useState<ClassRow[]>([]);
  const [classId, setClassId] = useState<string>("");
  const [rows, setRows] = useState<StudentRow[]>([]);
  const [loading, setLoading] = useState(true);

  // initial: load classes
  useEffect(() => {
    (async () => {
      const { data, error } = await supabase.from("classes").select("id, name").order("created_at");
      if (error) { toast.error(error.message); setLoading(false); return; }
      setClasses(data ?? []);
      setClassId((data?.[0]?.id) ?? "");
      if (!data?.length) setLoading(false);
    })();
  }, []);

  // when class changes: build progress
  useEffect(() => {
    if (!classId) return;
    (async () => {
      setLoading(true);

      const [{ data: asgn, error: aErr }, { data: members, error: mErr }] = await Promise.all([
        supabase.from("assignments").select("id, class_id, unit_tag").eq("class_id", classId),
        supabase.from("class_members").select("class_id, student_id").eq("class_id", classId),
      ]);
      if (aErr || mErr) {
        toast.error((aErr ?? mErr)!.message);
        setLoading(false);
        return;
      }

      const assignments = (asgn ?? []) as Assignment[];
      const memberIds = ((members ?? []) as Member[]).map((m) => m.student_id);
      const assignmentIds = assignments.map((a) => a.id);

      const [{ data: profs }, { data: subs }] = await Promise.all([
        memberIds.length
          ? supabase.from("profiles").select("id, full_name").in("id", memberIds)
          : Promise.resolve({ data: [] as Profile[] }),
        assignmentIds.length
          ? supabase.from("submissions")
              .select("assignment_id, student_id")
              .in("assignment_id", assignmentIds)
          : Promise.resolve({ data: [] as Sub[] }),
      ]);

      const profMap = new Map<string, string>();
      (profs ?? []).forEach((p: any) => profMap.set(p.id, p.full_name || "Student"));

      const unitByAssignment = new Map<string, string>();
      const allUnits = new Set<string>();
      assignments.forEach((a) => {
        const u = a.unit_tag?.trim() || UNTAGGED;
        unitByAssignment.set(a.id, u);
        allUnits.add(u);
      });

      // student -> set of submitted assignment ids
      const subsByStudent = new Map<string, Set<string>>();
      ((subs ?? []) as Sub[]).forEach((s) => {
        if (!subsByStudent.has(s.student_id)) subsByStudent.set(s.student_id, new Set());
        subsByStudent.get(s.student_id)!.add(s.assignment_id);
      });

      const total = assignments.length;
      const built: StudentRow[] = memberIds.map((sid) => {
        const submittedSet = subsByStudent.get(sid) ?? new Set<string>();
        const submitted = assignments.filter((a) => submittedSet.has(a.id)).length;
        const submittedUnits = new Set<string>();
        const expectedUnits = new Set<string>();
        assignments.forEach((a) => {
          const u = unitByAssignment.get(a.id) ?? UNTAGGED;
          expectedUnits.add(u);
          if (submittedSet.has(a.id)) submittedUnits.add(u);
        });
        const missingUnits = Array.from(expectedUnits).filter((u) => !submittedUnits.has(u));
        return {
          id: sid,
          name: profMap.get(sid) ?? "Student",
          total,
          submitted,
          rate: total === 0 ? 0 : submitted / total,
          submittedUnits: Array.from(submittedUnits).sort(),
          missingUnits: missingUnits.sort(),
        };
      });

      built.sort((a, b) => b.rate - a.rate || a.name.localeCompare(b.name));
      setRows(built);
      setLoading(false);
    })();
  }, [classId]);

  const summary = useMemo(() => {
    const onTrack = rows.filter((r) => r.total > 0 && r.rate >= 0.8).length;
    const behind = rows.filter((r) => r.total > 0 && r.rate >= 0.4 && r.rate < 0.8).length;
    const missing = rows.filter((r) => r.total > 0 && r.rate < 0.4).length;
    return { onTrack, behind, missing };
  }, [rows]);

  return (
    <Card>
      <CardHeader className="flex flex-row items-center justify-between gap-3">
        <CardTitle className="text-base">Student progress</CardTitle>
        <Select value={classId} onValueChange={setClassId}>
          <SelectTrigger className="w-[220px]">
            <SelectValue placeholder="Select a class" />
          </SelectTrigger>
          <SelectContent>
            {classes.map((c) => (
              <SelectItem key={c.id} value={c.id}>{c.name}</SelectItem>
            ))}
          </SelectContent>
        </Select>
      </CardHeader>
      <CardContent>
        {classes.length === 0 ? (
          <p className="text-sm text-muted-foreground">Create a class to see progress.</p>
        ) : loading ? (
          <p className="text-sm text-muted-foreground">Loading...</p>
        ) : rows.length === 0 ? (
          <p className="text-sm text-muted-foreground">No students have joined this class yet.</p>
        ) : (
          <>
            <div className="flex flex-wrap gap-2 mb-4 text-xs">
              <span className="px-2 py-1 rounded-full bg-emerald-500/15 text-emerald-600 dark:text-emerald-400">
                On track · {summary.onTrack}
              </span>
              <span className="px-2 py-1 rounded-full bg-amber-500/15 text-amber-600 dark:text-amber-400">
                Behind · {summary.behind}
              </span>
              <span className="px-2 py-1 rounded-full bg-destructive/15 text-destructive">
                Missing · {summary.missing}
              </span>
            </div>

            <div className="overflow-x-auto">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead className="w-[200px]">Student</TableHead>
                    <TableHead className="w-[110px]">Status</TableHead>
                    <TableHead className="w-[200px]">Completion</TableHead>
                    <TableHead>Submitted units</TableHead>
                    <TableHead>Missing units</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {rows.map((r) => {
                    const s = statusFor(r.rate, r.total);
                    return (
                      <TableRow key={r.id}>
                        <TableCell className="font-medium">{r.name}</TableCell>
                        <TableCell>
                          <span className={`text-[10px] uppercase tracking-wide px-2 py-0.5 rounded-full ${s.cls}`}>
                            {s.label}
                          </span>
                        </TableCell>
                        <TableCell>
                          <div className="flex items-center gap-2">
                            <div className="h-1.5 flex-1 rounded-full bg-secondary overflow-hidden">
                              <div
                                className={`h-full ${barColor(r.rate)}`}
                                style={{ width: `${Math.round(r.rate * 100)}%` }}
                              />
                            </div>
                            <span className="text-xs text-muted-foreground tabular-nums w-16 text-right">
                              {r.submitted}/{r.total} · {Math.round(r.rate * 100)}%
                            </span>
                          </div>
                        </TableCell>
                        <TableCell>
                          {r.submittedUnits.length === 0 ? (
                            <span className="text-xs text-muted-foreground">—</span>
                          ) : (
                            <div className="flex flex-wrap gap-1">
                              {r.submittedUnits.map((u) => (
                                <span key={u} className="text-[10px] px-1.5 py-0.5 rounded bg-emerald-500/15 text-emerald-600 dark:text-emerald-400">
                                  {u}
                                </span>
                              ))}
                            </div>
                          )}
                        </TableCell>
                        <TableCell>
                          {r.missingUnits.length === 0 ? (
                            <span className="text-xs text-muted-foreground">—</span>
                          ) : (
                            <div className="flex flex-wrap gap-1">
                              {r.missingUnits.map((u) => (
                                <span key={u} className="text-[10px] px-1.5 py-0.5 rounded bg-destructive/15 text-destructive">
                                  {u}
                                </span>
                              ))}
                            </div>
                          )}
                        </TableCell>
                      </TableRow>
                    );
                  })}
                </TableBody>
              </Table>
            </div>
          </>
        )}
      </CardContent>
    </Card>
  );
};