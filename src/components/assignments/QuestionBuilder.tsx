import { Plus, Trash2, GripVertical } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Card } from "@/components/ui/card";
import { Reveal } from "@/components/Reveal";

export type QType = "multiple_choice" | "short_answer" | "long_answer";

export type DraftQuestion = {
  id?: string;
  question_type: QType;
  prompt: string;
  options?: string[];
  correct_index?: number | null;
  max_score: number;
};

export const newQuestion = (type: QType = "short_answer"): DraftQuestion => ({
  question_type: type,
  prompt: "",
  options: type === "multiple_choice" ? ["", ""] : undefined,
  correct_index: type === "multiple_choice" ? 0 : null,
  max_score: 10,
});

export function QuestionBuilder({
  questions,
  onChange,
}: {
  questions: DraftQuestion[];
  onChange: (next: DraftQuestion[]) => void;
}) {
  const update = (i: number, patch: Partial<DraftQuestion>) => {
    const next = [...questions];
    next[i] = { ...next[i], ...patch };
    onChange(next);
  };
  const remove = (i: number) => onChange(questions.filter((_, idx) => idx !== i));
  const add = (type: QType) => onChange([...questions, newQuestion(type)]);

  const setType = (i: number, type: QType) => {
    const base: Partial<DraftQuestion> = { question_type: type };
    if (type === "multiple_choice") {
      base.options = questions[i].options?.length ? questions[i].options : ["", ""];
      base.correct_index = questions[i].correct_index ?? 0;
    } else {
      base.options = undefined;
      base.correct_index = null;
    }
    update(i, base);
  };

  return (
    <div className="space-y-3">
      {questions.map((q, i) => (
        <Reveal key={i} delay={i * 60}>
        <Card className="p-4 space-y-3 bg-muted/30 transition-spring hover:border-primary/30">
          <div className="flex items-start gap-2">
            <GripVertical className="h-4 w-4 mt-2 text-muted-foreground" />
            <div className="flex-1 space-y-3">
              <div className="flex flex-wrap gap-3 items-center">
                <span className="text-xs font-semibold text-muted-foreground font-tabular">Q{i + 1}</span>
                <Select value={q.question_type} onValueChange={(v) => setType(i, v as QType)}>
                  <SelectTrigger className="w-[180px] h-8"><SelectValue /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="multiple_choice">Multiple choice</SelectItem>
                    <SelectItem value="short_answer">Short answer</SelectItem>
                    <SelectItem value="long_answer">Long answer</SelectItem>
                  </SelectContent>
                </Select>
                <div className="flex items-center gap-2">
                  <Label className="text-xs">Points</Label>
                  <Input
                    type="number"
                    min={1}
                    max={100}
                    value={q.max_score}
                    onChange={(e) => update(i, { max_score: Math.max(1, Number(e.target.value) || 1) })}
                    className="w-20 h-8"
                  />
                </div>
                <Button type="button" variant="ghost" size="sm" className="ml-auto text-destructive" onClick={() => remove(i)}>
                  <Trash2 className="h-4 w-4" />
                </Button>
              </div>
              <Textarea
                placeholder="Question prompt..."
                value={q.prompt}
                onChange={(e) => update(i, { prompt: e.target.value })}
                rows={2}
              />
              {q.question_type === "multiple_choice" && (
                <div className="space-y-2">
                  <Label className="text-xs">Options (select correct answer)</Label>
                  {(q.options ?? []).map((opt, oi) => (
                    <div key={oi} className="flex items-center gap-2">
                      <input
                        type="radio"
                        name={`correct-${i}`}
                        checked={q.correct_index === oi}
                        onChange={() => update(i, { correct_index: oi })}
                        className="h-4 w-4 accent-primary"
                      />
                      <Input
                        placeholder={`Option ${oi + 1}`}
                        value={opt}
                        onChange={(e) => {
                          const opts = [...(q.options ?? [])];
                          opts[oi] = e.target.value;
                          update(i, { options: opts });
                        }}
                      />
                      {(q.options?.length ?? 0) > 2 && (
                        <Button type="button" variant="ghost" size="icon" className="h-8 w-8"
                          onClick={() => {
                            const opts = (q.options ?? []).filter((_, idx) => idx !== oi);
                            const ci = q.correct_index ?? 0;
                            update(i, {
                              options: opts,
                              correct_index: ci >= opts.length ? 0 : ci > oi ? ci - 1 : ci,
                            });
                          }}>
                          <Trash2 className="h-3 w-3" />
                        </Button>
                      )}
                    </div>
                  ))}
                  {(q.options?.length ?? 0) < 4 && (
                    <Button type="button" variant="outline" size="sm"
                      onClick={() => update(i, { options: [...(q.options ?? []), ""] })}>
                      <Plus className="h-3 w-3 mr-1" />Add option
                    </Button>
                  )}
                </div>
              )}
            </div>
          </div>
        </Card>
        </Reveal>
      ))}
      <div className="flex flex-wrap gap-2">
        <Button type="button" variant="outline" size="sm" onClick={() => add("multiple_choice")}>
          <Plus className="h-3 w-3 mr-1" />Multiple choice
        </Button>
        <Button type="button" variant="outline" size="sm" onClick={() => add("short_answer")}>
          <Plus className="h-3 w-3 mr-1" />Short answer
        </Button>
        <Button type="button" variant="outline" size="sm" onClick={() => add("long_answer")}>
          <Plus className="h-3 w-3 mr-1" />Long answer
        </Button>
      </div>
    </div>
  );
}

export function validateQuestions(qs: DraftQuestion[]): string | null {
  for (let i = 0; i < qs.length; i++) {
    const q = qs[i];
    if (!q.prompt.trim()) return `Question ${i + 1}: prompt is required`;
    if (q.question_type === "multiple_choice") {
      const opts = (q.options ?? []).map((o) => o.trim());
      if (opts.length < 2) return `Question ${i + 1}: at least 2 options`;
      if (opts.some((o) => !o)) return `Question ${i + 1}: all options must have text`;
      if (q.correct_index == null || q.correct_index < 0 || q.correct_index >= opts.length)
        return `Question ${i + 1}: mark a correct answer`;
    }
  }
  return null;
}