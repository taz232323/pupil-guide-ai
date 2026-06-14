import { useEffect, useState } from "react";
import { Link, useNavigate, useParams } from "react-router-dom";
import { ArrowLeft, BookOpen, ClipboardList, Coins, Layers, Pencil, Save, Users, Copy, X, HelpCircle, Plus, Trash2, Loader2, ShieldCheck, HeartPulse, Send, Clock3, CheckCircle2, AlertTriangle, Sparkles } from "lucide-react";
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
import { Badge } from "@/components/ui/badge";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { RadioGroup, RadioGroupItem } from "@/components/ui/radio-group";
import { StudentAvatar } from "@/components/StudentAvatar";
import { EmptyState } from "@/components/EmptyState";
import { AiPracticeQuestionDialog, type GeneratedQuestion } from "@/components/AiPracticeQuestionDialog";
import { ClassModules } from "@/components/modules/ClassModules";
import { ConfirmDialog } from "@/components/ConfirmDialog";
import { IconButton } from "@/components/IconButton";
import { getMoodOption } from "@/lib/moodCheckins";
import { Reveal } from "@/components/Reveal";
import { MountainSketch } from "@/components/MountainSketch";
import { cn } from "@/lib/utils";
import { celebrate } from "@/lib/confetti";
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

const ASSIGNMENT_TILE = [
  "bg-primary-soft text-primary",
  "bg-success-soft text-success",
  "bg-plum-soft text-plum",
  "bg-warning-soft text-warning",
];

type PracticeQuestion = {
  id: string;
  class_id: string;
  question_type: "multiple_choice" | "short_answer";
  prompt: string;
  options: string[] | null;
  correct_index: number | null;
  expected_answer: string | null;
};

type AwardKind = "star" | "crown" | "shield";

type MoodCheckIn = {
  id: string;
  class_id: string;
  teacher_id: string;
  student_id: string;
  prompt: string;
  mood_key: string | null;
  note: string | null;
  wants_help: boolean;
  created_at: string;
  responded_at: string | null;
};

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
  const [awardKind, setAwardKind] = useState<AwardKind>("star");
  const [awardAmount, setAwardAmount] = useState<string>("1");
  const [awardReason, setAwardReason] = useState("");
  const [awarding, setAwarding] = useState(false);
  const [moodCheckIns, setMoodCheckIns] = useState<MoodCheckIn[]>([]);
  const [moodOpen, setMoodOpen] = useState(false);
  const [moodTargets, setMoodTargets] = useState<Member[]>([]);
  const [moodPrompt, setMoodPrompt] = useState("How are you feeling today?");
  const [sendingMood, setSendingMood] = useState(false);
  
  // Practice Question Bank state
  const [practiceQuestions, setPracticeQuestions] = useState<PracticeQuestion[]>([]);
  const [editingQuestion, setEditingQuestion] = useState<Partial<PracticeQuestion> | null>(null);
  const [savingQuestion, setSavingQuestion] = useState(false);
  const [aiOpen, setAiOpen] = useState(false);
  const [showPracticePrompt, setShowPracticePrompt] = useState(false);

  const isTeacher = !!cls && !!user && cls.teacher_id === user.id;

  const studentMembers = members.filter((m) => !m.isTeacher);

  const getMember = (studentId: string) => members.find((m) => m.id === studentId);

  const loadMoodCheckIns = async (classId: string) => {
    const { data, error } = await (supabase as any)
      .from("mood_checkins")
      .select("*")
      .eq("class_id", classId)
      .order("created_at", { ascending: false })
      .limit(30);

    if (error) {
      console.warn("mood check-ins load failed:", error.message);
      return;
    }

    setMoodCheckIns((data ?? []) as unknown as MoodCheckIn[]);
  };

  const openMoodCheckIn = (targets: Member[]) => {
    setMoodTargets(targets);
    setMoodPrompt("How are you feeling today?");
    setMoodOpen(true);
  };

  const sendMoodCheckIn = async () => {
    if (!cls || moodTargets.length === 0) return;
    const prompt = moodPrompt.trim() || "How are you feeling today?";
    if (prompt.length > 240) {
      toast.error("Keep the prompt under 240 characters");
      return;
    }

    setSendingMood(true);
    const { data, error } = await (supabase as any).rpc("teacher_send_mood_checkins", {
      _class_id: cls.id,
      _student_ids: moodTargets.map((target) => target.id),
      _prompt: prompt,
    });
    setSendingMood(false);

    if (error) {
      toast.error(error.message);
      return;
    }

    const count = (data as number) ?? moodTargets.length;
    toast.success(`Sent check-in to ${count} student${count === 1 ? "" : "s"}`);
    setMoodOpen(false);
    setSelectedIds(new Set());
    void loadMoodCheckIns(cls.id);
  };

  const openAward = (targets: Member[]) => {
    setAwardTargets(targets);
    setAwardKind("star");
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
    const { data, error } = awardKind === "shield"
      ? await (supabase as any).rpc("teacher_award_streak_shields", {
          _class_id: cls.id,
          _student_ids: awardTargets.map((t) => t.id),
          _amount: amt,
          _reason: awardReason.trim() || null,
        })
      : await supabase.rpc("teacher_award_coins", {
          _class_id: cls.id,
          _student_ids: awardTargets.map((t) => t.id),
          _currency: awardKind,
          _amount: amt,
          _reason: awardReason.trim() || null,
        });
    setAwarding(false);
    if (error) { toast.error(error.message); return; }
    const n = (data as number) ?? awardTargets.length;
    const label = awardKind === "star" ? "Star Coin" : awardKind === "crown" ? "Crown Coin" : "Streak Shield";
    toast.success(`Awarded ${amt} ${label}${amt === 1 ? "" : "s"} to ${n} student${n === 1 ? "" : "s"}`);
    celebrate("small");
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
      
      // Load practice questions for teachers
      if (c.teacher_id === user?.id) {
        const { data: pqs } = await (supabase as any)
          .from("practice_question_bank")
          .select("*")
          .eq("class_id", id)
          .order("created_at", { ascending: false });
        setPracticeQuestions((pqs ?? []) as PracticeQuestion[]);
        
        // Check if we should show the first-time prompt
        if (c.daily_practice_enabled) {
          const { data: dismissed } = await (supabase as any)
            .from("teacher_dismissed_prompts")
            .select("id")
            .eq("teacher_id", user.id)
            .eq("prompt_key", "practice_question_bank_intro")
            .eq("class_id", id)
            .maybeSingle();
          if (!dismissed) {
            setShowPracticePrompt(true);
          }
        }

        await loadMoodCheckIns(id);
      } else {
        setMoodCheckIns([]);
      }
      setLoading(false);
    })();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [id, user]);

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

  const savePracticeQuestion = async (q: Partial<PracticeQuestion>) => {
    if (!cls || !user) return;
    setSavingQuestion(true);
    
    if (q.id) {
      // Update existing
      const { error } = await (supabase as any)
        .from("practice_question_bank")
        .update({
          question_type: q.question_type,
          prompt: q.prompt,
          options: q.options,
          correct_index: q.correct_index,
          expected_answer: q.expected_answer,
        })
        .eq("id", q.id);
      if (error) { toast.error(error.message); setSavingQuestion(false); return; }
      setPracticeQuestions((prev) => prev.map((x) => x.id === q.id ? { ...x, ...q } as PracticeQuestion : x));
    } else {
      // Insert new
      const { data, error } = await (supabase as any)
        .from("practice_question_bank")
        .insert({
          class_id: cls.id,
          teacher_id: user.id,
          question_type: q.question_type!,
          prompt: q.prompt!,
          options: q.options,
          correct_index: q.correct_index,
          expected_answer: q.expected_answer,
        })
        .select()
        .single();
      if (error) { toast.error(error.message); setSavingQuestion(false); return; }
      setPracticeQuestions((prev) => [data as PracticeQuestion, ...prev]);
    }
    
    setEditingQuestion(null);
    setSavingQuestion(false);
    toast.success("Question saved");
  };

  const deletePracticeQuestion = async (id: string) => {
    const { error } = await (supabase as any)
      .from("practice_question_bank")
      .delete()
      .eq("id", id);
    if (error) { toast.error(error.message); return; }
    setPracticeQuestions((prev) => prev.filter((x) => x.id !== id));
    toast.success("Question deleted");
  };

  const addGeneratedQuestions = async (questions: GeneratedQuestion[]) => {
    if (!cls || !user || questions.length === 0) return;

    const rows = questions.map((question) => ({
      class_id: cls.id,
      teacher_id: user.id,
      question_type: "multiple_choice" as const,
      prompt: question.prompt,
      options: question.options,
      correct_index: question.correctIndex,
      expected_answer: null,
    }));

    const { data, error } = await (supabase as any)
      .from("practice_question_bank")
      .insert(rows)
      .select();

    if (error) {
      throw new Error(error.message);
    }

    setPracticeQuestions((prev) => [...((data ?? []) as PracticeQuestion[]), ...prev]);
    const count = data?.length ?? questions.length;
    toast.success(`Added ${count} AI question${count === 1 ? "" : "s"} to the bank`);
  };

  const dismissPracticePrompt = async () => {
    if (!cls || !user) return;
    await (supabase as any)
      .from("teacher_dismissed_prompts")
      .insert({
        teacher_id: user.id,
        prompt_key: "practice_question_bank_intro",
        class_id: cls.id,
      });
    setShowPracticePrompt(false);
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
              className="inline-flex items-center gap-1.5 rounded-lg border border-primary/15 bg-primary-soft px-2 py-1 font-mono text-xs font-semibold text-primary transition-spring hover-lift"
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
      <div className="relative mb-4 hidden h-0 overflow-visible sm:block">
        <MountainSketch
          variant="peak"
          className="pointer-events-none absolute -top-16 right-0 w-56 text-muted-foreground/25"
        />
      </div>

      <Tabs defaultValue="modules" className="space-y-4">
        <TabsList className="flex w-full justify-start overflow-x-auto">
          <TabsTrigger value="overview"><BookOpen className="h-4 w-4 mr-1.5" />Overview</TabsTrigger>
          <TabsTrigger value="modules"><Layers className="h-4 w-4 mr-1.5" />Modules</TabsTrigger>
          <TabsTrigger value="assignments"><ClipboardList className="h-4 w-4 mr-1.5" />Assignments</TabsTrigger>
          {isTeacher && <TabsTrigger value="question-bank"><HelpCircle className="h-4 w-4 mr-1.5" />Question Bank</TabsTrigger>}
          <TabsTrigger value="members"><Users className="h-4 w-4 mr-1.5" />Members</TabsTrigger>
        </TabsList>

        <TabsContent value="overview">
          <Card className="hover-lift animate-fade-up">
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
            <Card className="mt-4 hover-lift animate-fade-up" style={{ animationDelay: "80ms" }}>
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
          <Card className="hover-lift animate-fade-up">
            <CardHeader>
              <CardTitle className="text-base">Assignments</CardTitle>
              <CardDescription>All assignments for this class.</CardDescription>
            </CardHeader>
            <CardContent>
              {assignments.length === 0 ? (
                <EmptyState icon={ClipboardList} title="No assignments yet" />
              ) : (
                <ul className="divide-y divide-border">
                  {assignments.map((a, i) => {
                    const href = role === "teacher" ? `/teacher/assignments/${a.id}` : `/student/assignments/${a.id}`;
                    return (
                      <Reveal as="li" key={a.id} delay={i * 50}>
                        <Link to={href} className="group flex items-center justify-between gap-3 py-3 -mx-2 px-2 rounded-xl hover:bg-muted/40 transition-spring">
                          <span className={cn(
                            "inline-flex h-9 w-9 shrink-0 items-center justify-center rounded-xl transition-spring group-hover:scale-110",
                            ASSIGNMENT_TILE[i % ASSIGNMENT_TILE.length],
                          )}>
                            <ClipboardList className="h-4 w-4" />
                          </span>
                          <span className="min-w-0 flex-1 font-medium truncate">{a.title}</span>
                          {a.due_date && (
                            <span className="shrink-0 text-xs text-muted-foreground">
                              Due {new Date(a.due_date).toLocaleDateString()}
                            </span>
                          )}
                        </Link>
                      </Reveal>
                    );
                  })}
                </ul>
              )}
            </CardContent>
          </Card>
        </TabsContent>

        {isTeacher && (
          <TabsContent value="question-bank">
            <Card className="hover-lift animate-fade-up">
              <CardHeader className="flex flex-row items-center justify-between gap-2">
                <div>
                  <CardTitle className="text-base">Practice Question Bank</CardTitle>
                  <CardDescription>
                    Add questions that will appear in students' daily practice sessions. AI will fill remaining slots with questions based on your lesson content.
                  </CardDescription>
                </div>
                <div className="flex flex-wrap justify-end gap-2">
                  <Button size="sm" variant="outline" onClick={() => setAiOpen(true)}>
                    <Sparkles className="h-4 w-4 mr-1" />Generate with AI
                  </Button>
                  <Button size="sm" onClick={() => setEditingQuestion({ question_type: "multiple_choice", options: ["", "", "", ""], correct_index: 0 })}>
                    <Plus className="h-4 w-4 mr-1" />Add Question
                  </Button>
                </div>
              </CardHeader>
              <CardContent>
                {practiceQuestions.length === 0 ? (
                  <EmptyState
                    icon={HelpCircle}
                    title="No questions yet"
                    description="Add practice questions to give students targeted daily practice. AI will also generate questions from your lesson content."
                    action={
                      <div className="flex flex-wrap justify-center gap-2">
                        <Button size="sm" onClick={() => setAiOpen(true)}>
                          <Sparkles className="h-4 w-4 mr-1" />Generate with AI
                        </Button>
                        <Button size="sm" variant="outline" onClick={() => setEditingQuestion({ question_type: "multiple_choice", options: ["", "", "", ""], correct_index: 0 })}>
                          <Plus className="h-4 w-4 mr-1" />Add manually
                        </Button>
                      </div>
                    }
                  />
                ) : (
                  <ul className="divide-y divide-border">
                    {practiceQuestions.map((q, i) => (
                      <Reveal as="li" key={q.id} delay={i * 50} className="py-3 flex items-start justify-between gap-3">
                        <div className="min-w-0 flex-1">
                          <div className="flex items-center gap-2 mb-1">
                            <span className="rounded-full bg-primary-soft px-2 py-0.5 text-xs font-semibold text-primary">
                              {q.question_type === "multiple_choice" ? "Multiple Choice" : "Short Answer"}
                            </span>
                          </div>
                          <p className="text-sm font-medium">{q.prompt}</p>
                          {q.question_type === "multiple_choice" && q.options && (
                            <ul className="mt-1 space-y-0.5">
                              {(q.options as string[]).map((opt, i) => (
                                <li key={i} className={cn("text-xs", i === q.correct_index ? "text-success font-medium" : "text-muted-foreground")}>
                                  {String.fromCharCode(65 + i)}. {opt} {i === q.correct_index && "correct"}
                                </li>
                              ))}
                            </ul>
                          )}
                          {q.question_type === "short_answer" && q.expected_answer && (
                            <p className="text-xs text-muted-foreground mt-1">Expected: {q.expected_answer}</p>
                          )}
                        </div>
                        <div className="flex gap-1 shrink-0">
                          <Button size="sm" variant="ghost" className="h-8 px-2" onClick={() => setEditingQuestion(q)}>
                            <Pencil className="h-3.5 w-3.5" />
                          </Button>
                          <Button size="sm" variant="ghost" className="h-8 px-2 text-destructive" onClick={() => deletePracticeQuestion(q.id)}>
                            <Trash2 className="h-3.5 w-3.5" />
                          </Button>
                        </div>
                      </Reveal>
                    ))}
                  </ul>
                )}
              </CardContent>
            </Card>
          </TabsContent>
        )}

        <TabsContent value="members">
          <Card className="hover-lift animate-fade-up">
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
                  <div className="flex flex-wrap justify-end gap-2">
                    <Button
                      size="sm"
                      variant="outline"
                      disabled={selectedIds.size === 0}
                      onClick={() => openMoodCheckIn(studentMembers.filter((m) => selectedIds.has(m.id)))}
                    >
                      <HeartPulse className="h-4 w-4 mr-1.5" />Check in selected
                    </Button>
                    <Button
                      size="sm"
                      disabled={selectedIds.size === 0}
                      onClick={() => openAward(studentMembers.filter((m) => selectedIds.has(m.id)))}
                    >
                      <Coins className="h-4 w-4 mr-1.5" />Give reward
                    </Button>
                  </div>
                </div>
              )}
              <ul className="flex flex-wrap gap-3">
                {members.map((m) => (
                  <li key={m.id} className="inline-flex items-center gap-2 rounded-xl border border-border bg-card px-3 py-2 transition-spring hover-lift">
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
                        onClick={() => openMoodCheckIn([m])}
                      >
                        <HeartPulse className="h-3.5 w-3.5 mr-1" />Check in
                      </Button>
                    )}
                    {isTeacher && !m.isTeacher && (
                      <Button
                        size="sm"
                        variant="outline"
                        className="h-7 px-2"
                        onClick={() => openAward([m])}
                      >
                        <Coins className="h-3.5 w-3.5 mr-1" />Reward
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

              {isTeacher && (
                <div className="mt-6 rounded-xl border border-border bg-muted/30 p-4">
                  <div className="flex flex-wrap items-center justify-between gap-2">
                    <div>
                      <h3 className="text-sm font-semibold">Recent check-ins</h3>
                      <p className="text-xs text-muted-foreground">Private responses from students in this class.</p>
                    </div>
                    <Button size="sm" variant="ghost" onClick={() => loadMoodCheckIns(cls.id)}>
                      Refresh
                    </Button>
                  </div>
                  {moodCheckIns.length === 0 ? (
                    <div className="mt-4 rounded-lg border border-dashed bg-card p-5 text-center text-sm text-muted-foreground">
                      No check-ins sent yet.
                    </div>
                  ) : (
                    <ul className="mt-4 divide-y divide-border rounded-lg border bg-card">
                      {moodCheckIns.map((row) => {
                        const student = getMember(row.student_id);
                        const mood = getMoodOption(row.mood_key);
                        return (
                          <li key={row.id} className="p-3">
                            <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
                              <div className="flex min-w-0 items-start gap-3">
                                <StudentAvatar size="sm" name={student?.name ?? "Student"} items={student?.items ?? []} />
                                <div className="min-w-0">
                                  <div className="flex flex-wrap items-center gap-2">
                                    <p className="text-sm font-semibold">{student?.name ?? "Student"}</p>
                                    {row.responded_at ? (
                                      <Badge variant="outline" className="gap-1 text-success">
                                        <CheckCircle2 className="h-3 w-3" /> Responded
                                      </Badge>
                                    ) : (
                                      <Badge variant="secondary" className="gap-1">
                                        <Clock3 className="h-3 w-3" /> Pending
                                      </Badge>
                                    )}
                                    {row.wants_help && (
                                      <Badge variant="destructive" className="gap-1">
                                        <AlertTriangle className="h-3 w-3" /> Wants help
                                      </Badge>
                                    )}
                                  </div>
                                  <p className="mt-1 text-xs text-muted-foreground line-clamp-2">{row.prompt}</p>
                                  {row.note && (
                                    <p className="mt-2 rounded-lg bg-muted/60 px-3 py-2 text-sm leading-relaxed">
                                      {row.note}
                                    </p>
                                  )}
                                </div>
                              </div>
                              <div className="shrink-0 text-left sm:text-right">
                                {mood ? (
                                  <Badge variant="outline" className="text-sm">
                                    <span className="mr-1" aria-hidden="true">{mood.emoji}</span>{mood.label}
                                  </Badge>
                                ) : (
                                  <Badge variant="outline">No answer yet</Badge>
                                )}
                                <p className="mt-1 text-[11px] text-muted-foreground">
                                  {new Date(row.responded_at ?? row.created_at).toLocaleString([], {
                                    month: "short",
                                    day: "numeric",
                                    hour: "numeric",
                                    minute: "2-digit",
                                  })}
                                </p>
                              </div>
                            </div>
                          </li>
                        );
                      })}
                    </ul>
                  )}
                </div>
              )}
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
      <Dialog open={moodOpen} onOpenChange={setMoodOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Send check-in</DialogTitle>
            <DialogDescription>
              {moodTargets.length === 1
                ? `Ask ${moodTargets[0]?.name} how they are feeling.`
                : `Ask ${moodTargets.length} students how they are feeling.`}
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-4">
            <div className="rounded-lg border bg-muted/40 p-3">
              <p className="text-xs font-medium uppercase tracking-wide text-muted-foreground">Students</p>
              <div className="mt-2 flex flex-wrap gap-2">
                {moodTargets.map((target) => (
                  <span key={target.id} className="inline-flex items-center gap-1.5 rounded-full bg-card px-2.5 py-1 text-xs font-medium">
                    <StudentAvatar size="sm" name={target.name} items={target.items} />
                    {target.name}
                  </span>
                ))}
              </div>
            </div>
            <div>
              <Label htmlFor="mood-prompt" className="text-sm">Prompt</Label>
              <Textarea
                id="mood-prompt"
                rows={3}
                value={moodPrompt}
                maxLength={240}
                onChange={(event) => setMoodPrompt(event.target.value)}
                placeholder="How are you feeling today?"
                className="mt-1"
              />
              <p className="mt-1 text-xs text-muted-foreground">{moodPrompt.length}/240</p>
            </div>
          </div>
          <DialogFooter>
            <Button variant="ghost" onClick={() => setMoodOpen(false)} disabled={sendingMood}>Cancel</Button>
            <Button onClick={sendMoodCheckIn} disabled={sendingMood || moodTargets.length === 0}>
              {sendingMood ? <Loader2 className="h-4 w-4 mr-1 animate-spin" /> : <Send className="h-4 w-4 mr-1" />}
              {sendingMood ? "Sending..." : "Send"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
      <Dialog open={awardOpen} onOpenChange={setAwardOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Give reward</DialogTitle>
            <DialogDescription>
              {awardTargets.length === 1
                ? `Award a classroom reward to ${awardTargets[0]?.name}.`
                : `Award the same classroom reward to ${awardTargets.length} students.`}
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-4">
            <div>
              <Label className="text-sm">Reward type</Label>
              <RadioGroup
                value={awardKind}
                onValueChange={(v) => setAwardKind(v as AwardKind)}
                className="grid gap-2 mt-2 sm:grid-cols-3"
              >
                <label className="flex items-center gap-2 text-sm cursor-pointer">
                  <RadioGroupItem value="star" id="award-star" />
                  <span>⭐ Star Coins</span>
                </label>
                <label className="flex items-center gap-2 text-sm cursor-pointer">
                  <RadioGroupItem value="crown" id="award-crown" />
                  <span>👑 Crown Coins</span>
                </label>
                <label className="flex items-center gap-2 text-sm cursor-pointer">
                  <RadioGroupItem value="shield" id="award-shield" />
                  <span className="inline-flex items-center gap-1">
                    <ShieldCheck className="h-3.5 w-3.5" /> Streak Shields
                  </span>
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

      {/* Practice Question Dialog */}
      <PracticeQuestionDialog
        value={editingQuestion}
        onClose={() => setEditingQuestion(null)}
        onSave={savePracticeQuestion}
        saving={savingQuestion}
      />

      {cls && (
        <AiPracticeQuestionDialog
          open={aiOpen}
          onClose={() => setAiOpen(false)}
          classId={cls.id}
          onAdd={addGeneratedQuestions}
        />
      )}

      {/* First-time Daily Practice Prompt */}
      <Dialog open={showPracticePrompt} onOpenChange={setShowPracticePrompt}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <HelpCircle className="h-5 w-5 text-primary" />
              Set up your Question Bank
            </DialogTitle>
            <DialogDescription>
              Add practice questions to your question bank so students get the most relevant daily practice. You can also let AI generate questions from your lesson content automatically.
            </DialogDescription>
          </DialogHeader>
          <div className="rounded-lg border bg-muted/40 p-4 text-sm">
            <p className="font-medium mb-2">How it works:</p>
            <ul className="space-y-1 text-muted-foreground">
              <li>• Your questions appear first in each student's daily practice</li>
              <li>• AI fills remaining slots with questions based on your modules and lessons</li>
              <li>• Students need to complete at least 5 questions daily to maintain their streak</li>
            </ul>
          </div>
          <DialogFooter>
            <Button variant="ghost" onClick={dismissPracticePrompt}>Maybe later</Button>
            <Button onClick={() => { dismissPracticePrompt(); document.querySelector<HTMLButtonElement>('[value="question-bank"]')?.click(); }}>
              <Plus className="h-4 w-4 mr-1" />Go to Question Bank
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </DashboardShell>
  );
}

/* -------------- Practice Question Dialog -------------- */
function PracticeQuestionDialog({ value, onClose, onSave, saving }: {
  value: Partial<PracticeQuestion> | null;
  onClose: () => void;
  onSave: (q: Partial<PracticeQuestion>) => void;
  saving: boolean;
}) {
  const [questionType, setQuestionType] = useState<"multiple_choice" | "short_answer">("multiple_choice");
  const [prompt, setPrompt] = useState("");
  const [options, setOptions] = useState<string[]>(["", "", "", ""]);
  const [correctIndex, setCorrectIndex] = useState(0);
  const [expectedAnswer, setExpectedAnswer] = useState("");

  useEffect(() => {
    if (!value) return;
    setQuestionType(value.question_type || "multiple_choice");
    setPrompt(value.prompt || "");
    setOptions((value.options as string[]) || ["", "", "", ""]);
    setCorrectIndex(value.correct_index ?? 0);
    setExpectedAnswer(value.expected_answer || "");
  }, [value]);

  if (!value) return null;

  const submit = () => {
    if (!prompt.trim()) {
      toast.error("Question text is required");
      return;
    }
    if (questionType === "multiple_choice") {
      const filledOptions = options.filter((o) => o.trim());
      if (filledOptions.length < 2) {
        toast.error("At least 2 options are required");
        return;
      }
    }
    onSave({
      ...value,
      question_type: questionType,
      prompt: prompt.trim(),
      options: questionType === "multiple_choice" ? options : null,
      correct_index: questionType === "multiple_choice" ? correctIndex : null,
      expected_answer: questionType === "short_answer" ? expectedAnswer.trim() : null,
    });
  };

  return (
    <Dialog open={!!value} onOpenChange={(o) => !o && onClose()}>
      <DialogContent className="max-w-lg">
        <DialogHeader>
          <DialogTitle>{value.id ? "Edit Question" : "Add Question"}</DialogTitle>
        </DialogHeader>
        <div className="space-y-4">
          <div>
            <Label className="text-sm">Question Type</Label>
            <RadioGroup
              value={questionType}
              onValueChange={(v) => setQuestionType(v as "multiple_choice" | "short_answer")}
              className="flex gap-4 mt-2"
            >
              <label className="flex items-center gap-2 text-sm cursor-pointer">
                <RadioGroupItem value="multiple_choice" />
                <span>Multiple Choice</span>
              </label>
              <label className="flex items-center gap-2 text-sm cursor-pointer">
                <RadioGroupItem value="short_answer" />
                <span>Short Answer</span>
              </label>
            </RadioGroup>
          </div>
          <div>
            <Label htmlFor="q-prompt" className="text-sm">Question</Label>
            <Textarea
              id="q-prompt"
              rows={3}
              value={prompt}
              onChange={(e) => setPrompt(e.target.value)}
              placeholder="Enter your question..."
              className="mt-1"
            />
          </div>
          {questionType === "multiple_choice" ? (
            <div>
              <Label className="text-sm">Answer Options</Label>
              <div className="space-y-2 mt-2">
                {options.map((opt, i) => (
                  <div key={i} className="flex items-center gap-2">
                    <button
                      type="button"
                      onClick={() => setCorrectIndex(i)}
                      className={`w-6 h-6 rounded-full border-2 flex items-center justify-center text-xs font-medium transition-colors ${
                        correctIndex === i
                          ? "border-green-500 bg-green-500 text-white"
                          : "border-muted-foreground/30 hover:border-muted-foreground/50"
                      }`}
                    >
                      {String.fromCharCode(65 + i)}
                    </button>
                    <Input
                      value={opt}
                      onChange={(e) => {
                        const newOpts = [...options];
                        newOpts[i] = e.target.value;
                        setOptions(newOpts);
                      }}
                      placeholder={`Option ${String.fromCharCode(65 + i)}`}
                      className="flex-1"
                    />
                  </div>
                ))}
              </div>
              <p className="text-xs text-muted-foreground mt-2">Click a letter to mark it as the correct answer</p>
            </div>
          ) : (
            <div>
              <Label htmlFor="q-expected" className="text-sm">Expected Answer (optional)</Label>
              <Textarea
                id="q-expected"
                rows={2}
                value={expectedAnswer}
                onChange={(e) => setExpectedAnswer(e.target.value)}
                placeholder="Model answer for grading reference..."
                className="mt-1"
              />
            </div>
          )}
        </div>
        <DialogFooter>
          <Button variant="ghost" onClick={onClose} disabled={saving}>Cancel</Button>
          <Button onClick={submit} disabled={saving}>
            {saving ? <Loader2 className="h-4 w-4 mr-1 animate-spin" /> : <Save className="h-4 w-4 mr-1" />}
            {saving ? "Saving..." : "Save"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
