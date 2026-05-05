import { useState } from "react";
import { Navigate, useNavigate } from "react-router-dom";
import { z } from "zod";
import { GraduationCap, Users } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { toast } from "sonner";
import { cn } from "@/lib/utils";
import grapheionLogo from "@/assets/grapheion-logo.png";

type Role = "student" | "teacher";

const signUpSchema = z.object({
  fullName: z.string().trim().min(1, "Name is required").max(100),
  email: z.string().trim().email("Invalid email").max(255),
  password: z.string().min(8, "At least 8 characters").max(72),
});

const signInSchema = z.object({
  email: z.string().trim().email("Invalid email").max(255),
  password: z.string().min(1, "Password required").max(72),
});

export default function Auth() {
  const { user, role, loading } = useAuth();
  const navigate = useNavigate();

  const [mode, setMode] = useState<"signin" | "signup">("signin");
  const [submitting, setSubmitting] = useState(false);

  // sign up state
  const [selectedRole, setSelectedRole] = useState<Role>("student");
  const [fullName, setFullName] = useState("");
  const [signupEmail, setSignupEmail] = useState("");
  const [signupPassword, setSignupPassword] = useState("");

  // sign in state
  const [signinEmail, setSigninEmail] = useState("");
  const [signinPassword, setSigninPassword] = useState("");

  if (!loading && user && role) {
    return <Navigate to={role === "teacher" ? "/teacher" : "/student"} replace />;
  }

  const handleSignUp = async (e: React.FormEvent) => {
    e.preventDefault();
    const parsed = signUpSchema.safeParse({ fullName, email: signupEmail, password: signupPassword });
    if (!parsed.success) {
      toast.error(parsed.error.issues[0].message);
      return;
    }
    setSubmitting(true);
    const { error } = await supabase.auth.signUp({
      email: parsed.data.email,
      password: parsed.data.password,
      options: {
        emailRedirectTo: `${window.location.origin}/`,
        data: { full_name: parsed.data.fullName, role: selectedRole },
      },
    });
    setSubmitting(false);
    if (error) {
      toast.error(error.message);
      return;
    }
    toast.success("Account created! Redirecting...");
    navigate(selectedRole === "teacher" ? "/teacher" : "/student", { replace: true });
  };

  const handleSignIn = async (e: React.FormEvent) => {
    e.preventDefault();
    const parsed = signInSchema.safeParse({ email: signinEmail, password: signinPassword });
    if (!parsed.success) {
      toast.error(parsed.error.issues[0].message);
      return;
    }
    setSubmitting(true);
    const { error } = await supabase.auth.signInWithPassword({
      email: parsed.data.email,
      password: parsed.data.password,
    });
    setSubmitting(false);
    if (error) {
      toast.error(error.message);
      return;
    }
    toast.success("Welcome back!");
    // Auth listener will populate role; navigation happens via the redirect above.
  };

  return (
    <main className="min-h-screen flex items-center justify-center px-4 py-12 bg-gradient-coastal">
      <div className="w-full max-w-md">
        <div className="text-center mb-8">
          <img
            src={grapheionLogo}
            alt="Grapheion logo"
            width={420}
            height={236}
            className="mx-auto w-full max-w-xs h-auto object-contain"
            style={{ background: "transparent" }}
          />
          <p className="text-sm text-muted-foreground mt-3 italic">Knowledge Surpasses Mountains</p>
        </div>

        <Card className="border-border/60 shadow-sm">
          <CardHeader className="pb-4">
            <CardTitle className="text-lg">
              {mode === "signin" ? "Sign in" : "Create your account"}
            </CardTitle>
            <CardDescription>
              {mode === "signin" ? "Welcome back to Grapheion." : "Choose your role to get started."}
            </CardDescription>
          </CardHeader>
          <CardContent>
            <Tabs value={mode} onValueChange={(v) => setMode(v as "signin" | "signup")}>
              <TabsList className="grid grid-cols-2 w-full mb-6">
                <TabsTrigger value="signin">Sign in</TabsTrigger>
                <TabsTrigger value="signup">Sign up</TabsTrigger>
              </TabsList>

              <TabsContent value="signin">
                <form onSubmit={handleSignIn} className="space-y-4">
                  <div className="space-y-2">
                    <Label htmlFor="signin-email">Email</Label>
                    <Input id="signin-email" type="email" autoComplete="email"
                      value={signinEmail} onChange={(e) => setSigninEmail(e.target.value)} required />
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="signin-password">Password</Label>
                    <Input id="signin-password" type="password" autoComplete="current-password"
                      value={signinPassword} onChange={(e) => setSigninPassword(e.target.value)} required />
                  </div>
                  <Button type="submit" className="w-full" disabled={submitting}>
                    {submitting ? "Signing in..." : "Sign in"}
                  </Button>
                </form>
              </TabsContent>

              <TabsContent value="signup">
                <form onSubmit={handleSignUp} className="space-y-4">
                  <div className="space-y-2">
                    <Label>I am a</Label>
                    <div className="grid grid-cols-2 gap-3">
                      <RoleCard
                        active={selectedRole === "student"}
                        onClick={() => setSelectedRole("student")}
                        icon={<GraduationCap className="h-5 w-5" />}
                        label="Student"
                      />
                      <RoleCard
                        active={selectedRole === "teacher"}
                        onClick={() => setSelectedRole("teacher")}
                        icon={<Users className="h-5 w-5" />}
                        label="Teacher"
                      />
                    </div>
                  </div>

                  <div className="space-y-2">
                    <Label htmlFor="signup-name">Full name</Label>
                    <Input id="signup-name" value={fullName}
                      onChange={(e) => setFullName(e.target.value)} required />
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="signup-email">Email</Label>
                    <Input id="signup-email" type="email" autoComplete="email"
                      value={signupEmail} onChange={(e) => setSignupEmail(e.target.value)} required />
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="signup-password">Password</Label>
                    <Input id="signup-password" type="password" autoComplete="new-password"
                      value={signupPassword} onChange={(e) => setSignupPassword(e.target.value)} required />
                    <p className="text-xs text-muted-foreground">Minimum 8 characters.</p>
                  </div>
                  <Button type="submit" className="w-full" disabled={submitting}>
                    {submitting ? "Creating account..." : "Create account"}
                  </Button>
                </form>
              </TabsContent>
            </Tabs>
          </CardContent>
        </Card>
      </div>
    </main>
  );
}

function RoleCard({
  active, onClick, icon, label,
}: { active: boolean; onClick: () => void; icon: React.ReactNode; label: string }) {
  return (
    <button
      type="button"
      onClick={onClick}
      className={cn(
        "flex flex-col items-center justify-center gap-2 rounded-lg border p-4 text-sm transition-colors",
        active
          ? "border-primary bg-accent text-accent-foreground"
          : "border-border bg-background hover:bg-secondary"
      )}
    >
      {icon}
      <span className="font-medium">{label}</span>
    </button>
  );
}