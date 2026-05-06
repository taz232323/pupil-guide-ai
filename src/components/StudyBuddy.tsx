import { useEffect, useRef, useState } from "react";
import { Sheet, SheetContent, SheetHeader, SheetTitle } from "@/components/ui/sheet";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Sparkles, Send, Trash2, Bot, Brain } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";
import { toast } from "sonner";
import { cn } from "@/lib/utils";

type Msg = { role: "user" | "assistant"; content: string };

export function StudyBuddy() {
  const { user, role } = useAuth();
  const [open, setOpen] = useState(false);
  const [firstName, setFirstName] = useState<string>("");
  const [messages, setMessages] = useState<Msg[]>([]);
  const [input, setInput] = useState("");
  const [sending, setSending] = useState(false);
  const scrollRef = useRef<HTMLDivElement>(null);
  const isTeacher = role === "teacher";

  // Fetch name once for the greeting
  useEffect(() => {
    if (!user) return;
    supabase.from("profiles").select("full_name").eq("id", user.id).maybeSingle()
      .then(({ data }) => setFirstName((data?.full_name?.split(" ")[0]) || (isTeacher ? "Teacher" : "friend")));
  }, [user]);

  // Greet on first open
  useEffect(() => {
    if (open && messages.length === 0) {
      const greeting = isTeacher
        ? `Hi ${firstName || "Teacher"}! 👋 I'm **Study Buddy**, your AI co-teacher. I can help you:\n- Write **assignment descriptions**\n- Generate **quiz questions** for a unit\n- Draft **announcements** or parent emails\n- Brainstorm **lesson ideas**\n\nWhat are we working on?`
        : `Hi ${firstName || "there"}! 👋 I'm **Study Buddy**. Ask me to explain a concept, give you practice questions for a unit, or help plan your week. What's up?`;
      setMessages([{ role: "assistant", content: greeting }]);
    }
  }, [open, firstName, isTeacher]); // eslint-disable-line react-hooks/exhaustive-deps

  // Smooth scroll to latest
  useEffect(() => {
    const el = scrollRef.current;
    if (el) el.scrollTo({ top: el.scrollHeight, behavior: "smooth" });
  }, [messages, sending]);

  const clearChat = () => {
    setMessages([{
      role: "assistant",
      content: `Fresh start! What would you like to work on, ${firstName || (isTeacher ? "Teacher" : "friend")}?`,
    }]);
  };

  const send = async () => {
    const text = input.trim();
    if (!text || sending) return;
    setInput("");
    const next = [...messages, { role: "user" as const, content: text }];
    setMessages(next);
    setSending(true);

    try {
      const { data, error } = await supabase.functions.invoke("study-buddy", {
        body: { messages: next.map((m) => ({ role: m.role, content: m.content })) },
      });
      if (error) throw error;
      const reply = (data as any)?.reply ?? "Hmm, no response.";
      setMessages((prev) => [...prev, { role: "assistant", content: reply }]);
    } catch (e: any) {
      toast.error(e?.message ?? "Study Buddy is unavailable right now.");
      setMessages((prev) => [...prev, { role: "assistant", content: "Sorry, I had trouble answering that. Try again in a moment." }]);
    } finally {
      setSending(false);
    }
  };

  const onKey = (e: React.KeyboardEvent<HTMLInputElement>) => {
    if (e.key === "Enter" && !e.shiftKey) { e.preventDefault(); send(); }
  };

  return (
    <>
      {/* Floating bubble */}
      <button
        onClick={() => setOpen(true)}
        aria-label={isTeacher ? "Open Study Buddy (teacher)" : "Open Study Buddy"}
        title="Study Buddy — AI helper"
        className={cn(
          "fixed right-5 z-[100] group inline-flex h-16 w-16 items-center justify-center rounded-full",
          // Sit above the mobile bottom navbar (~72px + iOS safe area), normal offset on desktop.
          "bottom-[calc(90px+env(safe-area-inset-bottom))] lg:bottom-6",
          "bg-gradient-to-br from-primary to-teal text-primary-foreground shadow-elevated ring-4 ring-background",
          "transition-all hover:scale-110 hover:shadow-glow active:scale-95 animate-in fade-in zoom-in",
          open && "opacity-0 pointer-events-none"
        )}
      >
        <Brain className="h-7 w-7" />
        <span className="absolute -top-1 -right-1 inline-flex h-5 w-5 items-center justify-center rounded-full bg-amber-400 text-amber-950 text-[10px] font-bold shadow ring-2 ring-background">
          <Sparkles className="h-3 w-3" />
        </span>
        <span className="pointer-events-none absolute inset-0 rounded-full bg-primary/40 animate-ping opacity-30" aria-hidden />
      </button>

      <Sheet open={open} onOpenChange={setOpen}>
        <SheetContent side="right" className="w-full sm:max-w-md p-0 flex flex-col gap-0">
          <SheetHeader className="border-b px-4 py-3 bg-gradient-to-br from-primary/10 via-background to-teal/10">
            <div className="flex items-center justify-between gap-2">
              <div className="flex items-center gap-3">
                <div className="h-10 w-10 rounded-full bg-gradient-to-br from-primary to-teal text-primary-foreground inline-flex items-center justify-center shadow">
                  <Bot className="h-5 w-5" />
                </div>
                <div className="text-left">
                  <SheetTitle className="text-base leading-tight flex items-center gap-1.5">
                    Study Buddy
                    <Sparkles className="h-3.5 w-3.5 text-amber-500" />
                  </SheetTitle>
                  <p className="text-[11px] text-muted-foreground">AI · powered by Gemini</p>
                </div>
              </div>
              <Button variant="ghost" size="sm" onClick={clearChat} className="text-muted-foreground gap-1.5">
                <Trash2 className="h-3.5 w-3.5" /> Clear
              </Button>
            </div>
          </SheetHeader>

          {/* Messages */}
          <div ref={scrollRef} className="flex-1 overflow-y-auto px-4 py-4 space-y-3 bg-muted/20">
            {messages.map((m, i) => (
              <MessageBubble key={i} role={m.role} content={m.content} />
            ))}
            {sending && (
              <div className="flex items-end gap-2">
                <div className="h-7 w-7 rounded-full bg-gradient-to-br from-primary to-teal text-primary-foreground inline-flex items-center justify-center shrink-0">
                  <Bot className="h-4 w-4" />
                </div>
                <div className="rounded-2xl rounded-bl-sm bg-card border px-3 py-2 shadow-sm">
                  <div className="flex gap-1">
                    <span className="h-1.5 w-1.5 rounded-full bg-muted-foreground/60 animate-bounce" style={{ animationDelay: "0ms" }} />
                    <span className="h-1.5 w-1.5 rounded-full bg-muted-foreground/60 animate-bounce" style={{ animationDelay: "150ms" }} />
                    <span className="h-1.5 w-1.5 rounded-full bg-muted-foreground/60 animate-bounce" style={{ animationDelay: "300ms" }} />
                  </div>
                </div>
              </div>
            )}
          </div>

          {/* Composer */}
          <div className="border-t bg-background p-3">
            <div className="flex gap-2">
              <Input
                value={input}
                onChange={(e) => setInput(e.target.value)}
                onKeyDown={onKey}
                placeholder={isTeacher ? "Ask for a quiz, lesson idea, or draft..." : "Ask anything about your assignments..."}
                disabled={sending}
                maxLength={2000}
              />
              <Button onClick={send} disabled={sending || !input.trim()} size="icon" aria-label="Send">
                <Send className="h-4 w-4" />
              </Button>
            </div>
          </div>
        </SheetContent>
      </Sheet>
    </>
  );
}

function MessageBubble({ role, content }: { role: "user" | "assistant"; content: string }) {
  const isUser = role === "user";
  return (
    <div className={cn("flex items-end gap-2", isUser && "flex-row-reverse")}>
      <div className={cn(
        "h-7 w-7 rounded-full inline-flex items-center justify-center shrink-0 text-xs font-semibold",
        isUser ? "bg-secondary text-secondary-foreground" : "bg-gradient-to-br from-primary to-teal text-primary-foreground",
      )}>
        {isUser ? "You" : <Bot className="h-4 w-4" />}
      </div>
      <div className={cn(
        "max-w-[80%] rounded-2xl px-3 py-2 text-sm shadow-sm whitespace-pre-wrap break-words",
        isUser
          ? "bg-primary text-primary-foreground rounded-br-sm"
          : "bg-card border rounded-bl-sm",
      )}>
        {renderMarkdownLite(content)}
      </div>
    </div>
  );
}

/** Lightweight markdown: **bold**, line breaks, and bullets. Avoids extra deps. */
function renderMarkdownLite(text: string) {
  const lines = text.split("\n");
  return (
    <div className="space-y-1">
      {lines.map((line, i) => {
        const bullet = /^\s*[-*]\s+/.test(line);
        const clean = bullet ? line.replace(/^\s*[-*]\s+/, "") : line;
        const parts = clean.split(/(\*\*[^*]+\*\*)/g).map((p, j) =>
          /^\*\*[^*]+\*\*$/.test(p)
            ? <strong key={j}>{p.slice(2, -2)}</strong>
            : <span key={j}>{p}</span>
        );
        return bullet
          ? <div key={i} className="flex gap-2"><span className="text-muted-foreground">•</span><div>{parts}</div></div>
          : <div key={i}>{parts.length === 1 && parts[0].props.children === "" ? <br /> : parts}</div>;
      })}
    </div>
  );
}