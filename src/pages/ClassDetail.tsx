import { useEffect, useState } from "react";
import { Link, useNavigate, useParams } from "react-router-dom";
import { ArrowLeft, BookOpen, ClipboardList, Coins, Layers, Pencil, Save, Users, Copy, X } from "lucide-react";
import { useAuth } from "@/hooks/useAuth";
import { supabase } from "@/integrations/supabase/client";
import { DashboardShell } from "@/components/DashboardShell";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Textarea } from "@/components/ui/textarea";
import { Switch } from "@/components/ui/switch";
import { Label } from "@/components/ui/label";
import { Input } from "@/components/ui/input";
import { Checkbox } from "@/components/ui/checkbox";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { RadioGroup, RadioGroupItem } from "@/components/ui/radio-group";
import { StudentAvatar } from "@/components/StudentAvatar";
import { EmptyState } from "@/components/EmptyState";
import { ClassModules } from "@/components/modules/ClassModules";
import { ConfirmDialog } from "@/components/ConfirmDialog";
import { IconButton } from "@/components/IconButton";
import { toast } from "sonner";

type ClassRow = {
  id: string;
  name: string;
  subject: string;
  syllabus: string | null;
  teacher_id: string;
  join_code: string;
  leaderboard_anonymous: boolean;
  daily_practice_enabled: boolean;
};

type Member = { id: string; name: string; items: string[]; isTeacher?: boolean };

export default function ClassDetail() {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const { user, role } = useAuth();
  const [cls, setCls] = useState<ClassRow | null>(null);
  const [members, setMembers] = useState<Member[]>([]);
  const [assignments, setAssignments] = useState<{ id: string; title: string; due_date: string | null }[]>([]);
  const [loading, setLoading] = useState(true);
  const [editingSyllabus, setEditingSyllabus] = useState(false);
  const [syllabusDraft, setSyllabusDraft] = useState("");
  const [savingSyllabus, setSavingSyllabus] = useState(false);
  const [toRemove, setToRemove] = useState<Member | null>(null);
  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set());
  const [awardOpen, setAwardOpen] = useState(false);
  const [awardTargets, setAwardTargets] = useState<Member[]>([]);
  const [awardCurrency, setAwardCurrency] = useState<"star" | "crown">("star");
  const [awardAmount, setAwardAmount] = useState<string>("1");
  const [awardReason, setAwardReason] = useState("");
  const [awarding, setAwarding] = useState(false);

  const isTeacher = !!cls && !!user && cls.teacher_id === user.id;

  const studentMembers = members.filter((m) => !m.isTeacher);

  const openAward = (targets: Member[]) => {
    setAwardTargets(targets);
    setAwardCurrency("star");
    setAwardAmount("1");
    setAwardReason("");
    setAwardOpen(true);
  };

  const submitAward = async () => {
    if (!cls || awardTargets.length === 0) return;
    const amt = parseInt(awardAmount, 10);
    if (!Number.isFinite(amt) || amt <= 0) {
      toast.error("Enter a positive amount");
      return;
    }
    setAwarding(true);
    const { data, error } = await supabase.rpc("teacher_award_coins", {
      _class_id: cls.id,
      _student_ids: awardTargets.map((t) => t.id),
      _currency: awardCurrency,
      _amount: amt,
      _reason: awardReason.trim() || null,
    });
    setAwarding(false);
    if (error) { toast.error(error.message); return; }
    const n = (data as number) ?? awardTargets.length;
    const label = awardCurrency === "star" ? "Star" : "Crown";
    toast.success(`Awarded ${amt} ${label} Coin${amt === 1 ? "" : "s"} to ${n} student${n === 1 ? "" : "s"}`);
    setAwardOpen(false);
    setSelectedIds(new Set());
  };

  useEffect(() => {
    if (!id) return;
    (async () => {
      setLoading(true);
      const { data: c, error } = await supabase
        .from("classes")
        .select("id, name, subject, syllabus, teacher_id, join_code, leaderboard_anonymous, daily_practice_enabled")
        .eq("id", id).maybeSingle();
      if (error || !c) {
        toast.error("Couldn't load this class.");
        setLoading(false);
        return;
      }
      setCls(c as ClassRow);
      setSyllabusDraft(c.syllabus ?? "");

      // Members
      const { data: cm } = await supabase
        .from("class_members").select("student_id").eq("class_id", id);
      const userIds = new Set<string>([c.teacher_id, ...(cm ?? []).map((m: any) => m.student_id)]);
      const { data: profs } = await supabase
        .from("profiles").select("id, full_name, avatar_items")
        .in("id", Array.from(userIds));
      const pmap = new Map<string, { name: string; items: string[] }>();
      (profs ?? []).forEach((p: any) =>
        pmap.set(p.id, { name: p.full_name || "User", items: (p.avatar_items ?? []) as string[] }));
      const t = pmap.get(c.teacher_id);
      const list: Member[] = [{ id: c.teacher_id, name: t?.name ?? "Teacher", items: t?.items ?? [], isTeacher: true }];
      (cm ?? []).forEach((m: any) => {
        const p = pmap.get(m.student_id);
        list.push({ id: m.student_id, name: p?.name ?? "Student", items: p?.items ?? [] });
      });
      setMembers(list);

      const { data: asgn } = await supabase
        .from("assignments").select("id, title, due_date")
        .eq("class_id", id).order("created_at", { ascending: false });
      setAssignments((asgn ?? []) as any);
      setLoading(false);
    })();
  }, [id]);

  const saveSyllabus = async () => {
    if (!cls) return;
    setSavingSyllabus(true);
    const { error } = await supabase.from("classes")
      .update({ syllabus: syllabusDraft.trim() || null })
      .eq("id", cls.id);
    setSavingSyllabus(false);
    if (error) { toast.error(error.message); return; }
    setCls({ ...cls, syllabus: syllabusDraft.trim() || null });
    setEditingSyllabus(false);
    toast.success("Syllabus saved");
  };

  const copyCode = () => {
    if (!cls) return;
    navigator.clipboard.writeText(cls.join_code);
    toast.success("Join code copied");
  };

  const removeStudent = async (m: Member) => {
    if (!cls) return;
    // Notify first (RLS requires the student to still be in the class)
    const { error: nerr } = await supabase.from("notifications").insert({
      user_id: m.id,
      type: "class_removed",
      message: `You have been removed from ${cls.name} by your teacher.`,
      link: "/student",
    });
    if (nerr) console.warn("notify failed:", nerr.message);

    const { error } = await supabase
      .from("class_members")
      .delete()
      .eq("class_id", cls.id)
      .eq("student_id", m.id);
    if (error) { toast.error(error.message); return; }
    setMembers((prev) => prev.filter((x) => x.id !== m.id));
    toast.success(`${m.name} removed from class`);
  };

  if (loading || !cls) {
    return (
      <DashboardShell title="Class">
        <p className="text-sm text-muted-foreground">Loading...</p>
      </DashboardShell>
    );
  }

  const backHref = role === "teacher" ? "/teacher/classes" : "/student/classes";

  return (
    <DashboardShell
      title={cls.name}
      subtitle={cls.subject}
      actions={
        <div className="flex items-center gap-2">
          {isTeacher && (
            <button
              onClick={copyCode}
              className="font-mono text-xs px-2 py-1 rounded bg-secondary hover:bg-accent inline-flex items-center gap-1.5"
              aria-label={`Copy join code ${cls.join_code}`}
            >
              {cls.join_code}<Copy className="h-3 w-3" />
            </button>
          )}
          <Button variant="ghost" size="sm" onClick={() => navigate(backHref)}>
            <ArrowLeft className="h-4 w-4 mr-1" />Back
          </Button>
        </div>
      }
    >
      <Tabs defaultValue="modules" className="space-y-4">
        <TabsList>
          <TabsTrigger value="overview"><BookOpen className="h-4 w-4 mr-1.5" />Overview</TabsTrigger>
          <TabsTrigger value="modules"><Layers className="h-4 w-4 mr-1.5" />Modules</TabsTrigger>
          <TabsTrigger value="assignments"><ClipboardList className="h-4 w-4 mr-1.5" />Assignments</TabsTrigger>
          <TabsTrigger value="members"><Users className="h-4 w-4 mr-1.5" />Members</TabsTrigger>
        </TabsList>

        <TabsContent value="overview">
          <Card>
            <CardHeader className="flex flex-row items-center justify-between gap-2">
              <div>
                <CardTitle className="text-base">Welcome & syllabus</CardTitle>
                <CardDescription>An overview of the course.</CardDescription>
              </div>
              {isTeacher && !editingSyllabus && (
                <Button size="sm" variant="outline" onClick={() => setEditingSyllabus(true)}>
                  <Pencil className="h-4 w-4 mr-1" />Edit
                </Button>
              )}
            </CardHeader>
            <CardContent>
              {editingSyllabus ? (
                <div className="space-y-3">
                  <Textarea
                    rows={10}
                    value={syllabusDraft}
                    onChange={(e) => setSyllabusDraft(e.target.value)}
                    placeholder="Write a welcome message and course overview..."
                  />
                  <div className="flex gap-2 justify-end">
                    <Button variant="ghost" size="sm" onClick={() => { setEditingSyllabus(false); setSyllabusDraft(cls.syllabus ?? ""); }}>
                      Cancel
                    </Button>
                    <Button size="sm" onClick={saveSyllabus} disabled={savingSyllabus}>
                      <Save className="h-4 w-4 mr-1" />{savingSyllabus ? "Saving..." : "Save"}
                    </Button>
                  </div>
                </div>
              ) : cls.syllabus ? (
                <p className="whitespace-pre-wrap text-sm leading-relaxed">{cls.syllabus}</p>
              ) : (
                <EmptyState
                  icon={BookOpen}
                  title="No syllabus yet"
                  description={isTeacher ? "Add a welcome message and overview for your students." : "Your teacher hasn't added a syllabus yet."}
                  action={isTeacher ? (
                    <Button size="sm" onClick={() => setEditingSyllabus(true)}>
                      <Pencil className="h-4 w-4 mr-1" />Add syllabus
                    </Button>
                  ) : undefined}
                />
              )}
            </CardContent>
          </Card>

          {isTeacher && (
            <Card className="mt-4">
              <CardHeader>
                <CardTitle className="text-base">Class settings</CardTitle>
                <CardDescription>Control how this class appears to students.</CardDescription>
              </CardHeader>
              <CardContent>
                <div className="flex items-center justify-between rounded-lg border bg-muted/40 px-4 py-3">
                  <div className="pr-4">
                    <Label className="text-sm font-medium">Anonymous leaderboard</Label>
                    <p className="text-xs text-muted-foreground mt-0.5">
                      When on, students see leaderboard usernames instead of real names on this class's leaderboard.
                    </p>
                  </div>
                  <Switch
                    checked={!!cls.leaderboard_anonymous}
                    onCheckedChange={async (v) => {
                      setCls({ ...cls, leaderboard_anonymous: v });
                      const { error } = await supabase.from("classes")
                        .update({ leaderboard_anonymous: v }).eq("id", cls.id);
                      if (error) toast.error(error.message);
                      else toast.success(v ? "Anonymous leaderboard on" : "Anonymous leaderboard off");
                    }}
                  />
                </div>
                <div className="flex items-center justify-between rounded-lg border bg-muted/40 px-4 py-3 mt-3">
                  <div className="pr-4">
                    <Label className="text-sm font-medium">Daily Practice</Label>
                    <p className="text-xs text-muted-foreground mt-0.5">
                      When on, students must complete a short daily practice session to maintain their streak for this class.
                    </p>
                  </div>
                  <Switch
                    checked={!!cls.daily_practice_enabled}
                    onCheckedChange={async (v) => {
                      setCls({ ...cls, daily_practice_enabled: v });
                      const { error } = await supabase.from("classes")
                        .update({ daily_practice_enabled: v }).eq("id", cls.id);
                      if (error) toast.error(error.message);
                      else toast.success(v ? "Daily Practice enabled" : "Daily Practice disabled");
                    }}
                  />
                </div>
              </CardContent>
            </Card>
          )}
        </TabsContent>

        <TabsContent value="modules">
          <ClassModules classId={cls.id} isTeacher={isTeacher} />
        </TabsContent>

        <TabsContent value="assignments">
          <Card>
            <CardHeader>
              <CardTitle className="text-base">Assignments</CardTitle>
              <CardDescription>All assignments for this class.</CardDescription>
            </CardHeader>
            <CardContent>
              {assignments.length === 0 ? (
                <EmptyState icon={ClipboardList} title="No assignments yet" />
              ) : (
                <ul className="divide-y divide-border">
                  {assignments.map((a) => {
                    const href = role === "teacher" ? `/teacher/assignments/${a.id}` : `/student/assignments/${a.id}`;
                    return (
                      <li key={a.id}>
                        <Link to={href} className="flex items-center justify-between py-3 -mx-2 px-2 rounded-md hover:bg-muted/40 transition-colors">
                          <span className="font-medium truncate">{a.title}</span>
                          {a.due_date && (
                            <span className="text-xs text-muted-foreground">
                              Due {new Date(a.due_date).toLocaleDateString()}
                            </span>
                          )}
                        </Link>
                      </li>
                    );
                  })}
                </ul>
              )}
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="members">
          <Card>
            <CardHeader>
              <CardTitle className="text-base">Members</CardTitle>
              <CardDescription>{members.length} {members.length === 1 ? "person" : "people"} in this class.</CardDescription>
            </CardHeader>
            <CardContent>
              {isTeacher && studentMembers.length > 0 && (
                <div className="flex items-center justify-between mb-3 p-2 rounded-md bg-muted/40">
                  <div className="flex items-center gap-2 text-sm">
                    <Checkbox
                      checked={selectedIds.size === studentMembers.length && studentMembers.length > 0}
                      onCheckedChange={(v) => {
                        if (v) setSelectedIds(new Set(studentMembers.map((m) => m.id)));
                        else setSelectedIds(new Set());
                      }}
                    />
                    <span>{selectedIds.size} selected</span>
                  </div>
                  <Button
                    size="sm"
                    disabled={selectedIds.size === 0}
                    onClick={() => openAward(studentMembers.filter((m) => selectedIds.has(m.id)))}
                  >
                    <Coins className="h-4 w-4 mr-1.5" />Give coins to selected
                  </Button>
                </div>
              )}
              <ul className="flex flex-wrap gap-3">
                {members.map((m) => (
                  <li key={m.id} className="inline-flex items-center gap-2 rounded-lg border border-border px-3 py-2">
                    {isTeacher && !m.isTeacher && (
                      <Checkbox
                        checked={selectedIds.has(m.id)}
                        onCheckedChange={(v) => {
                          setSelectedIds((prev) => {
                            const next = new Set(prev);
                            if (v) next.add(m.id); else next.delete(m.id);
                            return next;
                          });
                        }}
                        aria-label={`Select ${m.name}`}
                      />
                    )}
                    <StudentAvatar size="sm" name={m.name} items={m.items} />
                    <span className="text-sm">
                      {m.id === user?.id ? "You" : m.name}
                      {m.isTeacher && <span className="ml-1 text-xs text-muted-foreground">(Teacher)</span>}
                    </span>
                    {isTeacher && !m.isTeacher && (
                      <Button
                        size="sm"
                        variant="outline"
                        className="h-7 px-2"
                        onClick={() => openAward([m])}
                      >
                        <Coins className="h-3.5 w-3.5 mr-1" />Give coins
                      </Button>
                    )}
                    {isTeacher && !m.isTeacher && (
                      <IconButton label={`Remove ${m.name}`} onClick={() => setToRemove(m)}>
                        <X className="h-4 w-4 text-muted-foreground" />
                      </IconButton>
                    )}
                  </li>
                ))}
              </ul>
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>
      <ConfirmDialog
        open={!!toRemove}
        onOpenChange={(o) => !o && setToRemove(null)}
        title="Remove student?"
        description={toRemove ? `Are you sure you want to remove ${toRemove.name} from this class? This cannot be undone.` : ""}
        confirmLabel="Remove"
        destructive
        onConfirm={async () => { if (toRemove) await removeStudent(toRemove); }}
      />
      <Dialog open={awardOpen} onOpenChange={setAwardOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Give coins</DialogTitle>
            <DialogDescription>
              {awardTargets.length === 1
                ? `Award coins to ${awardTargets[0]?.name}.`
                : `Award the same coins to ${awardTargets.length} students.`}
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-4">
            <div>
              <Label className="text-sm">Coin type</Label>
              <RadioGroup
                value={awardCurrency}
                onValueChange={(v) => setAwardCurrency(v as "star" | "crown")}
                className="flex gap-4 mt-2"
              >
                <label className="flex items-center gap-2 text-sm cursor-pointer">
                  <RadioGroupItem value="star" id="award-star" />
                  <span>⭐ Star Coins</span>
                </label>
                <label className="flex items-center gap-2 text-sm cursor-pointer">
                  <RadioGroupItem value="crown" id="award-crown" />
                  <span>👑 Crown Coins</span>
                </label>
              </RadioGroup>
            </div>
            <div>
              <Label htmlFor="award-amount" className="text-sm">Amount</Label>
              <Input
                id="award-amount"
                type="number"
                min={1}
                value={awardAmount}
                onChange={(e) => setAwardAmount(e.target.value)}
                className="mt-1"
              />
            </div>
            <div>
              <Label htmlFor="award-reason" className="text-sm">Reason (optional)</Label>
              <Textarea
                id="award-reason"
                rows={3}
                value={awardReason}
                onChange={(e) => setAwardReason(e.target.value)}
                placeholder='e.g. "Great participation today"'
                className="mt-1"
              />
            </div>
          </div>
          <DialogFooter>
            <Button variant="ghost" onClick={() => setAwardOpen(false)} disabled={awarding}>Cancel</Button>
            <Button onClick={submitAward} disabled={awarding}>
              <Save className="h-4 w-4 mr-1" />{awarding ? "Saving..." : "Save"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </DashboardShell>
  );
}