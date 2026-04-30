import { useEffect, useMemo, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from "@/components/ui/select";
import { Input } from "@/components/ui/input";
import { StudentAvatar } from "@/components/StudentAvatar";
import { ChevronDown, ChevronRight, Search } from "lucide-react";
import { format } from "date-fns";
import { toast } from "sonner";

type ClassRow = { id: string; name: string };
type Assignment = { id: string; class_id: string; unit_tag: string | null; title: string; due_date: string | null };
type Member = { class_id: string; student_id: string };
type Profile = { id: string; full_name: string | null; avatar_items: string[] | null };
type Sub = { assignment_id: string; student_id: string };

type UnitStatus = "complete" | "partial" | "missing";
type UnitInfo = { unit: string; status: UnitStatus; submitted: number; total: number };

type StudentRow = {
  id: string;
  name: string;
  avatarItems: string[];
  total: number;
  submitted: number;
  rate: number;
  units: UnitInfo[];
  assignments: Array<{ id: string; title: string; unit: string; submitted: boolean; due: string | null }>;
};

const UNTAGGED = "Untagged";

const unitChipCls = (s: UnitStatus) =>
  s === "complete"
    ? "bg-emerald-500/15 text-emerald-700 dark:text-emerald-400 border-emerald-500/30"
    : s === "partial"
    ? "bg-amber-500/15 text-amber-700 dark:text-amber-400 border-amber-500/30"
    : "bg-destructive/15 text-destructive border-destructive/30";

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
  const [search, setSearch] = useState("");
  const [unitFilter, setUnitFilter] = useState<string>("all");
  const [expanded, setExpanded] = useState<Set<string>>(new Set());

  useEffect(() => {
    (async () => {
      const { data, error } = await supabase.from("classes").select("id, name").order("created_at");
      if (error) { toast.error(error.message); setLoading(false); return; }
      setClasses(data ?? []);
      setClassId("all");
      if (!data?.length) setLoading(false);
    })();
  }, []);

  useEffect(() => {
    if (!classId || classes.length === 0) return;
    (async () => {
      setLoading(true);
      setExpanded(new Set());
      setUnitFilter("all");

      const classFilter = classId === "all" ? classes.map((c) => c.id) : [classId];

      const [{ data: asgn, error: aErr }, { data: members, error: mErr }] = await Promise.all([
        supabase.from("assignments").select("id, class_id, unit_tag, title, due_date").in("class_id", classFilter),
        supabase.from("class_members").select("class_id, student_id").in("class_id", classFilter),
      ]);
      if (aErr || mErr) {
        toast.error((aErr ?? mErr)!.message);
        setLoading(false);
        return;
      }

      const assignments = (asgn ?? []) as Assignment[];
      const memberIds = Array.from(new Set(((members ?? []) as Member[]).map((m) => m.student_id)));
      const assignmentIds = assignments.map((a) => a.id);

      const [{ data: profs }, { data: subs }] = await Promise.all([
        memberIds.length
          ? supabase.from("profiles").select("id, full_name, avatar_items").in("id", memberIds)
          : Promise.resolve({ data: [] as Profile[] }),
        assignmentIds.length
          ? supabase.from("submissions")
              .select("assignment_id, student_id")
              .in("assignment_id", assignmentIds)
          : Promise.resolve({ data: [] as Sub[] }),
      ]);

      const profMap = new Map<string, Profile>();
      (profs ?? []).forEach((p: any) => profMap.set(p.id, p));

      const unitByAssignment = new Map<string, string>();
      assignments.forEach((a) => {
        const u = a.unit_tag?.trim() || UNTAGGED;
        unitByAssignment.set(a.id, u);
      });

      const subsByStudent = new Map<string, Set<string>>();
      ((subs ?? []) as Sub[]).forEach((s) => {
        if (!subsByStudent.has(s.student_id)) subsByStudent.set(s.student_id, new Set());
        subsByStudent.get(s.student_id)!.add(s.assignment_id);
      });

      const total = assignments.length;
      const built: StudentRow[] = memberIds.map((sid) => {
        const submittedSet = subsByStudent.get(sid) ?? new Set<string>();
        const submitted = assignments.filter((a) => submittedSet.has(a.id)).length;

        // per-unit aggregate
        const unitTotals = new Map<string, { total: number; submitted: number }>();
        assignments.forEach((a) => {
          const u = unitByAssignment.get(a.id) ?? UNTAGGED;
          const t = unitTotals.get(u) ?? { total: 0, submitted: 0 };
          t.total += 1;
          if (submittedSet.has(a.id)) t.submitted += 1;
          unitTotals.set(u, t);
        });
        const units: UnitInfo[] = Array.from(unitTotals.entries())
          .map(([unit, t]) => ({
            unit,
            submitted: t.submitted,
            total: t.total,
            status:
              t.submitted === 0
                ? ("missing" as const)
                : t.submitted >= t.total
                ? ("complete" as const)
                : ("partial" as const),
          }))
          .sort((a, b) => a.unit.localeCompare(b.unit));

        const profile = profMap.get(sid);
        return {
          id: sid,
          name: profile?.full_name || "Student",
          avatarItems: profile?.avatar_items ?? [],
          total,
          submitted,
          rate: total === 0 ? 0 : submitted / total,
          units,
          assignments: assignments
            .map((a) => ({
              id: a.id,
              title: a.title,
              unit: unitByAssignment.get(a.id) ?? UNTAGGED,
              submitted: submittedSet.has(a.id),
              due: a.due_date,
            }))
            .sort((a, b) => a.unit.localeCompare(b.unit) || a.title.localeCompare(b.title)),
        };
      });

      built.sort((a, b) => b.rate - a.rate || a.name.localeCompare(b.name));
      setRows(built);
      setLoading(false);
    })();
  }, [classId, classes]);

  const allUnits = useMemo(() => {
    const s = new Set<string>();
    rows.forEach((r) => r.units.forEach((u) => s.add(u.unit)));
    return Array.from(s).sort();
  }, [rows]);

  const filteredRows = useMemo(() => {
    const q = search.trim().toLowerCase();
    return rows.filter((r) => {
      if (q && !r.name.toLowerCase().includes(q)) return false;
      if (unitFilter !== "all" && !r.units.some((u) => u.unit === unitFilter)) return false;
      return true;
    });
  }, [rows, search, unitFilter]);

  const summary = useMemo(() => {
    const onTrack = filteredRows.filter((r) => r.total > 0 && r.rate >= 0.8).length;
    const behind = filteredRows.filter((r) => r.total > 0 && r.rate >= 0.4 && r.rate < 0.8).length;
    const missing = filteredRows.filter((r) => r.total > 0 && r.rate < 0.4).length;
    return { onTrack, behind, missing };
  }, [filteredRows]);

  const toggleRow = (id: string) =>
    setExpanded((prev) => {
      const next = new Set(prev);
      next.has(id) ? next.delete(id) : next.add(id);
      return next;
    });

  return (
    <Card className="border-border/60 shadow-sm">
      <CardHeader className="gap-4">
        <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3">
          <CardTitle className="text-base">Student progress</CardTitle>
          <div className="flex flex-wrap gap-2 text-xs">
            <span className="px-2.5 py-1 rounded-full bg-emerald-500/15 text-emerald-700 dark:text-emerald-400 font-medium">
              On track · {summary.onTrack}
            </span>
            <span className="px-2.5 py-1 rounded-full bg-amber-500/15 text-amber-700 dark:text-amber-400 font-medium">
              Behind · {summary.behind}
            </span>
            <span className="px-2.5 py-1 rounded-full bg-destructive/15 text-destructive font-medium">
              Missing · {summary.missing}
            </span>
          </div>
        </div>
        <div className="flex flex-col md:flex-row gap-2">
          <div className="relative flex-1">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
            <Input
              placeholder="Search students by name…"
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              className="pl-9"
            />
          </div>
          <Select value={classId} onValueChange={setClassId}>
            <SelectTrigger className="md:w-[200px]">
              <SelectValue placeholder="Class" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">All classes</SelectItem>
              {classes.map((c) => (
                <SelectItem key={c.id} value={c.id}>{c.name}</SelectItem>
              ))}
            </SelectContent>
          </Select>
          <Select value={unitFilter} onValueChange={setUnitFilter}>
            <SelectTrigger className="md:w-[180px]">
              <SelectValue placeholder="Unit" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">All units</SelectItem>
              {allUnits.map((u) => (
                <SelectItem key={u} value={u}>{u}</SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
      </CardHeader>
      <CardContent>
        {classes.length === 0 ? (
          <p className="text-sm text-muted-foreground">Create a class to see progress.</p>
        ) : loading ? (
          <div className="space-y-2">
            {Array.from({ length: 4 }).map((_, i) => (
              <div key={i} className="h-16 rounded-lg bg-muted/50 animate-pulse" />
            ))}
          </div>
        ) : filteredRows.length === 0 ? (
          <p className="text-sm text-muted-foreground py-8 text-center">
            {rows.length === 0 ? "No students have joined yet." : "No students match these filters."}
          </p>
        ) : (
          <div className="divide-y divide-border/60 rounded-lg border border-border/60 overflow-hidden">
            {filteredRows.map((r) => {
              const isOpen = expanded.has(r.id);
              const pct = Math.round(r.rate * 100);
              return (
                <div key={r.id} className="bg-card">
                  <button
                    type="button"
                    onClick={() => toggleRow(r.id)}
                    className="w-full text-left px-4 py-3 hover:bg-muted/40 transition-colors flex items-center gap-3"
                    aria-expanded={isOpen}
                  >
                    <span className="text-muted-foreground shrink-0">
                      {isOpen ? <ChevronDown className="h-4 w-4" /> : <ChevronRight className="h-4 w-4" />}
                    </span>
                    <StudentAvatar name={r.name} items={r.avatarItems} size="sm" />
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center justify-between gap-2 mb-1.5">
                        <span className="font-medium truncate">{r.name}</span>
                        <span className="text-xs text-muted-foreground tabular-nums shrink-0">
                          {r.submitted}/{r.total} · {pct}%
                        </span>
                      </div>
                      <div className="flex items-center gap-3">
                        <div className="h-2 flex-1 rounded-full bg-secondary overflow-hidden min-w-[80px]">
                          <div
                            className={`h-full transition-all ${barColor(r.rate)}`}
                            style={{ width: `${pct}%` }}
                          />
                        </div>
                        <div className="hidden sm:flex flex-wrap gap-1 justify-end max-w-[55%]">
                          {r.units.length === 0 ? (
                            <span className="text-[10px] text-muted-foreground">No units</span>
                          ) : (
                            r.units.map((u) => (
                              <span
                                key={u.unit}
                                className={`text-[10px] px-1.5 py-0.5 rounded border ${unitChipCls(u.status)}`}
                                title={`${u.submitted}/${u.total} submitted`}
                              >
                                {u.unit}
                              </span>
                            ))
                          )}
                        </div>
                      </div>
                    </div>
                  </button>

                  {isOpen && (
                    <div className="px-4 pb-4 pt-1 bg-muted/20">
                      <div className="sm:hidden flex flex-wrap gap-1 mb-3">
                        {r.units.map((u) => (
                          <span
                            key={u.unit}
                            className={`text-[10px] px-1.5 py-0.5 rounded border ${unitChipCls(u.status)}`}
                          >
                            {u.unit} · {u.submitted}/{u.total}
                          </span>
                        ))}
                      </div>
                      {r.assignments.length === 0 ? (
                        <p className="text-xs text-muted-foreground">No assignments yet.</p>
                      ) : (
                        <ul className="space-y-1.5">
                          {r.assignments.map((a) => (
                            <li
                              key={a.id}
                              className="flex items-center justify-between gap-3 px-3 py-2 rounded-md bg-card border border-border/60 text-sm"
                            >
                              <div className="min-w-0 flex-1">
                                <p className="truncate font-medium">{a.title}</p>
                                <p className="text-xs text-muted-foreground">
                                  {a.unit}
                                  {a.due ? ` · Due ${format(new Date(a.due), "MMM d")}` : ""}
                                </p>
                              </div>
                              <span
                                className={`text-[10px] uppercase tracking-wide px-2 py-0.5 rounded-full font-medium ${
                                  a.submitted
                                    ? "bg-emerald-500/15 text-emerald-700 dark:text-emerald-400"
                                    : "bg-destructive/15 text-destructive"
                                }`}
                              >
                                {a.submitted ? "Submitted" : "Missing"}
                              </span>
                            </li>
                          ))}
                        </ul>
                      )}
                    </div>
                  )}
                </div>
              );
            })}
          </div>
        )}
      </CardContent>
    </Card>
  );
};