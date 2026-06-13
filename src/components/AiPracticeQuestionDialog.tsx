import { useState } from "react";
import { Sparkles, Loader2, Wand2 } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Checkbox } from "@/components/ui/checkbox";
import {
  Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription, DialogFooter,
} from "@/components/ui/dialog";
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from "@/components/ui/select";
import { cn } from "@/lib/utils";
import { toast } from "sonner";

export type GeneratedQuestion = { prompt: string; options: string[]; correctIndex: number };

/**
 * Teacher tool: generate multiple-choice practice questions with AI (Gemini edge
 * function), then review, tweak the correct answer, select which to keep, and add
 * them to the class question bank via `onAdd`.
 */
export function AiPracticeQuestionDialog({
  open,
  onClose,
  classId,
  onAdd,
}: {
  open: boolean;
  onClose: () => void;
  classId: string;
  onAdd: (questions: GeneratedQuestion[]) => Promise<void> | void;
}) {
  const [topic, setTopic] = useState("");
  const [count, setCount] = useState("5");
  const [difficulty, setDifficulty] = useState("medium");

  const [generating, setGenerating] = useState(false);
  const [adding, setAdding] = useState(false);
  const [questions, setQuestions] = useState<GeneratedQuestion[] | null>(null);
  const [selected, setSelected] = useState<Set<number>>(new Set());
  const [correct, setCorrect] = useState<Record<number, number>>({});

  const reset = () => {
    setQuestions(null);
    setSelected(new Set());
    setCorrect({});
  };

  const generate = async () => {
    if (!topic.trim()) {
      toast.error("Enter a topic to generate questions about");
      return;
    }
    setGenerating(true);
    reset();
    const { data, error } = await supabase.functions.invoke("generate-practice-questions", {
      body: { classId, topic: topic.trim(), count: Number(count), difficulty },
    });
    setGenerating(false);

    if (error || data?.error) {
      toast.error(
        data?.error
          ? `Couldn't generate: ${data.error}`
          : "AI generation is unavailable. Make sure the 'generate-practice-questions' function is deployed.",
      );
      return;
    }
    const qs: GeneratedQuestion[] = Array.isArray(data?.questions) ? data.questions : [];
    if (qs.length === 0) {
      toast.error("The AI didn't return any usable questions — try a more specific topic.");
      return;
    }
    setQuestions(qs);
    setSelected(new Set(qs.map((_, i) => i))); // select all by default
    setCorrect(Object.fromEntries(qs.map((q, i) => [i, q.correctIndex])));
  };

  const toggle = (i: number) =>
    setSelected((prev) => {
      const next = new Set(prev);
      next.has(i) ? next.delete(i) : next.add(i);
      return next;
    });

  const addSelected = async () => {
    if (!questions) return;
    const chosen = questions
      .map((q, i) => ({ ...q, correctIndex: correct[i] ?? q.correctIndex }))
      .filter((_, i) => selected.has(i));
    if (chosen.length === 0) {
      toast.error("Select at least one question to add");
      return;
    }
    setAdding(true);
    try {
      await onAdd(chosen);
      handleClose();
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Could not add the generated questions.");
    } finally {
      setAdding(false);
    }
  };

  const handleClose = () => {
    reset();
    setTopic("");
    onClose();
  };

  return (
    <Dialog open={open} onOpenChange={(o) => !o && handleClose()}>
      <DialogContent className="max-w-2xl">
        <DialogHeader>
          <DialogTitle className="font-display flex items-center gap-2">
            <Sparkles className="h-5 w-5 text-primary" /> Generate questions with AI
          </DialogTitle>
          <DialogDescription>
            Describe a topic and let AI draft multiple-choice questions. Review, pick the
            ones you like, then add them to your question bank.
          </DialogDescription>
        </DialogHeader>

        {/* Controls */}
        <div className="grid gap-3 sm:grid-cols-[1fr_auto_auto]">
          <Input
            placeholder="Topic — e.g. 'solving two-step linear equations'"
            value={topic}
            onChange={(e) => setTopic(e.target.value)}
            maxLength={400}
          />
          <Select value={count} onValueChange={setCount}>
            <SelectTrigger className="w-28" aria-label="Number of questions"><SelectValue /></SelectTrigger>
            <SelectContent>
              {["3", "5", "8", "10"].map((n) => <SelectItem key={n} value={n}>{n} questions</SelectItem>)}
            </SelectContent>
          </Select>
          <Select value={difficulty} onValueChange={setDifficulty}>
            <SelectTrigger className="w-32" aria-label="Difficulty"><SelectValue /></SelectTrigger>
            <SelectContent>
              <SelectItem value="easy">Easy</SelectItem>
              <SelectItem value="medium">Medium</SelectItem>
              <SelectItem value="hard">Hard</SelectItem>
            </SelectContent>
          </Select>
        </div>
        <Button onClick={generate} disabled={generating} className="w-full sm:w-auto">
          {generating ? <><Loader2 className="h-4 w-4 animate-spin" /> Generating…</> : <><Wand2 className="h-4 w-4" /> Generate</>}
        </Button>

        {/* Candidates */}
        {questions && questions.length > 0 && (
          <div className="max-h-[45vh] space-y-3 overflow-y-auto pr-1">
            <p className="text-xs text-muted-foreground">
              {selected.size} of {questions.length} selected · tap an option to set the correct answer
            </p>
            {questions.map((q, qi) => (
              <div
                key={qi}
                className={cn(
                  "rounded-xl border p-3 transition-colors",
                  selected.has(qi) ? "border-primary/40 bg-primary/5" : "border-border",
                )}
              >
                <div className="flex items-start gap-2">
                  <Checkbox checked={selected.has(qi)} onCheckedChange={() => toggle(qi)} className="mt-0.5" />
                  <div className="min-w-0 flex-1">
                    <p className="text-sm font-medium">{q.prompt}</p>
                    <div className="mt-2 space-y-1">
                      {q.options.map((opt, oi) => {
                        const isCorrect = (correct[qi] ?? q.correctIndex) === oi;
                        return (
                          <button
                            key={oi}
                            type="button"
                            onClick={() => setCorrect((c) => ({ ...c, [qi]: oi }))}
                            className={cn(
                              "flex w-full items-center gap-2 rounded-md px-2 py-1 text-left text-xs transition-colors",
                              isCorrect ? "bg-success-soft text-success font-medium" : "text-muted-foreground hover:bg-muted",
                            )}
                          >
                            <span className="font-tabular">{String.fromCharCode(65 + oi)}.</span>
                            <span className="flex-1">{opt}</span>
                            {isCorrect && <span aria-label="correct answer">✓</span>}
                          </button>
                        );
                      })}
                    </div>
                  </div>
                </div>
              </div>
            ))}
          </div>
        )}

        <DialogFooter>
          <Button variant="outline" onClick={handleClose}>Cancel</Button>
          {questions && questions.length > 0 && (
            <Button onClick={addSelected} disabled={adding || selected.size === 0}>
              {adding ? "Adding…" : `Add ${selected.size} to bank`}
            </Button>
          )}
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

export default AiPracticeQuestionDialog;
