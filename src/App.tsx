import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { BrowserRouter, Route, Routes } from "react-router-dom";
import { Toaster as Sonner } from "@/components/ui/sonner";
import { Toaster } from "@/components/ui/toaster";
import { TooltipProvider } from "@/components/ui/tooltip";
import { AuthProvider } from "@/hooks/useAuth";
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
import TeacherProgressPage from "./pages/TeacherProgressPage.tsx";
import MessagesPage from "./pages/MessagesPage.tsx";
import ShopPage from "./pages/ShopPage.tsx";

const queryClient = new QueryClient();

const App = () => (
  <QueryClientProvider client={queryClient}>
    <TooltipProvider>
      <Toaster />
      <Sonner />
      <BrowserRouter>
        <AuthProvider>
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
            <Route path="/student/assignments" element={<ProtectedRoute requiredRole="student"><StudentAssignmentsPage /></ProtectedRoute>} />
            <Route path="/shop" element={<ProtectedRoute requiredRole="student"><ShopPage /></ProtectedRoute>} />
            <Route
              path="/profile"
              element={
                <ProtectedRoute requiredRole="student">
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
            <Route path="/teacher/assignments" element={<ProtectedRoute requiredRole="teacher"><TeacherAssignmentsPage /></ProtectedRoute>} />
            <Route path="/teacher/progress" element={<ProtectedRoute requiredRole="teacher"><TeacherProgressPage /></ProtectedRoute>} />
            <Route path="/messages" element={<MessagesPage />} />
            {/* ADD ALL CUSTOM ROUTES ABOVE THE CATCH-ALL "*" ROUTE */}
            <Route path="*" element={<NotFound />} />
          </Routes>
        </AuthProvider>
      </BrowserRouter>
    </TooltipProvider>
  </QueryClientProvider>
);

export default App;
