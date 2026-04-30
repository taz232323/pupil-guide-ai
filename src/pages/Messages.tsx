import { useEffect, useMemo, useRef, useState } from "react";
import { Send, Eye, MessageSquare, Users, Plus, Megaphone, UsersRound } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import { Checkbox } from "@/components/ui/checkbox";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Badge } from "@/components/ui/badge";
import {
  Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter, DialogDescription,
} from "@/components/ui/dialog";
import { toast } from "sonner";
import { StudentAvatar } from "@/components/StudentAvatar";
import { EmptyState } from "@/components/EmptyState";
import { SpinnerButton } from "@/components/SpinnerButton";
import { ConversationListSkeleton } from "@/components/Skeletons";
import { RelativeTime } from "@/components/RelativeTime";

const MAX_MSG = 5000;

type ClassRow = { id: string; name: string; teacher_id: string };
type Profile = { id: string; full_name: string | null; avatar_items: string[] | null };
type ProfileInfo = { name: string; items: string[] };
type GroupRow = { id: string; class_id: string; teacher_id: string; name: string };
type GroupMember = { group_id: string; user_id: string };
type Message = {
  id: string;
  class_id: string;
  sender_id: string;
  recipient_id: string | null;
  body: string;
  created_at: string;
  group_id: string | null;
  is_broadcast: boolean;
  broadcast_id: string | null;
};

type Conversation = {
  key: string;
  classId: string;
  className: string;
  kind: "dm" | "observed" | "group";
  participantIds: string[]; // dm: [other], observed: [a,b], group: members (excl self)
  groupId?: string;
  label: string;
  lastAt?: string;
  lastPreview?: string;
};

const pairKey = (a: string, b: string) => [a, b].sort().join(":");

export const Messages = () => {
  const { user, role } = useAuth();
  const [classes, setClasses] = useState<ClassRow[]>([]);
  const [profiles, setProfiles] = useState<Map<string, ProfileInfo>>(new Map());
  const [groups, setGroups] = useState<GroupRow[]>([]);
  const [groupMembers, setGroupMembers] = useState<GroupMember[]>([]);
  const [conversations, setConversations] = useState<Conversation[]>([]);
  const [active, setActive] = useState<Conversation | null>(null);
  const [thread, setThread] = useState<Message[]>([]);
  const [body, setBody] = useState("");
  const [loading, setLoading] = useState(true);
  const [sending, setSending] = useState(false);
  const scrollRef = useRef<HTMLDivElement>(null);
  const [reloadTick, setReloadTick] = useState(0);

  // Dialog state
  const [groupOpen, setGroupOpen] = useState(false);
  const [broadcastOpen, setBroadcastOpen] = useState(false);

  const nameOf = (id: string) => (id === user?.id ? "You" : profiles.get(id)?.name ?? "User");
  const itemsOf = (id: string) => profiles.get(id)?.items ?? [];

  // Class members map (used by both load + dialogs)
  const [classMembers, setClassMembers] = useState<Map<string, string[]>>(new Map());

  useEffect(() => {
    if (!user || !role) return;
    let cancelled = false;
    (async () => {
      setLoading(true);
      const { data: cls, error } = await supabase
        .from("classes").select("id, name, teacher_id");
      if (error) { toast.error(error.message); setLoading(false); return; }
      const myClasses = (cls ?? []) as ClassRow[];
      const classIds = myClasses.map((c) => c.id);

      const [{ data: members }, { data: grps }] = await Promise.all([
        classIds.length
          ? supabase.from("class_members").select("class_id, student_id").in("class_id", classIds)
          : Promise.resolve({ data: [] as any[] }),
        supabase.from("message_groups").select("id, class_id, teacher_id, name"),
      ]);

      const byClass = new Map<string, string[]>();
      (members ?? []).forEach((m: any) => {
        if (!byClass.has(m.class_id)) byClass.set(m.class_id, []);
        byClass.get(m.class_id)!.push(m.student_id);
      });

      const groupRows = (grps ?? []) as GroupRow[];
      const groupIds = groupRows.map((g) => g.id);
      const { data: gMembers } = groupIds.length
        ? await supabase.from("message_group_members").select("group_id, user_id").in("group_id", groupIds)
        : { data: [] as any[] };

      // collect profile ids
      const ids = new Set<string>();
      myClasses.forEach((c) => ids.add(c.teacher_id));
      (members ?? []).forEach((m: any) => ids.add(m.student_id));
      (gMembers ?? []).forEach((m: any) => ids.add(m.user_id));
      groupRows.forEach((g) => ids.add(g.teacher_id));
      const { data: profs } = ids.size
        ? await supabase.from("profiles").select("id, full_name, avatar_items").in("id", Array.from(ids))
        : { data: [] as Profile[] };
      const pmap = new Map<string, ProfileInfo>();
      (profs ?? []).forEach((p: any) => pmap.set(p.id, {
        name: p.full_name || "User",
        items: (p.avatar_items ?? []) as string[],
      }));

      // Build conversations
      const convs: Conversation[] = [];
      const classNameOf = (cid: string) => myClasses.find((c) => c.id === cid)?.name ?? "Class";

      if (role === "student") {
        myClasses.forEach((c) => {
          if (c.teacher_id !== user.id) {
            convs.push({
              key: `dm:${c.id}:${c.teacher_id}`, classId: c.id, className: c.name,
              kind: "dm", participantIds: [c.teacher_id],
              label: `${pmap.get(c.teacher_id)?.name ?? "Teacher"} (Teacher)`,
            });
          }
          (byClass.get(c.id) ?? []).filter((sid) => sid !== user.id).forEach((sid) => {
            convs.push({
              key: `dm:${c.id}:${sid}`, classId: c.id, className: c.name,
              kind: "dm", participantIds: [sid],
              label: pmap.get(sid)?.name ?? "Student",
            });
          });
        });
      } else {
        myClasses.forEach((c) => {
          const studs = byClass.get(c.id) ?? [];
          studs.forEach((sid) => {
            convs.push({
              key: `dm:${c.id}:${sid}`, classId: c.id, className: c.name,
              kind: "dm", participantIds: [sid],
              label: pmap.get(sid)?.name ?? "Student",
            });
          });
          for (let i = 0; i < studs.length; i++) {
            for (let j = i + 1; j < studs.length; j++) {
              const a = studs[i], b = studs[j];
              convs.push({
                key: `obs:${c.id}:${pairKey(a, b)}`, classId: c.id, className: c.name,
                kind: "observed", participantIds: [a, b],
                label: `${pmap.get(a)?.name ?? "Student"} ↔ ${pmap.get(b)?.name ?? "Student"}`,
              });
            }
          }
        });
      }

      // Group conversations (visible if user is member or teacher of group)
      groupRows.forEach((g) => {
        const memberIds = (gMembers ?? []).filter((m: any) => m.group_id === g.id).map((m: any) => m.user_id);
        const isMember = memberIds.includes(user.id) || g.teacher_id === user.id;
        if (!isMember) return;
        convs.push({
          key: `grp:${g.id}`,
          classId: g.class_id,
          className: classNameOf(g.class_id),
          kind: "group",
          participantIds: memberIds.filter((m) => m !== user.id),
          groupId: g.id,
          label: g.name,
        });
      });

      // Last messages
      if (classIds.length || groupIds.length) {
        let q = supabase.from("messages")
          .select("class_id, sender_id, recipient_id, body, created_at, group_id, is_broadcast, broadcast_id")
          .order("created_at", { ascending: false }).limit(800);
        if (classIds.length) q = q.in("class_id", classIds);
        const { data: recent } = await q;
        const lastByKey = new Map<string, { at: string; preview: string }>();
        (recent ?? []).forEach((m: any) => {
          const ks: string[] = [];
          if (m.group_id) {
            ks.push(`grp:${m.group_id}`);
          } else {
            if (m.sender_id === user.id && m.recipient_id) ks.push(`dm:${m.class_id}:${m.recipient_id}`);
            if (m.recipient_id === user.id) ks.push(`dm:${m.class_id}:${m.sender_id}`);
            if (role === "teacher" && m.sender_id !== user.id && m.recipient_id && m.recipient_id !== user.id) {
              ks.push(`obs:${m.class_id}:${pairKey(m.sender_id, m.recipient_id)}`);
            }
          }
          ks.forEach((k) => { if (!lastByKey.has(k)) lastByKey.set(k, { at: m.created_at, preview: m.body }); });
        });
        convs.forEach((c) => {
          const l = lastByKey.get(c.key);
          if (l) { c.lastAt = l.at; c.lastPreview = l.preview; }
        });
      }

      convs.sort((a, b) => {
        if (a.lastAt && b.lastAt) return b.lastAt.localeCompare(a.lastAt);
        if (a.lastAt) return -1;
        if (b.lastAt) return 1;
        return a.label.localeCompare(b.label);
      });

      if (cancelled) return;
      setClasses(myClasses);
      setClassMembers(byClass);
      setProfiles(pmap);
      setGroups(groupRows);
      setGroupMembers((gMembers ?? []) as GroupMember[]);
      setConversations(convs);
      setLoading(false);
    })();
    return () => { cancelled = true; };
  }, [user, role, reloadTick]);

  // Active thread + realtime
  useEffect(() => {
    if (!active || !user) return;
    let cancel = false;

    const load = async () => {
      let q = supabase.from("messages").select("*").order("created_at", { ascending: true });

      if (active.kind === "group" && active.groupId) {
        q = q.eq("group_id", active.groupId);
      } else if (active.kind === "observed") {
        const [a, b] = active.participantIds;
        q = q.eq("class_id", active.classId).is("group_id", null)
          .in("sender_id", [a, b]).in("recipient_id", [a, b]);
      } else {
        const other = active.participantIds[0];
        q = q.eq("class_id", active.classId).is("group_id", null).or(
          `and(sender_id.eq.${user.id},recipient_id.eq.${other}),and(sender_id.eq.${other},recipient_id.eq.${user.id})`
        );
      }

      const { data, error } = await q;
      if (error) { toast.error(error.message); return; }
      if (cancel) return;
      setThread((data ?? []) as Message[]);
      requestAnimationFrame(() => {
        scrollRef.current?.scrollTo({ top: scrollRef.current.scrollHeight });
      });
    };
    load();

    const filter = active.kind === "group" && active.groupId
      ? `group_id=eq.${active.groupId}`
      : `class_id=eq.${active.classId}`;
    const channel = supabase
      .channel(`messages-${active.key}`)
      .on("postgres_changes",
        { event: "INSERT", schema: "public", table: "messages", filter },
        () => load())
      .subscribe();

    return () => { cancel = true; supabase.removeChannel(channel); };
  }, [active, user]);

  const send = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!active || !user || active.kind === "observed") return;
    const text = body.trim();
    if (!text) return;
    setSending(true);
    const payload: any = {
      class_id: active.classId,
      sender_id: user.id,
      body: text,
    };
    if (active.kind === "group") {
      payload.group_id = active.groupId;
      payload.recipient_id = null;
    } else {
      payload.recipient_id = active.participantIds[0];
    }
    const { error } = await supabase.from("messages").insert(payload);
    setSending(false);
    if (error) { toast.error(error.message); return; }
    setBody("");
  };

  const grouped = useMemo(() => {
    const map = new Map<string, Conversation[]>();
    conversations.forEach((c) => {
      if (!map.has(c.className)) map.set(c.className, []);
      map.get(c.className)!.push(c);
    });
    return Array.from(map.entries());
  }, [conversations]);

  // Determine if active thread is a teacher-broadcast view
  const broadcastView = role === "teacher" && active?.kind === "dm" &&
    thread.some((m) => m.is_broadcast && m.sender_id === user?.id);

  return (
    <Card>
      <CardHeader className="flex flex-row items-center justify-between gap-2">
        <CardTitle className="text-base">Messages</CardTitle>
        {role === "teacher" && classes.length > 0 && (
          <div className="flex items-center gap-2">
            <Button size="sm" variant="outline" onClick={() => setGroupOpen(true)}>
              <UsersRound className="h-4 w-4" /> New Group
            </Button>
            <Button size="sm" onClick={() => setBroadcastOpen(true)}>
              <Megaphone className="h-4 w-4" /> Broadcast
            </Button>
          </div>
        )}
      </CardHeader>
      <CardContent>
        {loading ? (
          <ConversationListSkeleton count={5} />
        ) : classes.length === 0 ? (
          <EmptyState
            icon={MessageSquare}
            title="No conversations yet"
            description="Join or create a class — messaging is shared with your classmates and teacher."
          />
        ) : conversations.length === 0 ? (
          <EmptyState
            icon={Users}
            title="No one to message yet"
            description="Once classmates and teachers join your class, they'll appear here."
          />
        ) : (
          <div className="grid gap-0 md:grid-cols-[260px_1fr] border border-border rounded-md overflow-hidden h-[480px]">
            <div className="border-r border-border bg-muted/30">
              <ScrollArea className="h-full">
                <div className="py-1">
                  {grouped.map(([className, items]) => (
                    <div key={className}>
                      <p className="px-3 pt-3 pb-1 text-[10px] uppercase tracking-wide text-muted-foreground">{className}</p>
                      {items.map((c) => (
                        <button
                          key={c.key}
                          onClick={() => setActive(c)}
                          className={`w-full text-left px-3 py-2 hover:bg-accent transition-colors ${active?.key === c.key ? "bg-accent" : ""}`}
                        >
                          <div className="flex items-center gap-2">
                            {c.kind === "group" ? (
                              <div className="h-6 w-6 rounded-full bg-primary/15 text-primary flex items-center justify-center shrink-0">
                                <UsersRound className="h-3.5 w-3.5" />
                              </div>
                            ) : c.kind === "observed" ? (
                              <div className="flex -space-x-2 shrink-0">
                                <StudentAvatar size="xs" name={nameOf(c.participantIds[0])} items={itemsOf(c.participantIds[0])} />
                                <StudentAvatar size="xs" name={nameOf(c.participantIds[1])} items={itemsOf(c.participantIds[1])} />
                              </div>
                            ) : (
                              <StudentAvatar size="xs" name={nameOf(c.participantIds[0])} items={itemsOf(c.participantIds[0])} />
                            )}
                            <div className="min-w-0 flex-1">
                              <div className="flex items-center justify-between gap-2">
                                <span className="text-sm font-medium truncate">{c.label}</span>
                                {c.kind === "observed" && <Eye className="h-3 w-3 text-muted-foreground shrink-0" />}
                                {c.kind === "group" && (
                                  <Badge variant="secondary" className="text-[9px] px-1.5 py-0">Group</Badge>
                                )}
                              </div>
                              {c.lastPreview && (
                                <p className="text-xs text-muted-foreground truncate">{c.lastPreview}</p>
                              )}
                            </div>
                          </div>
                        </button>
                      ))}
                    </div>
                  ))}
                </div>
              </ScrollArea>
            </div>

            <div className="flex flex-col min-h-0">
              {!active ? (
                <div className="flex-1 flex items-center justify-center text-sm text-muted-foreground">
                  Select a conversation
                </div>
              ) : (
                <>
                  <div className="px-4 py-2 border-b border-border flex items-center justify-between">
                    <div className="flex items-center gap-2 min-w-0">
                      {active.kind === "group" ? (
                        <div className="h-7 w-7 rounded-full bg-primary/15 text-primary flex items-center justify-center shrink-0">
                          <UsersRound className="h-4 w-4" />
                        </div>
                      ) : active.kind === "observed" ? (
                        <div className="flex -space-x-2 shrink-0">
                          <StudentAvatar size="sm" name={nameOf(active.participantIds[0])} items={itemsOf(active.participantIds[0])} />
                          <StudentAvatar size="sm" name={nameOf(active.participantIds[1])} items={itemsOf(active.participantIds[1])} />
                        </div>
                      ) : (
                        <StudentAvatar size="sm" name={nameOf(active.participantIds[0])} items={itemsOf(active.participantIds[0])} />
                      )}
                      <div className="min-w-0">
                        <p className="text-sm font-medium truncate flex items-center gap-2">
                          {active.label}
                          {broadcastView && (
                            <Badge variant="secondary" className="gap-1">
                              <Megaphone className="h-3 w-3" /> Broadcast
                            </Badge>
                          )}
                        </p>
                        <p className="text-xs text-muted-foreground">
                          {active.className}
                          {active.kind === "group" && ` · ${active.participantIds.length + 1} members`}
                        </p>
                      </div>
                    </div>
                    {active.kind === "observed" && (
                      <span className="text-[10px] uppercase tracking-wide px-2 py-0.5 rounded-full bg-secondary text-secondary-foreground inline-flex items-center gap-1">
                        <Eye className="h-3 w-3" />Observing
                      </span>
                    )}
                  </div>
                  <div ref={scrollRef} className="flex-1 overflow-y-auto p-4 space-y-2">
                    {thread.length === 0 ? (
                      <p className="text-sm text-muted-foreground text-center py-8">No messages yet.</p>
                    ) : (
                      thread.map((m) => {
                        const mine = m.sender_id === user?.id;
                        const showBroadcastBadge = role === "teacher" && m.is_broadcast && m.sender_id === user?.id;
                        return (
                          <div key={m.id} className={`flex items-end gap-2 ${mine ? "justify-end" : "justify-start"}`}>
                            {!mine && (
                              <StudentAvatar size="xs" name={nameOf(m.sender_id)} items={itemsOf(m.sender_id)} />
                            )}
                            <div className={`max-w-[75%] rounded-lg px-3 py-2 ${mine ? "bg-primary text-primary-foreground" : "bg-secondary text-secondary-foreground"}`}>
                              {(active.kind === "observed" || active.kind === "group") && !mine && (
                                <p className="text-[10px] opacity-70 mb-0.5">{nameOf(m.sender_id)}</p>
                              )}
                              {active.kind === "observed" && (
                                <p className="text-[10px] opacity-70 mb-0.5">{nameOf(m.sender_id)} → {nameOf(m.recipient_id ?? "")}</p>
                              )}
                              <p className="text-sm whitespace-pre-wrap break-words">{m.body}</p>
                              <div className="flex items-center gap-2 mt-1">
                                <RelativeTime date={m.created_at} className="text-[10px] opacity-70 block" />
                                {showBroadcastBadge && (
                                  <span className="text-[10px] opacity-80 inline-flex items-center gap-0.5">
                                    <Megaphone className="h-2.5 w-2.5" /> Broadcast
                                  </span>
                                )}
                              </div>
                            </div>
                          </div>
                        );
                      })
                    )}
                  </div>
                  {active.kind !== "observed" && (
                    <form onSubmit={send} className="p-3 border-t border-border space-y-1.5">
                      <div className="flex items-center gap-2">
                        <Input
                          value={body}
                          onChange={(e) => setBody(e.target.value.slice(0, MAX_MSG))}
                          placeholder="Type a message"
                          maxLength={MAX_MSG}
                        />
                        <SpinnerButton type="submit" size="icon" loading={sending} disabled={!body.trim()} aria-label="Send message">
                          {!sending && <Send className="h-4 w-4" />}
                        </SpinnerButton>
                      </div>
                      <p
                        className={`text-[10px] text-right tabular-nums ${
                          body.length >= MAX_MSG ? "text-destructive" : "text-muted-foreground"
                        }`}
                        aria-live="polite"
                      >
                        {body.length} / {MAX_MSG}
                      </p>
                    </form>
                  )}
                </>
              )}
            </div>
          </div>
        )}
      </CardContent>

      {role === "teacher" && (
        <>
          <NewGroupDialog
            open={groupOpen}
            onOpenChange={setGroupOpen}
            classes={classes}
            classMembers={classMembers}
            profiles={profiles}
            onCreated={() => setReloadTick((t) => t + 1)}
          />
          <BroadcastDialog
            open={broadcastOpen}
            onOpenChange={setBroadcastOpen}
            classes={classes}
            classMembers={classMembers}
            profiles={profiles}
            senderId={user?.id ?? ""}
            onSent={() => setReloadTick((t) => t + 1)}
          />
        </>
      )}
    </Card>
  );
};

// ----- New Group dialog -----

const NewGroupDialog = ({
  open, onOpenChange, classes, classMembers, profiles, onCreated,
}: {
  open: boolean;
  onOpenChange: (v: boolean) => void;
  classes: ClassRow[];
  classMembers: Map<string, string[]>;
  profiles: Map<string, ProfileInfo>;
  onCreated: () => void;
}) => {
  const { user } = useAuth();
  const [name, setName] = useState("");
  const [classId, setClassId] = useState<string>("");
  const [picked, setPicked] = useState<Set<string>>(new Set());
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    if (open) {
      setName("");
      setClassId(classes[0]?.id ?? "");
      setPicked(new Set());
    }
  }, [open, classes]);

  const studentsForClass = classId ? classMembers.get(classId) ?? [] : [];

  const toggle = (id: string) => {
    setPicked((p) => {
      const n = new Set(p);
      if (n.has(id)) n.delete(id); else n.add(id);
      return n;
    });
  };

  const create = async () => {
    if (!user) return;
    if (!name.trim()) { toast.error("Name your group"); return; }
    if (!classId) { toast.error("Pick a class"); return; }
    if (picked.size === 0) { toast.error("Select at least one student"); return; }
    setSaving(true);
    const { data: g, error } = await supabase.from("message_groups").insert({
      class_id: classId, teacher_id: user.id, name: name.trim(),
    }).select("id").single();
    if (error || !g) { setSaving(false); toast.error(error?.message ?? "Failed"); return; }
    const rows = [
      { group_id: g.id, user_id: user.id }, // teacher is also a member
      ...Array.from(picked).map((uid) => ({ group_id: g.id, user_id: uid })),
    ];
    const { error: e2 } = await supabase.from("message_group_members").insert(rows);
    setSaving(false);
    if (e2) { toast.error(e2.message); return; }
    toast.success("Group created");
    onOpenChange(false);
    onCreated();
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>New group chat</DialogTitle>
          <DialogDescription>Create a shared chat for selected students.</DialogDescription>
        </DialogHeader>
        <div className="space-y-3">
          <div>
            <Label htmlFor="grp-name">Group name</Label>
            <Input id="grp-name" value={name} onChange={(e) => setName(e.target.value)} placeholder="Reading squad" />
          </div>
          <div>
            <Label>Class</Label>
            <select
              className="w-full h-9 rounded-md border border-input bg-background px-2 text-sm"
              value={classId}
              onChange={(e) => { setClassId(e.target.value); setPicked(new Set()); }}
            >
              {classes.map((c) => <option key={c.id} value={c.id}>{c.name}</option>)}
            </select>
          </div>
          <div>
            <Label>Students</Label>
            <div className="border rounded-md max-h-60 overflow-y-auto divide-y">
              {studentsForClass.length === 0 ? (
                <p className="p-3 text-sm text-muted-foreground">No students in this class.</p>
              ) : studentsForClass.map((sid) => (
                <label key={sid} className="flex items-center gap-2 p-2 cursor-pointer hover:bg-accent">
                  <Checkbox checked={picked.has(sid)} onCheckedChange={() => toggle(sid)} />
                  <span className="text-sm">{profiles.get(sid)?.name ?? "Student"}</span>
                </label>
              ))}
            </div>
          </div>
        </div>
        <DialogFooter>
          <Button variant="ghost" onClick={() => onOpenChange(false)}>Cancel</Button>
          <SpinnerButton onClick={create} loading={saving}>Create group</SpinnerButton>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
};

// ----- Broadcast dialog -----

const BroadcastDialog = ({
  open, onOpenChange, classes, classMembers, profiles, senderId, onSent,
}: {
  open: boolean;
  onOpenChange: (v: boolean) => void;
  classes: ClassRow[];
  classMembers: Map<string, string[]>;
  profiles: Map<string, ProfileInfo>;
  senderId: string;
  onSent: () => void;
}) => {
  const [msg, setMsg] = useState("");
  const [pickedClasses, setPickedClasses] = useState<Set<string>>(new Set());
  // student picks keyed as `${classId}:${studentId}` so a student in two classes is targetable per-class
  const [pickedStudents, setPickedStudents] = useState<Set<string>>(new Set());
  const [sending, setSending] = useState(false);

  useEffect(() => {
    if (open) { setMsg(""); setPickedClasses(new Set()); setPickedStudents(new Set()); }
  }, [open]);

  const toggleClass = (cid: string) => {
    setPickedClasses((p) => {
      const n = new Set(p);
      if (n.has(cid)) n.delete(cid); else n.add(cid);
      return n;
    });
  };
  const toggleStudent = (k: string) => {
    setPickedStudents((p) => {
      const n = new Set(p);
      if (n.has(k)) n.delete(k); else n.add(k);
      return n;
    });
  };

  // Build deliveries: unique (class_id, student_id) pairs
  const deliveries = useMemo(() => {
    const out = new Map<string, { class_id: string; student_id: string }>();
    pickedClasses.forEach((cid) => {
      (classMembers.get(cid) ?? []).forEach((sid) => {
        out.set(`${cid}:${sid}`, { class_id: cid, student_id: sid });
      });
    });
    pickedStudents.forEach((k) => {
      const [cid, sid] = k.split(":");
      out.set(k, { class_id: cid, student_id: sid });
    });
    return Array.from(out.values());
  }, [pickedClasses, pickedStudents, classMembers]);

  const send = async () => {
    if (!msg.trim()) { toast.error("Type a message"); return; }
    if (deliveries.length === 0) { toast.error("Pick recipients"); return; }
    setSending(true);
    const broadcastId = (crypto as any).randomUUID?.() ?? `${Date.now()}-${Math.random()}`;
    const rows = deliveries.map((d) => ({
      class_id: d.class_id,
      sender_id: senderId,
      recipient_id: d.student_id,
      body: msg.trim(),
      is_broadcast: true,
      broadcast_id: broadcastId,
    }));
    const { error } = await supabase.from("messages").insert(rows);
    setSending(false);
    if (error) { toast.error(error.message); return; }
    toast.success(`Broadcast sent to ${deliveries.length} student${deliveries.length === 1 ? "" : "s"}`);
    onOpenChange(false);
    onSent();
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-xl">
        <DialogHeader>
          <DialogTitle>Send broadcast</DialogTitle>
          <DialogDescription>
            Each recipient gets a private direct message. Students cannot see who else received it.
          </DialogDescription>
        </DialogHeader>
        <div className="space-y-3">
          <div>
            <Label htmlFor="bc-msg">Message</Label>
            <Textarea
              id="bc-msg" value={msg} onChange={(e) => setMsg(e.target.value.slice(0, MAX_MSG))}
              rows={4} placeholder="Reminder: project due Friday at noon."
            />
            <p className={`text-[10px] text-right tabular-nums ${msg.length >= MAX_MSG ? "text-destructive" : "text-muted-foreground"}`}>
              {msg.length} / {MAX_MSG}
            </p>
          </div>
          <div>
            <Label>Recipients</Label>
            <div className="border rounded-md max-h-72 overflow-y-auto divide-y">
              {classes.map((c) => {
                const studs = classMembers.get(c.id) ?? [];
                const allSelected = pickedClasses.has(c.id);
                return (
                  <div key={c.id} className="p-2">
                    <label className="flex items-center gap-2 cursor-pointer">
                      <Checkbox checked={allSelected} onCheckedChange={() => toggleClass(c.id)} />
                      <span className="text-sm font-medium">
                        {c.name} <span className="text-muted-foreground font-normal">· entire class ({studs.length})</span>
                      </span>
                    </label>
                    {!allSelected && studs.length > 0 && (
                      <div className="ml-6 mt-1 grid grid-cols-1 sm:grid-cols-2 gap-1">
                        {studs.map((sid) => {
                          const k = `${c.id}:${sid}`;
                          return (
                            <label key={k} className="flex items-center gap-2 text-sm cursor-pointer hover:bg-accent rounded px-1">
                              <Checkbox
                                checked={pickedStudents.has(k)}
                                onCheckedChange={() => toggleStudent(k)}
                              />
                              <span>{profiles.get(sid)?.name ?? "Student"}</span>
                            </label>
                          );
                        })}
                      </div>
                    )}
                  </div>
                );
              })}
            </div>
            <p className="text-xs text-muted-foreground mt-1">
              {deliveries.length} recipient{deliveries.length === 1 ? "" : "s"} selected
            </p>
          </div>
        </div>
        <DialogFooter>
          <Button variant="ghost" onClick={() => onOpenChange(false)}>Cancel</Button>
          <SpinnerButton onClick={send} loading={sending} disabled={!msg.trim() || deliveries.length === 0}>
            <Megaphone className="h-4 w-4" /> Send broadcast
          </SpinnerButton>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
};
