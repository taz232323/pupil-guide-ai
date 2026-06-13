export const STUDENT_COINS_CHANGED_EVENT = "grapheion:student-coins-changed";
export const STUDENT_STREAKS_CHANGED_EVENT = "grapheion:student-streaks-changed";

type StudentRefreshDetail = {
  userId?: string;
  reason?: string;
};

function notify(eventName: string, detail: StudentRefreshDetail = {}) {
  if (typeof window === "undefined") return;
  window.dispatchEvent(new CustomEvent<StudentRefreshDetail>(eventName, { detail }));
}

export function notifyStudentCoinsChanged(detail: StudentRefreshDetail = {}) {
  notify(STUDENT_COINS_CHANGED_EVENT, detail);
}

export function notifyStudentStreaksChanged(detail: StudentRefreshDetail = {}) {
  notify(STUDENT_STREAKS_CHANGED_EVENT, detail);
}

export function isStudentRefreshForUser(event: Event, userId: string) {
  const detail = (event as CustomEvent<StudentRefreshDetail>).detail;
  return !detail?.userId || detail.userId === userId;
}
