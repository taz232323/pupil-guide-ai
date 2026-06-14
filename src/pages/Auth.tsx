import { useState } from "react";
import { Link, Navigate, useNavigate } from "react-router-dom";
import { z } from "zod";
import { GraduationCap, Users, ArrowLeft, ArrowRight, Mail, Lock, User as UserIcon, UserRound, ShieldCheck } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";
import { Button } from "@/components/ui/button";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { MountainSketch } from "@/components/MountainSketch";
import { toast } from "sonner";
import { cn } from "@/lib/utils";
import grapheionMark from "@/assets/grapheion-mark.png";

type Role = "student" | "teacher";
type SignInAccess = Role | "parent";

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

  const [selectedRole, setSelectedRole] = useState<Role>("student");
  const [signInAccess, setSignInAccess] = useState<SignInAccess>("student");
  const [fullName, setFullName] = useState("");
  const [signupEmail, setSignupEmail] = useState("");
  const [signupPassword, setSignupPassword] = useState("");

  const [signinEmail, setSigninEmail] = useState("");
  const [signinPassword, setSigninPassword] = useState("");

  if (!loading && user && role) {
    if (sessionStorage.getItem("access_mode") === "parent" && role === "student") {
      return <Navigate to="/parent-dashboard" replace />;
    }
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
    sessionStorage.removeItem("access_mode");
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
    if (signInAccess === "parent") {
      sessionStorage.setItem("access_mode", "parent");
    } else {
      sessionStorage.removeItem("access_mode");
    }
    const { data, error } = await supabase.auth.signInWithPassword({
      email: parsed.data.email,
      password: parsed.data.password,
    });
    if (error) {
      sessionStorage.removeItem("access_mode");
      setSubmitting(false);
      toast.error(error.message);
      return;
    }

    const { data: roleRow } = data.user
      ? await supabase.from("user_roles").select("role").eq("user_id", data.user.id).maybeSingle()
      : { data: null };

    if (signInAccess === "parent") {
      if (roleRow?.role !== "student") {
        sessionStorage.removeItem("access_mode");
        await supabase.auth.signOut();
        setSubmitting(false);
        toast.error("Parent access requires a student's login credentials.");
        return;
      }
      setSubmitting(false);
      toast.success("Parent view opened.");
      navigate("/parent-dashboard", { replace: true });
      return;
    }

    setSubmitting(false);
    toast.success("Welcome back!");
    navigate(roleRow?.role === "teacher" ? "/teacher" : "/student", { replace: true });
  };

  return (
    <main className="relative min-h-screen overflow-hidden text-foreground antialiased">
      <div className="absolute top-0 inset-x-0 z-20 flex h-16 items-center justify-between px-5 sm:px-8">
        <Link to="/" className="flex items-center gap-2.5">
          <img src={grapheionMark} alt="" width={32} height={32} className="h-8 w-8 object-contain" />
          <span className="font-display text-xl font-semibold tracking-tight">Grapheion</span>
        </Link>
        <Link
          to="/"
          className="inline-flex items-center gap-1.5 text-sm text-muted-foreground transition-colors hover:text-foreground"
        >
          <ArrowLeft className="h-4 w-4" /> Home
        </Link>
      </div>

      <div className="grid min-h-screen lg:grid-cols-2">
        <div className="relative hidden flex-col justify-center bg-gradient-coastal px-12 lg:flex xl:px-20">
          <MountainSketch variant="peak" className="absolute bottom-0 left-0 w-[80%] max-w-lg text-muted-foreground/40" />
          <div className="relative z-10 max-w-md animate-fade-up">
            <h2 className="font-display text-4xl font-semibold leading-tight tracking-tight xl:text-5xl">
              Learn with clarity.<br />
              <span className="italic text-primary">Grow with purpose.</span>
            </h2>
            <p className="mt-5 text-muted-foreground">
              Knowledge surpasses mountains. Sign in to continue your learning journey.
            </p>
          </div>
        </div>

        <div className="flex items-center justify-center px-4 py-20 sm:py-16">
          <div className="w-full max-w-md animate-page-enter">
            <div className="mb-6 text-center lg:hidden">
              <img
                src={grapheionMark}
                alt="Grapheion"
                className="mx-auto h-14 w-14 animate-breathing object-contain"
              />
            </div>

            <div className="rounded-2xl border border-border bg-card p-6 shadow-elevated sm:p-8">
              <Tabs value={mode} onValueChange={(v) => setMode(v as "signin" | "signup")}>
                <TabsList className="mb-6 grid w-full grid-cols-2">
                  <TabsTrigger value="signin">Sign in</TabsTrigger>
                  <TabsTrigger value="signup">Create account</TabsTrigger>
                </TabsList>

                <div className="mb-6">
                  <h1 className="font-display text-3xl font-semibold tracking-tight">
                    {mode === "signin" ? "Welcome back" : "Create your account"}
                  </h1>
                  <p className="mt-1.5 text-sm text-muted-foreground">
                    {mode === "signin"
                      ? "Log in to continue your learning journey."
                      : "Join Grapheion and start making progress."}
                  </p>
                </div>

                <TabsContent value="signin">
                  <form onSubmit={handleSignIn} className="space-y-4">
                    <div className="space-y-2">
                      <p className="text-xs font-medium uppercase tracking-widest text-muted-foreground">Access as</p>
                      <div className="grid grid-cols-3 gap-2">
                        <RoleCard
                          active={signInAccess === "student"}
                          onClick={() => setSignInAccess("student")}
                          icon={<GraduationCap className="h-5 w-5" />}
                          label="Student"
                        />
                        <RoleCard
                          active={signInAccess === "teacher"}
                          onClick={() => setSignInAccess("teacher")}
                          icon={<Users className="h-5 w-5" />}
                          label="Teacher"
                        />
                        <RoleCard
                          active={signInAccess === "parent"}
                          onClick={() => setSignInAccess("parent")}
                          icon={<UserRound className="h-5 w-5" />}
                          label="Parent Access"
                        />
                      </div>
                    </div>
                    <Field id="signin-email" label="Email" type="email" icon={Mail} autoComplete="email" value={signinEmail} onChange={setSigninEmail} />
                    <Field id="signin-password" label="Password" type="password" icon={Lock} autoComplete="current-password" value={signinPassword} onChange={setSigninPassword} />
                    <Button type="submit" className="h-11 w-full" disabled={submitting}>
                      {submitting ? "Signing in..." : <>Continue <ArrowRight className="h-4 w-4" /></>}
                    </Button>
                  </form>
                </TabsContent>

                <TabsContent value="signup">
                  <form onSubmit={handleSignUp} className="space-y-4">
                    <div className="space-y-2">
                      <p className="text-xs font-medium uppercase tracking-widest text-muted-foreground">I am a</p>
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

                    <Field id="signup-name" label="Full name" type="text" icon={UserIcon} value={fullName} onChange={setFullName} />
                    <Field id="signup-email" label="Email" type="email" icon={Mail} autoComplete="email" value={signupEmail} onChange={setSignupEmail} />
                    <Field id="signup-password" label="Password" type="password" icon={Lock} autoComplete="new-password" value={signupPassword} onChange={setSignupPassword} hint="Minimum 8 characters." />

                    <Button type="submit" className="h-11 w-full" disabled={submitting}>
                      {submitting ? "Creating account..." : <>Create account <ArrowRight className="h-4 w-4" /></>}
                    </Button>
                  </form>
                </TabsContent>
              </Tabs>

              <p className="mt-6 flex items-center justify-center gap-1.5 text-xs text-muted-foreground">
                <ShieldCheck className="h-3.5 w-3.5 text-success" /> Secure, private, and trusted by schools.
              </p>
            </div>
          </div>
        </div>
      </div>
    </main>
  );
}

function Field({
  id, label, type, icon: Icon, value, onChange, autoComplete, hint,
}: {
  id: string;
  label: string;
  type: string;
  icon: typeof Mail;
  value: string;
  onChange: (v: string) => void;
  autoComplete?: string;
  hint?: string;
}) {
  return (
    <div className="space-y-1.5">
      <label htmlFor={id} className="text-xs font-medium text-foreground">
        {label}
      </label>
      <div className="relative">
        <Icon className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
        <input
          id={id}
          type={type}
          autoComplete={autoComplete}
          required
          value={value}
          onChange={(e) => onChange(e.target.value)}
          className="h-11 w-full rounded-[8px] border border-input bg-background pl-10 pr-3 text-sm text-foreground outline-none transition-[border-color,box-shadow] duration-200 placeholder:text-muted-foreground focus:border-primary focus:shadow-[0_0_0_3px_hsl(221_83%_53%/0.2)]"
        />
      </div>
      {hint && <p className="text-[11px] text-muted-foreground">{hint}</p>}
    </div>
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
        "flex flex-col items-center justify-center gap-2 rounded-xl border p-3 text-xs transition-spring sm:p-4 sm:text-sm",
        active
          ? "border-primary/50 bg-primary-soft text-primary shadow-[0_0_0_3px_hsl(221_83%_53%/0.12)]"
          : "border-border bg-card text-muted-foreground hover:bg-secondary hover:text-foreground"
      )}
    >
      {icon}
      <span className="font-medium">{label}</span>
    </button>
  );
}
