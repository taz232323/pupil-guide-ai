import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { BrowserRouter, Route, Routes } from "react-router-dom";
import { Toaster as Sonner } from "@/components/ui/sonner";
import { Toaster } from "@/components/ui/toaster";
import { TooltipProvider } from "@/components/ui/tooltip";
import { AuthProvider } from "@/hooks/useAuth";
import { ThemeProvider } from "@/hooks/useTheme";
import { ProtectedRoute } from "@/components/ProtectedRoute";
import Index from "./pages/Index.tsx";
import NotFound from "./pages/NotFound.tsx";
import Auth from "./pages/Auth.tsx";
import StudentDashboard from "./pages/StudentDashboard.tsx";
import TeacherDashboard from "./pages/TeacherDashboard.tsx";
import Profile from "./pages/Profile.tsx";
import StudentClassesPage from "./pages/StudentClassesPage.tsx";
import StudentAssignmentsPage from "./pages/StudentAssignmentsPage.tsx";
import TeacherClassesPage from "./pages/TeacherClassesPage.tsx";
import TeacherAssignmentsPage from "./pages/TeacherAssignmentsPage.tsx";
import StudentAssignmentDetail from "./pages/StudentAssignmentDetail.tsx";
import StudentGrades from "./pages/StudentGrades.tsx";
import StudentCalendar from "./pages/StudentCalendar.tsx";
import StudentLeaderboard from "./pages/StudentLeaderboard.tsx";
import TeacherCalendar from "./pages/TeacherCalendar.tsx";
import TeacherAssignmentDetail from "./pages/TeacherAssignmentDetail.tsx";
import TeacherProgressPage from "./pages/TeacherProgressPage.tsx";
import TeacherGradebook from "./pages/TeacherGradebook.tsx";
import MessagesPage from "./pages/MessagesPage.tsx";
import ShopPage from "./pages/ShopPage.tsx";
import TeacherShopPage from "./pages/TeacherShopPage.tsx";
import ClassDetail from "./pages/ClassDetail.tsx";
import { reloadSchemaCache } from "@/lib/supabaseRest";

const queryClient = new QueryClient();

void reloadSchemaCache();

const App = () => (
  <QueryClientProvider client={queryClient}>
    <TooltipProvider>
      <Toaster />
      <Sonner />
      <BrowserRouter>
        <AuthProvider>
          <ThemeProvider>
            <Routes>
            <Route path="/" element={<Index />} />
            <Route path="/auth" element={<Auth />} />
            <Route
              path="/student"
              element={
                <ProtectedRoute requiredRole="student">
                  <StudentDashboard />
                </ProtectedRoute>
              }
            />
            <Route path="/student/classes" element={<ProtectedRoute requiredRole="student"><StudentClassesPage /></ProtectedRoute>} />
            <Route path="/student/classes/:id" element={<ProtectedRoute requiredRole="student"><ClassDetail /></ProtectedRoute>} />
            <Route path="/student/assignments" element={<ProtectedRoute requiredRole="student"><StudentAssignmentsPage /></ProtectedRoute>} />
            <Route path="/student/assignments/:id" element={<ProtectedRoute requiredRole="student"><StudentAssignmentDetail /></ProtectedRoute>} />
            <Route path="/student/grades" element={<ProtectedRoute requiredRole="student"><StudentGrades /></ProtectedRoute>} />
            <Route path="/student/calendar" element={<ProtectedRoute requiredRole="student"><StudentCalendar /></ProtectedRoute>} />
            <Route path="/student/leaderboard" element={<ProtectedRoute requiredRole="student"><StudentLeaderboard /></ProtectedRoute>} />
            <Route path="/shop" element={<ProtectedRoute requiredRole="student"><ShopPage /></ProtectedRoute>} />
            <Route
              path="/profile"
              element={
                <ProtectedRoute>
                  <Profile />
                </ProtectedRoute>
              }
            />
            <Route
              path="/teacher"
              element={
                <ProtectedRoute requiredRole="teacher">
                  <TeacherDashboard />
                </ProtectedRoute>
              }
            />
            <Route path="/teacher/classes" element={<ProtectedRoute requiredRole="teacher"><TeacherClassesPage /></ProtectedRoute>} />
            <Route path="/teacher/classes/:id" element={<ProtectedRoute requiredRole="teacher"><ClassDetail /></ProtectedRoute>} />
            <Route path="/teacher/assignments" element={<ProtectedRoute requiredRole="teacher"><TeacherAssignmentsPage /></ProtectedRoute>} />
            <Route path="/teacher/assignments/:id" element={<ProtectedRoute requiredRole="teacher"><TeacherAssignmentDetail /></ProtectedRoute>} />
            <Route path="/teacher/progress" element={<ProtectedRoute requiredRole="teacher"><TeacherProgressPage /></ProtectedRoute>} />
            <Route path="/teacher/gradebook" element={<ProtectedRoute requiredRole="teacher"><TeacherGradebook /></ProtectedRoute>} />
            <Route path="/teacher/calendar" element={<ProtectedRoute requiredRole="teacher"><TeacherCalendar /></ProtectedRoute>} />
            <Route path="/teacher/shop" element={<ProtectedRoute requiredRole="teacher"><TeacherShopPage /></ProtectedRoute>} />
            <Route path="/messages" element={<ProtectedRoute><MessagesPage /></ProtectedRoute>} />
            {/* ADD ALL CUSTOM ROUTES ABOVE THE CATCH-ALL "*" ROUTE */}
            <Route path="*" element={<NotFound />} />
            </Routes>
          </ThemeProvider>
        </AuthProvider>
      </BrowserRouter>
    </TooltipProvider>
  </QueryClientProvider>
);

export default App;
