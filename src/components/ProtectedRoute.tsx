import { Navigate } from "react-router-dom";
import { useAuth } from "@/hooks/useAuth";

type Role = "student" | "teacher";

export const ProtectedRoute = ({
  children,
  requiredRole,
}: {
  children: React.ReactNode;
  requiredRole: Role;
}) => {
  const { user, role, loading } = useAuth();

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center text-sm text-muted-foreground">
        Loading...
      </div>
    );
  }

  if (!user) return <Navigate to="/auth" replace />;
  if (role && role !== requiredRole) {
    return <Navigate to={role === "teacher" ? "/teacher" : "/student"} replace />;
  }
  return <>{children}</>;
};