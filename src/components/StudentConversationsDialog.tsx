import { useEffect, useMemo, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import {
  Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription,
} from "@/components/ui/dialog";
import { ScrollArea } from "@/components/ui/scroll-area";
import { StudentAvatar } from "@/components/StudentAvatar";
import { RelativeTime } from "@/components/RelativeTime";
import { Eye, MessagesSquare } from "lucide-react";
import { toast } from "sonner";

type Message = {
  id: string;
  class_id: string;
  sender_id: string;
  recipient_id: string | null;
  body: string;
  created_at: string;
  group_id: string | null;
};
type Profile = { id: string; full_name: string | null; avatar_items: string[] | null };

const pairKey = (a: string, b: string) => [a, b].sort().join(":");

/**
 * Teacher-only view of all student↔student conversations a given student has
 * within the teacher's classes. Relies on the existing RLS policy
 * "Class teacher can view all messages in their class".
 */
export const StudentConversationsDialog = ({
  open, onOpenChange, studentId, studentName,
}: {
  open: boolean;
  onOpenChange: (v: boolean) => void;
  studentId: string;
  studentName: string;
}) => {
  const [loading, setLoading] = useState(false);
  const [messages, setMessages] = useState<Message[]>([]);
  const [profiles, setProfiles] = useState<Map<string, Profile>>(new Map());
  const [classNames, setClassNames] = useState<Map<string, string>>(new Map());
  const [activeKey, setActiveKey] = useState<string | null>(null);

  useEffect(() => {
    if (!open) return;
    let cancelled = false;
    (async () => {
      setLoading(true);
      setActiveKey(null);

      // All DM messages where the student is sender or recipient.
      // Teacher's RLS lets us see any message in a class they teach,
      // so the union is naturally limited to teacher's classes.
      const { data, error } = await supabase
        .from("messages")
        .select("id, class_id, sender_id, recipient_id, body, created_at, group_id")
        .is("group_id", null)
        .or(`sender_id.eq.${studentId},recipient_id.eq.${studentId}`)
        .order("created_at", { ascending: true });
      if (error) { toast.error(error.message); setLoading(false); return; }

      const msgs = ((data ?? []) as Message[]).filter((m) => m.recipient_id);
      // Exclude conversations the student had with the teacher themself
      // (those belong on the teacher's main Messages page, not here).
      const myId = (await supabase.auth.getUser()).data.user?.id;
      const peerOnly = msgs.filter(
        (m) => m.sender_id !== myId && m.recipient_id !== myId
      );

      const ids = new Set<string>();
      const cids = new Set<string>();
      peerOnly.forEach((m) => {
        ids.add(m.sender_id);
        if (m.recipient_id) ids.add(m.recipient_id);
        cids.add(m.class_id);
      });

      const [{ data: profs }, { data: cls }] = await Promise.all([
        ids.size
          ? supabase.from("profiles").select("id, full_name, avatar_items").in("id", Array.from(ids))
          : Promise.resolve({ data: [] as Profile[] }),
        cids.size
          ? supabase.from("classes").select("id, name").in("id", Array.from(cids))
          : Promise.resolve({ data: [] as { id: string; name: string }[] }),
      ]);

      if (cancelled) return;
      const pmap = new Map<string, Profile>();
      (profs ?? []).forEach((p: any) => pmap.set(p.id, p));
      const cmap = new Map<string, string>();
      (cls ?? []).forEach((c: any) => cmap.set(c.id, c.name));

      setMessages(peerOnly);
      setProfiles(pmap);
      setClassNames(cmap);
      setLoading(false);
    })();
    return () => { cancelled = true; };
  }, [open, studentId]);

  // Group by (class, otherStudent)
  const conversations = useMemo(() => {
    const byKey = new Map<string, {
      key: string;
      classId: string;
      otherId: string;
      messages: Message[];
      lastAt: string;
    }>();
    messages.forEach((m) => {
      const otherId = m.sender_id === studentId ? (m.recipient_id ?? "") : m.sender_id;
      if (!otherId) return;
      const key = `${m.class_id}:${pairKey(studentId, otherId)}`;
      const entry = byKey.get(key) ?? { key, classId: m.class_id, otherId, messages: [], lastAt: m.created_at };
      entry.messages.push(m);
      entry.lastAt = m.created_at;
      byKey.set(key, entry);
    });
    return Array.from(byKey.values()).sort((a, b) => b.lastAt.localeCompare(a.lastAt));
  }, [messages, studentId]);

  const active = conversations.find((c) => c.key === activeKey) ?? conversations[0];

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-3xl">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Eye className="h-4 w-4" />
            {studentName}'s student conversations
          </DialogTitle>
          <DialogDescription>
            Read-only view of direct messages between this student and their classmates.
          </DialogDescription>
        </DialogHeader>

        {loading ? (
          <div className="py-12 text-center text-sm text-muted-foreground">Loading…</div>
        ) : conversations.length === 0 ? (
          <div className="py-12 text-center animate-fade-up">
            <MessagesSquare className="h-8 w-8 mx-auto text-muted-foreground mb-2 animate-pop-in" />
            <p className="text-sm text-muted-foreground">
              {studentName} hasn't messaged any classmates yet.
            </p>
          </div>
        ) : (
          <div className="grid grid-cols-[200px_1fr] border border-border rounded-md overflow-hidden h-[420px]">
            <div className="border-r border-border bg-muted/30">
              <ScrollArea className="h-full">
                <div className="py-1">
                  {conversations.map((c) => {
                    const other = profiles.get(c.otherId);
                    return (
                      <button
                        key={c.key}
                        onClick={() => setActiveKey(c.key)}
                        className={`w-full text-left px-3 py-2 hover:bg-accent transition-spring ${
                          (active?.key === c.key) ? "bg-accent" : ""
                        }`}
                      >
                        <div className="flex items-center gap-2">
                          <StudentAvatar size="xs" name={other?.full_name || "Student"} items={other?.avatar_items ?? []} />
                          <div className="min-w-0">
                            <p className="text-sm font-medium truncate">{other?.full_name || "Student"}</p>
                            <p className="text-[10px] text-muted-foreground truncate">
                              {classNames.get(c.classId) ?? "Class"}
                            </p>
                          </div>
                        </div>
                      </button>
                    );
                  })}
                </div>
              </ScrollArea>
            </div>
            <ScrollArea className="h-full">
              <div className="p-4 space-y-2">
                {active?.messages.map((m) => {
                  const fromStudent = m.sender_id === studentId;
                  const senderProfile = profiles.get(m.sender_id);
                  return (
                    <div key={m.id} className={`flex items-end gap-2 ${fromStudent ? "justify-end animate-msg-in-right" : "justify-start animate-msg-in-left"}`}>
                      {!fromStudent && (
                        <StudentAvatar size="xs" name={senderProfile?.full_name || "Student"} items={senderProfile?.avatar_items ?? []} />
                      )}
                      <div className={`max-w-[75%] rounded-lg px-3 py-2 shadow-card ${
                        fromStudent ? "bg-primary text-primary-foreground" : "bg-secondary text-secondary-foreground"
                      }`}>
                        <p className="text-[10px] opacity-70 mb-0.5">
                          {senderProfile?.full_name || "Student"}
                        </p>
                        <p className="text-sm whitespace-pre-wrap break-words">{m.body}</p>
                        <RelativeTime date={m.created_at} className="text-[10px] opacity-70 block mt-1" />
                      </div>
                    </div>
                  );
                })}
              </div>
            </ScrollArea>
          </div>
        )}
      </DialogContent>
    </Dialog>
  );
};
