import { useEffect, useMemo, useRef, useState } from "react";
import { Send, Eye } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { ScrollArea } from "@/components/ui/scroll-area";
import { toast } from "sonner";
import { StudentAvatar } from "@/components/StudentAvatar";

type ClassRow = { id: string; name: string; teacher_id: string };
type Profile = { id: string; full_name: string | null; avatar_items: string[] | null };
type ProfileInfo = { name: string; items: string[] };
type Message = {
  id: string;
  class_id: string;
  sender_id: string;
  recipient_id: string;
  body: string;
  created_at: string;
};

type Conversation = {
  key: string; // class_id + ":" + otherId  (own conversations) or class_id + ":" + a + ":" + b (teacher view)
  classId: string;
  className: string;
  participantIds: string[]; // 1 (own) or 2 (teacher view)
  label: string;
  observed?: boolean; // true = teacher observing
  lastAt?: string;
  lastPreview?: string;
};

const pairKey = (a: string, b: string) => [a, b].sort().join(":");

export const Messages = () => {
  const { user, role } = useAuth();
  const [classes, setClasses] = useState<ClassRow[]>([]);
  const [profiles, setProfiles] = useState<Map<string, ProfileInfo>>(new Map());
  const [conversations, setConversations] = useState<Conversation[]>([]);
  const [active, setActive] = useState<Conversation | null>(null);
  const [thread, setThread] = useState<Message[]>([]);
  const [body, setBody] = useState("");
  const [loading, setLoading] = useState(true);
  const [sending, setSending] = useState(false);
  const scrollRef = useRef<HTMLDivElement>(null);

  const nameOf = (id: string) => (id === user?.id ? "You" : profiles.get(id)?.name ?? "User");
  const itemsOf = (id: string) => profiles.get(id)?.items ?? [];

  // Load classes + members + initial conversation list
  useEffect(() => {
    if (!user || !role) return;
    (async () => {
      setLoading(true);
      const { data: cls, error } = await supabase
        .from("classes")
        .select("id, name, teacher_id");
      if (error) { toast.error(error.message); setLoading(false); return; }

      const myClasses = (cls ?? []) as ClassRow[];
      setClasses(myClasses);

      const classIds = myClasses.map((c) => c.id);
      if (classIds.length === 0) { setLoading(false); return; }

      const { data: members } = await supabase
        .from("class_members")
        .select("class_id, student_id")
        .in("class_id", classIds);

      const byClass = new Map<string, string[]>();
      (members ?? []).forEach((m: any) => {
        if (!byClass.has(m.class_id)) byClass.set(m.class_id, []);
        byClass.get(m.class_id)!.push(m.student_id);
      });

      // Collect profile ids
      const ids = new Set<string>();
      myClasses.forEach((c) => ids.add(c.teacher_id));
      (members ?? []).forEach((m: any) => ids.add(m.student_id));
      const { data: profs } = ids.size
        ? await supabase.from("profiles").select("id, full_name, avatar_items").in("id", Array.from(ids))
        : { data: [] as Profile[] };
      const pmap = new Map<string, ProfileInfo>();
      (profs ?? []).forEach((p: any) => pmap.set(p.id, {
        name: p.full_name || "User",
        items: (p.avatar_items ?? []) as string[],
      }));
      setProfiles(pmap);

      const convs: Conversation[] = [];

      if (role === "student") {
        myClasses.forEach((c) => {
          // teacher conversation
          if (c.teacher_id !== user.id) {
            convs.push({
              key: `${c.id}:${c.teacher_id}`,
              classId: c.id,
              className: c.name,
              participantIds: [c.teacher_id],
              label: `${pmap.get(c.teacher_id)?.name ?? "Teacher"} (Teacher)`,
            });
          }
          // classmates
          (byClass.get(c.id) ?? [])
            .filter((sid) => sid !== user.id)
            .forEach((sid) => {
              convs.push({
                key: `${c.id}:${sid}`,
                classId: c.id,
                className: c.name,
                participantIds: [sid],
                label: pmap.get(sid)?.name ?? "Student",
              });
            });
        });
      } else {
        // Teacher view: own DMs with each student + observation of student-student threads
        myClasses.forEach((c) => {
          const studs = byClass.get(c.id) ?? [];
          studs.forEach((sid) => {
            convs.push({
              key: `${c.id}:${sid}`,
              classId: c.id,
              className: c.name,
              participantIds: [sid],
              label: pmap.get(sid)?.name ?? "Student",
            });
          });
          // student-student pairs
          for (let i = 0; i < studs.length; i++) {
            for (let j = i + 1; j < studs.length; j++) {
              const a = studs[i], b = studs[j];
              convs.push({
                key: `${c.id}:obs:${pairKey(a, b)}`,
                classId: c.id,
                className: c.name,
                participantIds: [a, b],
                label: `${pmap.get(a)?.name ?? "Student"} ↔ ${pmap.get(b)?.name ?? "Student"}`,
                observed: true,
              });
            }
          }
        });
      }

      // attach last message previews via single batched query
      const { data: recent } = await supabase
        .from("messages")
        .select("class_id, sender_id, recipient_id, body, created_at")
        .in("class_id", classIds)
        .order("created_at", { ascending: false })
        .limit(500);

      const lastByKey = new Map<string, { at: string; preview: string }>();
      (recent ?? []).forEach((m: any) => {
        const candidates: string[] = [];
        // own DM key (current user with other)
        if (m.sender_id === user.id) candidates.push(`${m.class_id}:${m.recipient_id}`);
        if (m.recipient_id === user.id) candidates.push(`${m.class_id}:${m.sender_id}`);
        // teacher observation key
        if (role === "teacher" && m.sender_id !== user.id && m.recipient_id !== user.id) {
          candidates.push(`${m.class_id}:obs:${pairKey(m.sender_id, m.recipient_id)}`);
        }
        candidates.forEach((k) => {
          if (!lastByKey.has(k)) {
            lastByKey.set(k, { at: m.created_at, preview: m.body });
          }
        });
      });
      convs.forEach((c) => {
        const l = lastByKey.get(c.key);
        if (l) { c.lastAt = l.at; c.lastPreview = l.preview; }
      });

      convs.sort((a, b) => {
        if (a.lastAt && b.lastAt) return b.lastAt.localeCompare(a.lastAt);
        if (a.lastAt) return -1;
        if (b.lastAt) return 1;
        return a.label.localeCompare(b.label);
      });

      setConversations(convs);
      setLoading(false);
    })();
  }, [user, role]);

  // Load thread when active changes + subscribe to realtime
  useEffect(() => {
    if (!active || !user) return;
    let cancel = false;

    const load = async () => {
      let q = supabase
        .from("messages")
        .select("*")
        .eq("class_id", active.classId)
        .order("created_at", { ascending: true });

      if (active.observed) {
        const [a, b] = active.participantIds;
        q = q.in("sender_id", [a, b]).in("recipient_id", [a, b]);
      } else {
        const other = active.participantIds[0];
        q = q.or(
          `and(sender_id.eq.${user.id},recipient_id.eq.${other}),` +
          `and(sender_id.eq.${other},recipient_id.eq.${user.id})`
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

    const channel = supabase
      .channel(`messages-${active.key}`)
      .on(
        "postgres_changes",
        { event: "INSERT", schema: "public", table: "messages", filter: `class_id=eq.${active.classId}` },
        () => load()
      )
      .subscribe();

    return () => { cancel = true; supabase.removeChannel(channel); };
  }, [active, user]);

  const send = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!active || !user || active.observed) return;
    const text = body.trim();
    if (!text) return;
    setSending(true);
    const { error } = await supabase.from("messages").insert({
      class_id: active.classId,
      sender_id: user.id,
      recipient_id: active.participantIds[0],
      body: text,
    });
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

  return (
    <Card>
      <CardHeader><CardTitle className="text-base">Messages</CardTitle></CardHeader>
      <CardContent>
        {loading ? (
          <p className="text-sm text-muted-foreground">Loading...</p>
        ) : classes.length === 0 ? (
          <p className="text-sm text-muted-foreground">Join or create a class to start messaging.</p>
        ) : conversations.length === 0 ? (
          <p className="text-sm text-muted-foreground">No one to message yet.</p>
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
                          <div className="flex items-center justify-between gap-2">
                            <span className="text-sm font-medium truncate">{c.label}</span>
                            {c.observed && <Eye className="h-3 w-3 text-muted-foreground shrink-0" />}
                          </div>
                          {c.lastPreview && (
                            <p className="text-xs text-muted-foreground truncate">{c.lastPreview}</p>
                          )}
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
                    <div className="min-w-0">
                      <p className="text-sm font-medium truncate">{active.label}</p>
                      <p className="text-xs text-muted-foreground">{active.className}</p>
                    </div>
                    {active.observed && (
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
                        return (
                          <div key={m.id} className={`flex ${mine ? "justify-end" : "justify-start"}`}>
                            <div className={`max-w-[75%] rounded-lg px-3 py-2 ${mine ? "bg-primary text-primary-foreground" : "bg-secondary text-secondary-foreground"}`}>
                              {active.observed && (
                                <p className="text-[10px] opacity-70 mb-0.5">{nameOf(m.sender_id)} → {nameOf(m.recipient_id)}</p>
                              )}
                              <p className="text-sm whitespace-pre-wrap break-words">{m.body}</p>
                              <p className="text-[10px] opacity-70 mt-1">{new Date(m.created_at).toLocaleString()}</p>
                            </div>
                          </div>
                        );
                      })
                    )}
                  </div>
                  {!active.observed && (
                    <form onSubmit={send} className="p-3 border-t border-border flex items-center gap-2">
                      <Input
                        value={body}
                        onChange={(e) => setBody(e.target.value)}
                        placeholder="Type a message"
                        maxLength={5000}
                      />
                      <Button type="submit" size="icon" disabled={sending || !body.trim()}>
                        <Send className="h-4 w-4" />
                      </Button>
                    </form>
                  )}
                </>
              )}
            </div>
          </div>
        )}
      </CardContent>
    </Card>
  );
};