import { useEffect, useRef, useState } from "react";
import { Sheet, SheetContent, SheetHeader, SheetTitle } from "@/components/ui/sheet";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Sparkles, Send, Trash2, Bot, Brain, Paintbrush, AlertCircle } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";
import { cn } from "@/lib/utils";
import { SketchCard } from "@/components/study-buddy/SketchCard";
import type { SketchPayload, StudyBuddyMessage } from "@/components/study-buddy/types";

const MAX_MESSAGES_TO_SEND = 12;

export function StudyBuddy() {
  const { user, role } = useAuth();
  const [open, setOpen] = useState(false);
  const [firstName, setFirstName] = useState<string>("");
  const [messages, setMessages] = useState<StudyBuddyMessage[]>([]);
  const [input, setInput] = useState("");
  const [sending, setSending] = useState(false);
  const scrollRef = useRef<HTMLDivElement>(null);
  const isTeacher = role === "teacher";
  const latestSketchablePrompt = getLatestSketchablePrompt(messages);
  const canSketch = Boolean(input.trim() || latestSketchablePrompt);

  useEffect(() => {
    if (!user) return;
    supabase.from("profiles").select("full_name").eq("id", user.id).maybeSingle()
      .then(({ data }) => setFirstName((data?.full_name?.split(" ")[0]) || (isTeacher ? "Teacher" : "friend")));
  }, [isTeacher, user]);

  useEffect(() => {
    if (open && messages.length === 0) {
      const greeting = isTeacher
        ? `Hi ${firstName || "Teacher"}! I'm **Study Buddy**, your AI co-teacher. I can help you:\n- Write **assignment descriptions**\n- Generate **quiz questions** for a unit\n- Draft **announcements** or parent emails\n- Brainstorm **lesson ideas**\n\nWhat are we working on?`
        : `Hi ${firstName || "there"}! I'm **Study Buddy**. Ask me to explain a concept, give you practice questions for a unit, or help plan your week. What's up?`;
      setMessages([{ role: "assistant", content: greeting }]);
    }
  }, [firstName, isTeacher, messages.length, open]);

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

  const send = async (mode: "chat" | "sketch" = "chat") => {
    const text = input.trim();
    const promptText = mode === "sketch" ? text || latestSketchablePrompt : text;
    if (!promptText || sending) return;

    setInput("");
    const userText = mode === "sketch" ? `Sketch It: ${promptText}` : promptText;
    const nextMessages: StudyBuddyMessage[] = [...messages, { role: "user", content: userText }];
    setMessages(nextMessages);
    setSending(true);

    try {
      const outbound = nextMessages
        .filter((message) => message.kind !== "error")
        .slice(-MAX_MESSAGES_TO_SEND)
        .map((message) => ({ role: message.role, content: message.content }));

      const { data, error } = await supabase.functions.invoke("study-buddy", {
        body: { mode, messages: outbound },
      });

      if (error) throw error;

      if (mode === "sketch") {
        const sketch = (data as any)?.sketch as SketchPayload | undefined;
        if (!sketch) throw new Error("Study Buddy did not return a sketch.");
        setMessages((prev) => [...prev, {
          role: "assistant",
          content: (data as any)?.reply || sketch.explanation,
          kind: "sketch",
          sketch,
        }]);
      } else {
        setMessages((prev) => [...prev, {
          role: "assistant",
          content: (data as any)?.reply || "Hmm, no response.",
        }]);
      }
    } catch (error) {
      console.warn("Study Buddy request failed.", error);
      setMessages((prev) => [...prev, {
        role: "assistant",
        kind: "error",
        content: mode === "sketch"
          ? "Sketch It could not generate a visual right now. Try a shorter concept, or ask for a text explanation first."
          : "Study Buddy is unavailable right now. Try again in a moment.",
      }]);
    } finally {
      setSending(false);
    }
  };

  const onKey = (event: React.KeyboardEvent<HTMLInputElement>) => {
    if (event.key === "Enter" && !event.shiftKey) {
      event.preventDefault();
      send();
    }
  };

  return (
    <>
      <button
        onClick={() => setOpen(true)}
        aria-label={isTeacher ? "Open Study Buddy (teacher)" : "Open Study Buddy"}
        title="Study Buddy - AI helper"
        className={cn(
          "fixed right-5 z-[100] group inline-flex h-16 w-16 items-center justify-center rounded-full",
          "bottom-[calc(90px+env(safe-area-inset-bottom))] lg:bottom-6",
          "bg-gradient-to-br from-primary to-teal text-primary-foreground shadow-elevated ring-4 ring-background",
          "transition-all hover:scale-110 hover:shadow-glow active:scale-95 animate-in fade-in zoom-in",
          open && "opacity-0 pointer-events-none",
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
          <SheetHeader className="border-b px-4 py-3 pr-12 bg-gradient-to-br from-primary/10 via-background to-teal/10">
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
                  <p className="text-[11px] text-muted-foreground">
                    {sending ? "Thinking..." : "Ready when you are"}
                  </p>
                </div>
              </div>
              <Button variant="ghost" size="sm" onClick={clearChat} className="text-muted-foreground gap-1.5">
                <Trash2 className="h-3.5 w-3.5" /> Clear
              </Button>
            </div>
          </SheetHeader>

          <div ref={scrollRef} className="flex-1 overflow-y-auto px-4 py-4 space-y-3 bg-muted/20">
            {messages.map((message, index) => (
              <MessageBubble key={index} {...message} />
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

          <div className="border-t bg-background p-3">
            <div className="flex gap-2">
              <div className="flex-1 space-y-2">
                <Input
                  value={input}
                  onChange={(event) => setInput(event.target.value)}
                  onKeyDown={onKey}
                  placeholder={isTeacher ? "Ask for a quiz, lesson idea, or draft..." : "Ask anything about your assignments..."}
                  disabled={sending}
                  maxLength={2000}
                />
                <Button
                  type="button"
                  variant="secondary"
                  size="sm"
                  onClick={() => send("sketch")}
                  disabled={sending || !canSketch}
                  title={input.trim() ? "Sketch this prompt" : "Sketch the last question"}
                  className="h-8 gap-1.5 text-xs"
                >
                  <Paintbrush className="h-3.5 w-3.5" />
                  Sketch It
                </Button>
              </div>
              <Button onClick={() => send()} disabled={sending || !input.trim()} size="icon" aria-label="Send">
                <Send className="h-4 w-4" />
              </Button>
            </div>
          </div>
        </SheetContent>
      </Sheet>
    </>
  );
}

function getLatestSketchablePrompt(messages: StudyBuddyMessage[]) {
  const latestUserMessage = [...messages].reverse().find((message) => message.role === "user");
  return latestUserMessage?.content.replace(/^Sketch It:\s*/i, "").trim() ?? "";
}

function MessageBubble({ role, content, kind, sketch }: StudyBuddyMessage) {
  const isUser = role === "user";
  const isSketch = kind === "sketch" && sketch;
  const isError = kind === "error";

  return (
    <div className={cn("flex items-end gap-2", isUser && "flex-row-reverse")}>
      <div
        className={cn(
          "h-7 w-7 rounded-full inline-flex items-center justify-center shrink-0 text-xs font-semibold",
          isUser ? "bg-secondary text-secondary-foreground" : "bg-gradient-to-br from-primary to-teal text-primary-foreground",
          isError && "bg-destructive text-destructive-foreground",
        )}
      >
        {isUser ? "You" : isError ? <AlertCircle className="h-4 w-4" /> : <Bot className="h-4 w-4" />}
      </div>
      <div
        className={cn(
          "rounded-2xl px-3 py-2 text-sm shadow-sm whitespace-pre-wrap break-words",
          isSketch ? "max-w-[92%] w-full" : "max-w-[80%]",
          isUser
            ? "bg-primary text-primary-foreground rounded-br-sm"
            : "bg-card border rounded-bl-sm",
          isError && "border-destructive/40 bg-destructive/10 text-destructive",
        )}
      >
        {isSketch ? <SketchCard sketch={sketch} /> : renderMarkdownLite(content)}
      </div>
    </div>
  );
}

function renderMarkdownLite(text: string) {
  const lines = text.split("\n");
  return (
    <div className="space-y-1">
      {lines.map((line, index) => {
        const bullet = /^\s*[-*]\s+/.test(line);
        const clean = bullet ? line.replace(/^\s*[-*]\s+/, "") : line;
        const parts = clean.split(/(\*\*[^*]+\*\*)/g).map((part, partIndex) =>
          /^\*\*[^*]+\*\*$/.test(part)
            ? <strong key={partIndex}>{part.slice(2, -2)}</strong>
            : <span key={partIndex}>{part}</span>,
        );
        return bullet
          ? <div key={index} className="flex gap-2"><span className="text-muted-foreground">-</span><div>{parts}</div></div>
          : <div key={index}>{parts.length === 1 && parts[0].props.children === "" ? <br /> : parts}</div>;
      })}
    </div>
  );
}
