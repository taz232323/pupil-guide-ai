## Goal
Let teachers view leaderboards for the classes they teach, mirroring the student experience but scoped to their own classes.

## What teachers will see

A new **Teacher Leaderboard** page at `/teacher/leaderboard`:
- Tabs across the top: **All My Classes** + one tab per class the teacher owns.
- Each tab shows students ranked by **Star Coins** (highest first), with rank, avatar, name, and coin total.
- Top 3 get crown / medal / trophy icons (same visual language as the student leaderboard).
- A small toggle on each class tab to switch the view between **Star Coins** and **Crown Coins** rankings (teachers benefit from seeing both, since Crown Coins reflect unit completion).
- Teachers always see students' real names — anonymous mode (`leaderboard_anonymous`) is a student-side privacy setting and shouldn't hide identities from the class owner.
- Empty states: "No classes yet" / "No students in this class yet."

## Entry points

- Add a **Leaderboard** link in the teacher navigation (sidebar / nav) alongside the other teacher pages.
- Add a compact **Top Students** widget on the Teacher Dashboard (`/teacher`) showing the top 3 across all the teacher's classes, with a "View all" link to the new page — mirroring the student `LeaderboardWidget`.

## Technical notes

- New page: `src/pages/TeacherLeaderboard.tsx`, registered as a route in `src/App.tsx` and protected by `ProtectedRoute` with the teacher role.
- New widget: `src/components/TeacherLeaderboardWidget.tsx` (or generalize the existing `LeaderboardWidget` with a `mode: "student" | "teacher"` prop — preferred to avoid duplication).
- Data: query `classes` where `teacher_id = auth.uid()`, then `class_members` for those class IDs, then batch-fetch `profiles` (id, full_name, avatar_items) and `student_coins` (star_coins, crown_coins). Existing RLS already lets teachers read all of these for their own classes — **no migration or policy changes needed**.
- Realtime: subscribe to `student_coins` changes (same channel pattern as the student page) so awards from "Give coins" reflect immediately.
- Add a nav entry in whatever component renders the teacher sidebar (likely `DashboardShell` or a teacher nav config).

## Out of scope

- No changes to coin logic, RLS, or database schema.
- No editing/awarding from the leaderboard itself (that already lives on the class roster via "Give coins").
