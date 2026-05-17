# Pupil Guide AI E2E Bug Report

Test date: 2026-05-16/17
Repo: `taz232323/pupil-guide-ai`

## Environment

- Local checkout: `/Users/harish.desai/pupil-guide-ai`
- App: Vite React Supabase app
- Dev server tested at: `http://127.0.0.1:5173/`
- Test accounts created:
  - teacher: throwaway `pupilguide-e2e-teacher-*` account
  - student: throwaway `pupilguide-e2e-student-*` account

## Checks Run

- `npm ci` failed because `package-lock.json` is out of sync with `package.json`.
- `npm install --package-lock=false --no-audit --no-fund` completed without modifying the lockfile.
- `npm test` passed: 1 file, 1 test.
- `./node_modules/.bin/tsc --noEmit` passed.
- `npm run build` passed with a large bundle warning.
- `npm run lint` failed: 232 total problems, 194 errors and 38 warnings.

## E2E Flows Tested

- Landing page load and auth navigation.
- Invalid login error handling.
- Teacher signup and dashboard load.
- Teacher class creation and join-code generation.
- Teacher assignment creation with a short-answer question.
- Student signup and dashboard load.
- Student joins class by join code.
- Student views assignment, answers the question, submits a link, and receives reward overlay.
- Teacher sees ungraded submission, reviews answer, saves score/feedback, and notifies student.
- Student sees submitted/graded assignment and teacher feedback.
- Teacher sends a direct message to the student.
- Student sees the teacher message.
- Student global search returns the created assignment.
- Authenticated route smoke pass across student and teacher dashboards.
- Mobile viewport smoke pass at 390x844.

## Findings

### 1. Clean installs are broken

Severity: High

Status after fixes: Fixed. `package-lock.json` was regenerated through the dependency/audit remediation path, and `npm ci --ignore-scripts --no-audit --no-fund` now passes.

`npm ci` fails on a fresh clone because the committed `package-lock.json` is stale relative to `package.json`. Missing lock entries include `@dnd-kit/core`, `@dnd-kit/sortable`, `@supabase/supabase-js`, `@testing-library/*`, `@tiptap/*`, `vitest`, and many transitive packages. This blocks CI or any developer using the standard npm clean-install path.

Repro:

```bash
cd /Users/harish.desai/pupil-guide-ai
npm ci
```

Expected: dependencies install from the lockfile.

Actual: npm exits with `EUSAGE` and reports the lockfile is not in sync.

### 2. Lint is failing across the repo

Severity: Medium

Status after fixes: Fixed as a blocking check. `npm run lint` now exits 0. The remaining `any`, hook-dependency, and Fast Refresh items are warnings rather than failing errors.

`npm run lint` fails with 232 total problems: 194 errors and 38 warnings. The dominant failures are `@typescript-eslint/no-explicit-any`, plus empty interface issues in UI components, `prefer-const`, useless escapes, `no-unused-expressions`, and forbidden `require()` imports in Tailwind config.

Repro:

```bash
npm run lint
```

Expected: lint exits cleanly.

Actual: lint exits 1.

### 3. Mobile bottom navigation overlaps at phone width

Severity: Medium

Status after fixes: Fixed. The mobile tab bar now scrolls horizontally inside the nav container instead of expanding the page width, and the post-fix mobile layout check measured no page-level horizontal overflow.

At a 390x844 mobile viewport, both teacher and student bottom tab bars squeeze 9-10 nav items into equal grid columns while each link has `min-w-[44px]`. On the measured 375px layout width, the teacher nav uses 10 links x 44px minimum, and the student nav uses 9 links x 44px minimum, so adjacent targets overlap/crowd. The last student item measured right edge 377px against a 375px client width.

Relevant code: `src/components/DashboardShell.tsx` mobile nav grid and `min-w-[44px]`.

Screenshots:

- `output/playwright/teacher-mobile.png`
- `output/playwright/student-mobile.png`

### 4. Notification popover copy is misleading after opening

Severity: Low

Status after fixes: Fixed. The zero-unread state now distinguishes between recent read notifications and a truly empty notification list.

When the student opens notifications with 1 unread graded-assignment notification, the popover immediately marks it read and changes the header to `You're all caught up`, while the notification is still listed below. Functionally the notification remains visible, but the header reads like there is nothing to review.

Relevant code: `src/components/NotificationBell.tsx` marks notifications read on open and derives the header from the now-zero unread count.

Repro:

1. Trigger a notification, for example teacher grades an assignment.
2. As the student, open the notification bell.
3. Observe header text and notification list.

Expected: header communicates either "1 notification" or a neutral read-state message.

Actual: header says `You're all caught up` while the just-opened notification is shown.

## Screenshots

- `output/playwright/landing-desktop.png`
- `output/playwright/teacher-dashboard.png`
- `output/playwright/teacher-mobile.png`
- `output/playwright/student-mobile.png`

## Post-Fix Verification

- `npm ci --ignore-scripts --no-audit --no-fund`: passed.
- `npm audit`: passed, `found 0 vulnerabilities`.
- `./node_modules/.bin/tsc --noEmit --pretty false`: passed.
- `npm test`: passed, 1 test.
- `npm run build`: passed with non-blocking warnings.
- `npm run lint`: passed with 0 errors and warnings remaining.
- Browser smoke after dependency/security changes: `/` and `/auth` loaded with 0 console errors.
- Post-fix screenshot: `output/playwright/post-fix-auth.png`.
