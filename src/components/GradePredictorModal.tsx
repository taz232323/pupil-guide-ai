import { useEffect, useMemo, useState } from "react";
import { ArrowDown, ArrowUp, Minus, X, Calculator } from "lucide-react";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Slider } from "@/components/ui/slider";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { cn } from "@/lib/utils";
import { CountUp } from "@/components/CountUp";

type GradePredictorModalProps = {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  className: string;
  currentPct: number | null;
  totalEarned: number;
  totalPossible: number;
};

const GRADE_THRESHOLDS = { A: 90, B: 80, C: 70, D: 60 };

function letterGrade(pct: number | null): string {
  if (pct == null) return "—";
  if (pct >= 90) return "A";
  if (pct >= 80) return "B";
  if (pct >= 70) return "C";
  if (pct >= 60) return "D";
  return "F";
}

function pctColor(pct: number | null): string {
  if (pct == null) return "text-muted-foreground";
  if (pct >= 80) return "text-success";
  if (pct >= 70) return "text-warning";
  return "text-destructive";
}

export function GradePredictorModal({
  open,
  onOpenChange,
  className,
  currentPct,
  totalEarned,
  totalPossible,
}: GradePredictorModalProps) {
  const [yourScore, setYourScore] = useState(0);
  const [outOf, setOutOf] = useState(100);
  const [targetGrade, setTargetGrade] = useState<"A" | "B" | "C" | "D">("A");

  // Reset when modal opens
  useEffect(() => {
    if (open) {
      setYourScore(0);
      setOutOf(100);
      setTargetGrade("A");
    }
  }, [open]);

  // Calculate new grade
  const { newPct, newLetter, change } = useMemo(() => {
    const newTotalEarned = totalEarned + yourScore;
    const newTotalPossible = totalPossible + outOf;
    const newPct = newTotalPossible > 0 
      ? Math.round((newTotalEarned / newTotalPossible) * 1000) / 10 
      : null;
    const newLetter = letterGrade(newPct);
    
    let change: "up" | "down" | "same" = "same";
    if (newPct != null && currentPct != null) {
      if (newPct > currentPct + 0.05) change = "up";
      else if (newPct < currentPct - 0.05) change = "down";
    }
    
    return { newPct, newLetter, change };
  }, [totalEarned, totalPossible, yourScore, outOf, currentPct]);

  // Calculate minimum score needed for target grade
  const { minScore, achievable } = useMemo(() => {
    const targetPct = GRADE_THRESHOLDS[targetGrade];
    const newTotalPossible = totalPossible + outOf;
    const minScore = Math.ceil((targetPct / 100) * newTotalPossible - totalEarned);
    const achievable = minScore >= 0 && minScore <= outOf;
    return { minScore: Math.max(0, minScore), achievable };
  }, [targetGrade, totalEarned, totalPossible, outOf]);

  const handleScoreChange = (value: string) => {
    const num = Math.max(0, Math.min(outOf, parseInt(value) || 0));
    setYourScore(num);
  };

  const handleOutOfChange = (value: string) => {
    const num = Math.max(1, parseInt(value) || 100);
    setOutOf(num);
    if (yourScore > num) setYourScore(num);
  };

  const handleSliderChange = (value: number[]) => {
    setYourScore(value[0]);
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Calculator className="h-5 w-5 text-primary" />
            <span className="text-gradient-primary">{className}</span>
          </DialogTitle>
        </DialogHeader>

        <div className="space-y-6">
          {/* Current Grade */}
          <div className="text-center py-2">
            <p className="text-xs uppercase tracking-wide text-muted-foreground font-semibold mb-1">
              Current Grade
            </p>
            <div className="flex items-baseline justify-center gap-2">
              <span className={cn("text-4xl font-bold font-tabular", pctColor(currentPct))}>
                {currentPct != null ? <CountUp value={currentPct} duration={800} suffix="%" /> : "—"}
              </span>
              <span className={cn("text-xl font-semibold", pctColor(currentPct))}>
                {letterGrade(currentPct)}
              </span>
            </div>
          </div>

          {/* What If Calculator */}
          <div className="space-y-4 rounded-lg border border-border p-4 bg-muted/30">
            <p className="text-sm font-semibold text-muted-foreground">
              If I score...
            </p>
            
            <div className="grid grid-cols-2 gap-3">
              <div className="space-y-1.5">
                <Label htmlFor="your-score" className="text-xs">Your score</Label>
                <Input
                  id="your-score"
                  type="number"
                  min={0}
                  max={outOf}
                  value={yourScore}
                  onChange={(e) => handleScoreChange(e.target.value)}
                  className="font-tabular"
                />
              </div>
              <div className="space-y-1.5">
                <Label htmlFor="out-of" className="text-xs">Out of</Label>
                <Input
                  id="out-of"
                  type="number"
                  min={1}
                  value={outOf}
                  onChange={(e) => handleOutOfChange(e.target.value)}
                  className="font-tabular"
                />
              </div>
            </div>

            <div className="space-y-2">
              <Slider
                value={[yourScore]}
                onValueChange={handleSliderChange}
                max={outOf}
                step={1}
                className="py-2"
              />
              <div className="flex justify-between text-[10px] text-muted-foreground font-tabular">
                <span>0</span>
                <span>{outOf}</span>
              </div>
            </div>

            {/* Result */}
            <div className={cn(
              "flex items-center justify-between rounded-md border-2 px-4 py-3 transition-spring",
              change === "up" && "border-success/50 bg-success/10",
              change === "down" && "border-destructive/50 bg-destructive/10",
              change === "same" && "border-border bg-muted/50"
            )}>
              <div className="flex items-center gap-2">
                {change === "up" && <ArrowUp className="h-5 w-5 text-success animate-pop-in" />}
                {change === "down" && <ArrowDown className="h-5 w-5 text-destructive animate-pop-in" />}
                {change === "same" && <Minus className="h-5 w-5 text-muted-foreground" />}
                <span className="text-sm font-medium">New Grade</span>
              </div>
              <div className="flex items-baseline gap-2">
                <span className={cn("text-2xl font-bold font-tabular", pctColor(newPct))}>
                  {newPct != null ? `${newPct}%` : "—"}
                </span>
                <span className={cn("text-lg font-semibold", pctColor(newPct))}>
                  {newLetter}
                </span>
              </div>
            </div>
          </div>

          {/* Reverse Calculator */}
          <div className="space-y-3 rounded-lg border border-border p-4 bg-muted/30">
            <p className="text-sm font-semibold text-muted-foreground">
              What do I need?
            </p>
            
            <div className="flex items-center gap-3">
              <Label className="text-sm shrink-0">Target grade:</Label>
              <Select value={targetGrade} onValueChange={(v) => setTargetGrade(v as typeof targetGrade)}>
                <SelectTrigger className="w-20">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="A">A</SelectItem>
                  <SelectItem value="B">B</SelectItem>
                  <SelectItem value="C">C</SelectItem>
                  <SelectItem value="D">D</SelectItem>
                </SelectContent>
              </Select>
            </div>

            <div className={cn(
              "rounded-md px-4 py-3 text-center",
              achievable ? "bg-primary/10 border border-primary/30" : "bg-destructive/10 border border-destructive/30"
            )}>
              {achievable ? (
                <p className="text-sm">
                  Score at least <span className="font-bold text-primary font-tabular">{minScore}</span> out of <span className="font-tabular">{outOf}</span>
                </p>
              ) : (
                <p className="text-sm text-destructive font-medium">
                  Not achievable on one assignment
                </p>
              )}
            </div>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}
