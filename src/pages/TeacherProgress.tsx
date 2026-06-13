import { useEffect, useMemo, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from "@/components/ui/select";
import { Input } from "@/components/ui/input";
import { StudentAvatar } from "@/components/StudentAvatar";
import { ChevronDown, ChevronRight, Search, MessagesSquare } from "lucide-react";
import { format } from "date-fns";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { StudentConversationsDialog } from "@/components/StudentConversationsDialog";
import { Reveal } from "@/components/Reveal";
import { CountUp } from "@/components/CountUp";
import { MountainSketch } from "@/components/MountainSketch";
import { ProgressRing } from "@/components/ProgressRing";

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
    ? "bg-success-soft text-success border-success/30"
    : s === "partial"
    ? "bg-warning-soft text-warning border-warning/30"
    : "bg-destructive/15 text-destructive border-destructive/30";

const barColor = (rate: number) => {
  if (rate >= 0.8) return "bg-success";
  if (rate >= 0.4) return "bg-warning";
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
  const [convDialog, setConvDialog] = useState<{ id: string; name: string } | null>(null);

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
    const withWork = filteredRows.filter((r) => r.total > 0).length;
    const noWork = filteredRows.length - withWork;
    return { onTrack, behind, missing, noWork, total: filteredRows.length };
  }, [filteredRows]);

  // Class-wide completion % per unit (for the "Unit mastery" bars).
  const unitMastery = useMemo(() => {
    const agg = new Map<string, { submitted: number; total: number }>();
    filteredRows.forEach((r) =>
      r.units.forEach((u) => {
        const t = agg.get(u.unit) ?? { submitted: 0, total: 0 };
        t.submitted += u.submitted;
        t.total += u.total;
        agg.set(u.unit, t);
      })
    );
    return Array.from(agg.entries())
      .map(([unit, t]) => ({ unit, pct: t.total === 0 ? 0 : Math.round((t.submitted / t.total) * 100) }))
      .sort((a, b) => b.pct - a.pct);
  }, [filteredRows]);

  // Average class completion across students with assigned work.
  const classCompletion = useMemo(() => {
    const active = filteredRows.filter((r) => r.total > 0);
    if (!active.length) return 0;
    return Math.round((active.reduce((s, r) => s + r.rate, 0) / active.length) * 100);
  }, [filteredRows]);

  const toggleRow = (id: string) =>
    setExpanded((prev) => {
      const next = new Set(prev);
      next.has(id) ? next.delete(id) : next.add(id);
      return next;
    });

  return (
    <div className="grid grid-cols-1 lg:grid-cols-[1fr_320px] gap-4 items-start">
    <Card className="hover-lift">
      <CardHeader className="relative overflow-hidden gap-4">
        <MountainSketch variant="range" className="pointer-events-none absolute -top-4 right-0 hidden sm:block w-56 text-muted-foreground/30" />
        <div className="relative flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3">
          <CardTitle className="text-base">Student progress</CardTitle>
          <div className="flex flex-wrap gap-2 text-xs">
            <span className="px-2.5 py-1 rounded-full bg-success-soft text-success font-medium transition-spring hover:scale-105">
              On track · <CountUp value={summary.onTrack} />
            </span>
            <span className="px-2.5 py-1 rounded-full bg-warning-soft text-warning font-medium transition-spring hover:scale-105">
              Behind · <CountUp value={summary.behind} />
            </span>
            <span className="px-2.5 py-1 rounded-full bg-destructive/15 text-destructive font-medium transition-spring hover:scale-105">
              Missing · <CountUp value={summary.missing} />
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
            {filteredRows.map((r, i) => {
              const isOpen = expanded.has(r.id);
              const pct = Math.round(r.rate * 100);
              return (
                <Reveal key={r.id} delay={Math.min(i, 8) * 60} as="div" className="bg-card">
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
                        <span className="text-xs text-muted-foreground font-tabular shrink-0">
                          {r.submitted}/{r.total} · <CountUp value={pct} suffix="%" />
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
                                className={`text-[10px] px-1.5 py-0.5 rounded border transition-transform hover:scale-110 ${unitChipCls(u.status)}`}
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
                                    ? "bg-success-soft text-success"
                                    : "bg-destructive/15 text-destructive"
                                }`}
                              >
                                {a.submitted ? "Submitted" : "Missing"}
                              </span>
                            </li>
                          ))}
                        </ul>
                      )}
                      <div className="mt-3 flex justify-end">
                        <Button
                          variant="outline"
                          size="sm"
                          onClick={() => setConvDialog({ id: r.id, name: r.name })}
                        >
                          <MessagesSquare className="h-4 w-4" />
                          View Conversations
                        </Button>
                      </div>
                    </div>
                  )}
                </Reveal>
              );
            })}
          </div>
        )}
      </CardContent>
      {convDialog && (
        <StudentConversationsDialog
          open={!!convDialog}
          onOpenChange={(v) => !v && setConvDialog(null)}
          studentId={convDialog.id}
          studentName={convDialog.name}
        />
      )}
    </Card>

      {/* Right sidebar — class overview, unit mastery, follow-up */}
      <div className="space-y-4">
        {/* Class overview donut */}
        <Card className="hover-lift">
          <CardHeader className="pb-2">
            <CardTitle className="text-base">Class overview</CardTitle>
          </CardHeader>
          <CardContent className="flex flex-col items-center gap-4">
            <ProgressRing value={classCompletion} size={132} strokeWidth={11}>
              <span className="font-tabular text-3xl font-bold leading-none">
                <CountUp value={summary.total} />
              </span>
              <span className="text-[11px] text-muted-foreground mt-0.5">students</span>
            </ProgressRing>
            <ul className="w-full space-y-2 text-sm">
              <li className="flex items-center justify-between">
                <span className="flex items-center gap-2">
                  <span className="h-2.5 w-2.5 rounded-full bg-success" />
                  On track
                </span>
                <span className="font-tabular text-muted-foreground"><CountUp value={summary.onTrack} /></span>
              </li>
              <li className="flex items-center justify-between">
                <span className="flex items-center gap-2">
                  <span className="h-2.5 w-2.5 rounded-full bg-warning" />
                  Needs support
                </span>
                <span className="font-tabular text-muted-foreground"><CountUp value={summary.behind} /></span>
              </li>
              <li className="flex items-center justify-between">
                <span className="flex items-center gap-2">
                  <span className="h-2.5 w-2.5 rounded-full bg-destructive" />
                  Missing
                </span>
                <span className="font-tabular text-muted-foreground"><CountUp value={summary.missing} /></span>
              </li>
              {summary.noWork > 0 && (
                <li className="flex items-center justify-between">
                  <span className="flex items-center gap-2">
                    <span className="h-2.5 w-2.5 rounded-full bg-muted-foreground/40" />
                    No data yet
                  </span>
                  <span className="font-tabular text-muted-foreground"><CountUp value={summary.noWork} /></span>
                </li>
              )}
            </ul>
          </CardContent>
        </Card>

        {/* Unit mastery bars */}
        {unitMastery.length > 0 && (
          <Card className="hover-lift">
            <CardHeader className="pb-2">
              <CardTitle className="text-base">Unit mastery</CardTitle>
            </CardHeader>
            <CardContent className="space-y-3">
              {unitMastery.map((u) => (
                <div key={u.unit}>
                  <div className="flex items-center justify-between mb-1 text-sm">
                    <span className="truncate font-medium">{u.unit}</span>
                    <span className="font-tabular text-xs text-muted-foreground">{u.pct}%</span>
                  </div>
                  <div className="h-2 rounded-full bg-secondary overflow-hidden">
                    <div
                      className={`h-full transition-all ${barColor(u.pct / 100)}`}
                      style={{ width: `${u.pct}%` }}
                    />
                  </div>
                </div>
              ))}
            </CardContent>
          </Card>
        )}

        {/* Follow up with care */}
        <Card className="bg-primary-soft border-primary/20">
          <CardContent className="p-4 flex flex-col gap-3">
            <div className="flex items-start gap-3">
              <span className="h-9 w-9 rounded-xl bg-primary-soft text-primary flex items-center justify-center shrink-0">
                <MessagesSquare className="h-4 w-4" />
              </span>
              <div>
                <h3 className="text-base">Follow up with care</h3>
                <p className="text-sm text-muted-foreground">
                  Expand a student row to review their work and start a supportive conversation.
                </p>
              </div>
            </div>
          </CardContent>
        </Card>
      </div>
    </div>
  );
};