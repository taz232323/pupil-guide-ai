# Student Calendar Page

A new `/student/calendar` route added to the student sidebar that aggregates assignment due dates across all enrolled classes plus private personal reminders, with smart planning features layered on top.

## 1. Database (new migration)

**Table `personal_reminders`** — private per-student events.

Columns:
- `id uuid pk default gen_random_uuid()`
- `student_id uuid not null` (defaults to `auth.uid()`)
- `title text not null`
- `note text`
- `start_at timestamptz not null` (date + time)
- `duration_minutes int default 30`
- `kind text default 'reminder'` (`reminder` or `study_block`)
- `created_at`, `updated_at` timestamps

RLS: students can SELECT/INSERT/UPDATE/DELETE only their own rows (`auth.uid() = student_id`). No teacher visibility.

**Table `assignment_completions_view`** — not needed; we already mark assignments done via `assignment_status_records` (status = `submitted`/`completed`). The "mark done" action from the calendar will upsert into `assignment_status_records` with status `submitted` (matching the existing pattern), so no schema change required.

## 2. Routing & Navigation

- Add route `/student/calendar` in `src/App.tsx` wrapped in `ProtectedRoute requiredRole="student"`.
- Add `{ to: "/student/calendar", label: "Calendar", icon: Calendar }` to `STUDENT_NAV` in `src/components/DashboardShell.tsx` (placed between Assignments and Grades).

## 3. New page: `src/pages/StudentCalendar.tsx`

Uses `DashboardShell` and `date-fns` (already a dep via shadcn calendar).

Data fetched on mount (filtered to current student):
- `assignments` joined with `classes` (only classes the student is in via `class_members`) — gets title, due_date, class_id, class name.
- `submissions` for this student → set of completed assignment ids.
- `assignment_status_records` for this student → status per assignment.
- `personal_reminders` for this student.

Color coding: deterministic palette mapped by `class.id` (hash → index into a fixed 8-color HSL palette using existing semantic tokens where possible). Same color used everywhere the class appears. Legend chips at top.

### Header bar
- Title "Calendar"
- View toggle: **Month / Week** (Tabs)
- **Today** button — snaps `cursorDate` back to `new Date()`
- Prev / Next arrows
- **Plan My Week** button (opens dialog, see §6)
- **+ Add Reminder** button (opens dialog)
- Class color legend row underneath (clickable chips also act as filters)

### Month view
- 7-col grid of day cells. Each cell shows date number + up to 3 colored dots/pills:
  - Assignment due → pill in class color, strike-through if completed, **red border + red text** if overdue & not completed.
  - Personal reminder → muted outline pill with 🔔.
- Click a day → opens right-side `Sheet` panel listing everything due that day:
  - Assignment cards: title, class name in class color, due time, [Open] link (`/student/assignments/:id`), [Mark done] button (calls upsert on `assignment_status_records`). Overdue items shown with destructive styling.
  - Personal reminders: title, time, note, edit/delete buttons.
  - "+ Add reminder for this day" button.

### Week view
- 7 columns (Sun–Sat of cursor week). Each column has the day header + a stacked vertical list of cards (assignments + reminders) for that day, sorted by time. Same color coding, same actions inline.

### Overdue band
- Persistent collapsible "Overdue" section above the calendar listing every past-due, not-submitted assignment in red. They also still appear on their original day in red.

### Add / Edit reminder dialog
- Fields: title (required), date (shadcn DatePicker with `pointer-events-auto`), time (HTML time input), optional note, kind (reminder / study block).
- Insert/update into `personal_reminders`.

## 4. Realtime
- Subscribe to `personal_reminders` filtered by `student_id` for live updates.
- Refetch assignments when `assignment_status_records` for this student changes.

## 5. Smart features

### Plan My Week (Sheet/Dialog)
- Pulls all assignments + reminders due in next 7 days from current date.
- Groups by day, sorted within each day by: overdue first → due today → earliest due time.
- Each item shows class chip, title, urgency tag ("Due in 2 days"), and [Open]/[Mark done] actions.

### Suggested Study Schedule (card below calendar)
- Pure-client heuristic. For each upcoming assignment in the next 7 days that isn't completed:
  - Estimate minutes: assignment without questions → 30 min; with multiple-choice questions → 15 min × question count capped 90; with open-response → 30 min × question count capped 180. (Question counts already available via `assignment_questions` count query.)
  - Distribute the work into 30–60 min study blocks across the days between now and `due_date − 1 day`, preferring evenings (default 5–7 PM), avoiding doubling up the same class on the same day.
- Render as a recommendation card with a list of suggested blocks (day · time · class · assignment).
- **Accept** → bulk-insert each block as a `personal_reminders` row of kind `study_block`.
- **Dismiss** → hides the card for the session (localStorage flag with daily reset).

### 3-day & 1-day reminders
- Add a new edge function `assignment-reminders` (scheduled via pg_cron hourly) that:
  - Looks up every assignment whose `due_date` falls in 3 days ± 30 min OR 1 day ± 30 min from `now()`.
  - For each enrolled student without an existing submission, inserts a row into `notifications` with type `assignment` and link `/student/assignments/:id`. Uses a small dedup key in the message so cron re-runs don't duplicate (check: select existing notification with same user_id + link + matching "X day" substring within last 2h).
- Schedule via `cron.schedule` calling the function hourly (uses the `schedule-jobs-supabase-edge-functions` pattern). The existing `NotificationBell` already renders these with the ClipboardList icon.

## 6. Files to add / change

**New**
- `supabase/migrations/<ts>_personal_reminders.sql` — table + RLS + updated_at trigger
- `src/pages/StudentCalendar.tsx`
- `src/components/calendar/MonthView.tsx`
- `src/components/calendar/WeekView.tsx`
- `src/components/calendar/DayPanel.tsx` (right side Sheet content)
- `src/components/calendar/ReminderDialog.tsx`
- `src/components/calendar/PlanWeekSheet.tsx`
- `src/components/calendar/StudySuggestions.tsx`
- `src/lib/calendar.ts` — color-by-class hash, time estimator, overdue helpers
- `supabase/functions/assignment-reminders/index.ts` (+ cron schedule via insert SQL)

**Edited**
- `src/App.tsx` — add route
- `src/components/DashboardShell.tsx` — add nav item

## Out of scope
- Drag-to-reschedule reminders (can be added later)
- Teacher-side calendar
- iCal export

