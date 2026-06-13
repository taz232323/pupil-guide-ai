import { describe, it, expect, vi, afterEach } from "vitest";
import { render, cleanup } from "@testing-library/react";
import { MemoryRouter } from "react-router-dom";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { TooltipProvider } from "@/components/ui/tooltip";

/* ------------------------------------------------------------------ *
 * Smoke test: every routed page component must mount without throwing.
 * Heavy cross-cutting deps are stubbed so we exercise render, not data.
 * ------------------------------------------------------------------ */

vi.mock("@/components/DashboardShell", () => ({
  DashboardShell: ({ children }: { children: React.ReactNode }) => <div>{children}</div>,
}));

// Stable references so pages with useEffect([user]) don't re-run forever.
vi.mock("@/hooks/useAuth", () => {
  const user = { id: "u1", email: "t@example.com" };
  const signOut = () => {};
  return {
    useAuth: () => ({ user, role: "teacher", loading: false, signOut }),
    AuthProvider: ({ children }: { children: React.ReactNode }) => <>{children}</>,
  };
});

// useTheme touches localStorage at import + requires a provider; stub it.
vi.mock("@/hooks/useTheme", () => ({
  useTheme: () => ({ theme: "light", setTheme: () => {}, toggleTheme: () => {} }),
  ThemeProvider: ({ children }: { children: React.ReactNode }) => <>{children}</>,
}));

// Universal chainable supabase stub: any query/rpc resolves to empty data.
vi.mock("@/integrations/supabase/client", () => {
  const thenable = (result: any): any =>
    new Proxy(
      {},
      {
        get(_t, prop) {
          if (prop === "then") return (res: any, rej: any) => Promise.resolve(result).then(res, rej);
          if (prop === "maybeSingle" || prop === "single") return () => thenable({ data: null, error: null });
          return () => thenable(result);
        },
      },
    );
  const channel = () => {
    const ch: any = { on: () => ch, subscribe: () => ch, unsubscribe: () => {} };
    return ch;
  };
  return {
    supabase: {
      from: () => thenable({ data: [], error: null }),
      rpc: () => Promise.resolve({ data: [], error: null }),
      channel,
      removeChannel: () => {},
      auth: {
        getUser: async () => ({ data: { user: null } }),
        getSession: async () => ({ data: { session: null } }),
        onAuthStateChange: () => ({ data: { subscription: { unsubscribe() {} } } }),
        signOut: async () => ({ error: null }),
      },
      functions: { invoke: async () => ({ data: null, error: null }) },
    },
  };
});

// Pages behind every route in App.tsx
import Index from "@/pages/Index";
import NotFound from "@/pages/NotFound";
import Auth from "@/pages/Auth";
import StudentDashboard from "@/pages/StudentDashboard";
import TeacherDashboard from "@/pages/TeacherDashboard";
import Profile from "@/pages/Profile";
import StudentClassesPage from "@/pages/StudentClassesPage";
import StudentAssignmentsPage from "@/pages/StudentAssignmentsPage";
import TeacherClassesPage from "@/pages/TeacherClassesPage";
import TeacherAssignmentsPage from "@/pages/TeacherAssignmentsPage";
import StudentAssignmentDetail from "@/pages/StudentAssignmentDetail";
import StudentGrades from "@/pages/StudentGrades";
import StudentCalendar from "@/pages/StudentCalendar";
import StudentLeaderboard from "@/pages/StudentLeaderboard";
import StudentDailyPractice from "@/pages/StudentDailyPractice";
import StudentRewards from "@/pages/StudentRewards";
import LessonLibrary from "@/pages/LessonLibrary";
import TeacherCalendar from "@/pages/TeacherCalendar";
import TeacherAssignmentDetail from "@/pages/TeacherAssignmentDetail";
import TeacherProgressPage from "@/pages/TeacherProgressPage";
import TeacherGradebook from "@/pages/TeacherGradebook";
import MessagesPage from "@/pages/MessagesPage";
import ShopPage from "@/pages/ShopPage";
import TeacherShopPage from "@/pages/TeacherShopPage";
import TeacherLeaderboard from "@/pages/TeacherLeaderboard";
import ClassDetail from "@/pages/ClassDetail";

const PAGES: [string, React.ComponentType][] = [
  ["Index", Index],
  ["NotFound", NotFound],
  ["Auth", Auth],
  ["StudentDashboard", StudentDashboard],
  ["TeacherDashboard", TeacherDashboard],
  ["Profile", Profile],
  ["StudentClassesPage", StudentClassesPage],
  ["StudentAssignmentsPage", StudentAssignmentsPage],
  ["TeacherClassesPage", TeacherClassesPage],
  ["TeacherAssignmentsPage", TeacherAssignmentsPage],
  ["StudentAssignmentDetail", StudentAssignmentDetail],
  ["StudentGrades", StudentGrades],
  ["StudentCalendar", StudentCalendar],
  ["StudentLeaderboard", StudentLeaderboard],
  ["StudentDailyPractice", StudentDailyPractice],
  ["StudentRewards", StudentRewards],
  ["LessonLibrary", LessonLibrary],
  ["TeacherCalendar", TeacherCalendar],
  ["TeacherAssignmentDetail", TeacherAssignmentDetail],
  ["TeacherProgressPage", TeacherProgressPage],
  ["TeacherGradebook", TeacherGradebook],
  ["MessagesPage", MessagesPage],
  ["ShopPage", ShopPage],
  ["TeacherShopPage", TeacherShopPage],
  ["TeacherLeaderboard", TeacherLeaderboard],
  ["ClassDetail", ClassDetail],
];

afterEach(() => cleanup());

describe("route pages render without crashing", () => {
  it.each(PAGES)("%s mounts", (_name, Page) => {
    const client = new QueryClient({ defaultOptions: { queries: { retry: false } } });
    expect(() =>
      render(
        <QueryClientProvider client={client}>
          <TooltipProvider>
            <MemoryRouter>
              <Page />
            </MemoryRouter>
          </TooltipProvider>
        </QueryClientProvider>,
      ),
    ).not.toThrow();
  });
});
