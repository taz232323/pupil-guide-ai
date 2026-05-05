import { differenceInCalendarDays } from "date-fns";

// 8 visually distinct hues. Use HSL so they look right in both themes.
const PALETTE_HUES = [210, 280, 340, 20, 45, 140, 175, 250];

export function classColor(classId: string): { bg: string; fg: string; border: string; hue: number } {
  let h = 0;
  for (let i = 0; i < classId.length; i++) h = (h * 31 + classId.charCodeAt(i)) >>> 0;
  const hue = PALETTE_HUES[h % PALETTE_HUES.length];
  return {
    hue,
    bg: `hsl(${hue} 85% 92%)`,
    fg: `hsl(${hue} 70% 30%)`,
    border: `hsl(${hue} 70% 55%)`,
  };
}

export function classColorDark(classId: string) {
  const { hue } = classColor(classId);
  return {
    bg: `hsl(${hue} 50% 22%)`,
    fg: `hsl(${hue} 80% 80%)`,
    border: `hsl(${hue} 60% 55%)`,
  };
}

export type AssignmentLite = {
  id: string;
  title: string;
  class_id: string;
  class_name: string;
  due_date: string | null;
  question_count?: number;
  has_open_response?: boolean;
};

export function estimateMinutes(a: AssignmentLite): number {
  const q = a.question_count ?? 0;
  if (q === 0) return 30;
  if (a.has_open_response) return Math.min(180, 30 * q);
  return Math.min(90, 15 * q);
}

export function isOverdue(due: string | null, completed: boolean): boolean {
  if (!due || completed) return false;
  return new Date(due).getTime() < Date.now();
}

export function daysUntil(due: string): number {
  return differenceInCalendarDays(new Date(due), new Date());
}