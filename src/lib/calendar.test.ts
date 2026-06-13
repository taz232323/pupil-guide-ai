import { describe, it, expect } from "vitest";
import { classColor, classColorDark, estimateMinutes, isOverdue, daysUntil, type AssignmentLite } from "./calendar";

const PALETTE_HUES = [210, 280, 340, 20, 45, 140, 175, 250];

const asg = (over: Partial<AssignmentLite>): AssignmentLite => ({
  id: "a", title: "t", class_id: "c", class_name: "C", due_date: null, ...over,
});

describe("calendar.classColor", () => {
  it("is deterministic for the same class id", () => {
    expect(classColor("class-123")).toEqual(classColor("class-123"));
  });

  it("returns a hue from the fixed palette and well-formed hsl strings", () => {
    const c = classColor("some-uuid-here");
    expect(PALETTE_HUES).toContain(c.hue);
    expect(c.bg).toBe(`hsl(${c.hue} 85% 92%)`);
    expect(c.fg).toBe(`hsl(${c.hue} 70% 30%)`);
    expect(c.border).toBe(`hsl(${c.hue} 70% 55%)`);
  });

  it("dark variant shares the same hue as the light variant", () => {
    const id = "abc-def";
    expect(classColorDark(id).bg).toBe(`hsl(${classColor(id).hue} 50% 22%)`);
  });
});

describe("calendar.estimateMinutes", () => {
  it("defaults to 30 minutes when there are no questions", () => {
    expect(estimateMinutes(asg({ question_count: 0 }))).toBe(30);
    expect(estimateMinutes(asg({}))).toBe(30);
  });

  it("scales multiple-choice work at 15 min/question, capped at 90", () => {
    expect(estimateMinutes(asg({ question_count: 4 }))).toBe(60);
    expect(estimateMinutes(asg({ question_count: 10 }))).toBe(90); // capped
  });

  it("scales open-response work at 30 min/question, capped at 180", () => {
    expect(estimateMinutes(asg({ question_count: 4, has_open_response: true }))).toBe(120);
    expect(estimateMinutes(asg({ question_count: 10, has_open_response: true }))).toBe(180); // capped
  });
});

describe("calendar.isOverdue", () => {
  it("is false when there is no due date", () => {
    expect(isOverdue(null, false)).toBe(false);
  });
  it("is false when the work is completed, even if past due", () => {
    expect(isOverdue(new Date(Date.now() - 60_000).toISOString(), true)).toBe(false);
  });
  it("is true when past due and not completed", () => {
    expect(isOverdue(new Date(Date.now() - 60_000).toISOString(), false)).toBe(true);
  });
  it("is false when due in the future and not completed", () => {
    expect(isOverdue(new Date(Date.now() + 3_600_000).toISOString(), false)).toBe(false);
  });
});

describe("calendar.daysUntil", () => {
  // Use noon to avoid midnight-boundary flakiness in calendar-day math.
  const atNoon = (offsetDays: number) => {
    const d = new Date();
    d.setHours(12, 0, 0, 0);
    d.setDate(d.getDate() + offsetDays);
    return d.toISOString();
  };

  it("is 0 for today", () => {
    expect(daysUntil(atNoon(0))).toBe(0);
  });
  it("is positive for future dates", () => {
    expect(daysUntil(atNoon(5))).toBe(5);
  });
  it("is negative for past dates", () => {
    expect(daysUntil(atNoon(-3))).toBe(-3);
  });
});
