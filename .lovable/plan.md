# Show which students are missing assignments

Right now the teacher side surfaces missing-work *counts* in two places, but never names the students:

1. **TeacherDashboard** → class "pulse" cards show a red **Missing** number, and the **At-risk students** list says "· N missing" — neither is clickable.
2. **TeacherAssignmentDetail** → the left student list shows a green check next to students who answered, but doesn't visibly flag students who never submitted.

## Changes

### 1. `src/pages/TeacherAssignmentDetail.tsx`
- Compute `missingStudents` = class members with no row in `submissions` AND no row in `assignment_answers`.
- In the **Students** sidebar:
  - Sort missing students to the top.
  - Add a small red "Missing" pill (using `bg-destructive/10 text-destructive`) next to their name instead of the green check.
  - Add a header row "Missing (N)" / "Submitted (M)" so the split is obvious.
- Add a **"Remind missing students"** button at the top of the sidebar that inserts a `notifications` row for each missing student linking back to the assignment (reuses the existing notifications table — no schema change).

### 2. `src/pages/TeacherDashboard.tsx`
- Make the **Missing** number on each class pulse card open a small dialog listing the missing students for that class, grouped by assignment (student name → assignment title → due date). Each row links to `/teacher/assignments/:id`.
- In the **At-risk students** list, change the row link from `/teacher/progress` to a popover that lists *which* assignments that student is missing, with links to each.
- Reuse already-fetched data (`assignments`, `submissions`, `class_members`, `profiles`) — no extra round-trips.

### 3. Tiny shared bit
- Add a `MissingStudentsDialog` component under `src/components/teacher/` so both the dashboard pulse card and (optionally) the assignment detail can share the list UI.

## Out of scope
- Email/SMS reminders (only in-app notification bell).
- Changing the at-risk threshold logic.
- Teacher progress page table — already has a Missing column with names visible per row.

## Files
- **Edit:** `src/pages/TeacherDashboard.tsx`, `src/pages/TeacherAssignmentDetail.tsx`
- **Create:** `src/components/teacher/MissingStudentsDialog.tsx`
