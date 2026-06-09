export const MOOD_OPTIONS = [
  { key: "happy", label: "Happy", emoji: "🙂", tone: "bg-success/10 text-success border-success/30" },
  { key: "excited", label: "Excited", emoji: "😄", tone: "bg-primary/10 text-primary border-primary/30" },
  { key: "neutral", label: "Neutral", emoji: "😐", tone: "bg-muted text-muted-foreground border-border" },
  { key: "tired", label: "Tired", emoji: "😴", tone: "bg-secondary text-secondary-foreground border-border" },
  { key: "sad", label: "Sad", emoji: "😟", tone: "bg-blue-500/10 text-blue-700 dark:text-blue-300 border-blue-500/30" },
  { key: "anxious", label: "Anxious", emoji: "😰", tone: "bg-warning/10 text-warning border-warning/30" },
  { key: "frustrated", label: "Frustrated", emoji: "😤", tone: "bg-orange-500/10 text-orange-700 dark:text-orange-300 border-orange-500/30" },
  { key: "angry", label: "Angry", emoji: "😠", tone: "bg-destructive/10 text-destructive border-destructive/30" },
] as const;

export type MoodKey = (typeof MOOD_OPTIONS)[number]["key"];

export function getMoodOption(moodKey: string | null | undefined) {
  return MOOD_OPTIONS.find((option) => option.key === moodKey);
}
