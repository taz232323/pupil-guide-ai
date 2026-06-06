import { useState } from "react";
import { Link, Navigate, useNavigate } from "react-router-dom";
import { z } from "zod";
import { GraduationCap, Users, ArrowLeft, Mail, Lock, User as UserIcon, UserRound } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";
import { Button } from "@/components/ui/button";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
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
    <main className="relative min-h-screen overflow-hidden bg-[#0d0f12] text-slate-100 antialiased">
      {/* Background — matches landing page */}
      <div aria-hidden className="absolute inset-0 -z-10">
        <div className="absolute inset-0 bg-[radial-gradient(ellipse_at_top,rgba(56,89,140,0.35),transparent_60%)]" />
        <div
          className="absolute inset-0 opacity-[0.06]"
          style={{
            backgroundImage:
              "linear-gradient(to right, #ffffff 1px, transparent 1px), linear-gradient(to bottom, #ffffff 1px, transparent 1px)",
            backgroundSize: "56px 56px",
            maskImage: "radial-gradient(ellipse at center, black 40%, transparent 75%)",
            WebkitMaskImage: "radial-gradient(ellipse at center, black 40%, transparent 75%)",
          }}
        />
        <div className="absolute -top-40 -left-32 h-[28rem] w-[28rem] rounded-full bg-sky-600/25 blur-3xl animate-blob-slow" />
        <div className="absolute bottom-0 -right-32 h-[26rem] w-[26rem] rounded-full bg-indigo-600/20 blur-3xl animate-blob-slower" />
      </div>

      {/* Back to home */}
      <Link
        to="/"
        className="absolute top-5 left-5 inline-flex items-center gap-1.5 text-sm text-slate-400 hover:text-white transition-colors"
      >
        <ArrowLeft className="h-4 w-4" /> Home
      </Link>

      <div className="min-h-screen flex items-center justify-center px-4 py-16">
        <div className="w-full max-w-md animate-page-enter">
          {/* Logo + tagline */}
          <div className="text-center mb-8">
            <img
              src={grapheionMark}
              alt="Grapheion"
              width={88}
              height={88}
              className="mx-auto h-16 w-16 sm:h-20 sm:w-20 object-contain drop-shadow-[0_8px_30px_rgba(96,165,250,0.35)]"
            />
            <h1 className="mt-5 text-2xl sm:text-3xl font-bold tracking-tight">
              <span className="bg-gradient-to-b from-white to-slate-400 bg-clip-text text-transparent">
                Welcome to Grapheion
              </span>
            </h1>
            <p className="mt-2 text-sm text-slate-400 italic">Knowledge Surpasses Mountains</p>
          </div>

          {/* Card */}
          <div className="rounded-2xl border border-white/10 bg-white/[0.04] backdrop-blur-xl shadow-[0_30px_80px_-20px_rgba(0,0,0,0.6)] p-6 sm:p-8">
            <Tabs value={mode} onValueChange={(v) => setMode(v as "signin" | "signup")}>
              <TabsList className="grid grid-cols-2 w-full mb-6 bg-white/5 border border-white/10">
                <TabsTrigger
                  value="signin"
                  className="data-[state=active]:bg-white data-[state=active]:text-[#0d0f12] text-slate-300"
                >
                  Sign in
                </TabsTrigger>
                <TabsTrigger
                  value="signup"
                  className="data-[state=active]:bg-white data-[state=active]:text-[#0d0f12] text-slate-300"
                >
                  Sign up
                </TabsTrigger>
              </TabsList>

              <TabsContent value="signin">
                <form onSubmit={handleSignIn} className="space-y-4">
                  <div className="space-y-2">
                    <p className="text-xs uppercase tracking-widest text-slate-400">Access as</p>
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
                  <Field
                    id="signin-email"
                    label="Email"
                    type="email"
                    icon={Mail}
                    autoComplete="email"
                    value={signinEmail}
                    onChange={setSigninEmail}
                  />
                  <Field
                    id="signin-password"
                    label="Password"
                    type="password"
                    icon={Lock}
                    autoComplete="current-password"
                    value={signinPassword}
                    onChange={setSigninPassword}
                  />
                  <Button
                    type="submit"
                    className="w-full bg-white text-[#0d0f12] hover:bg-slate-200 h-11"
                    disabled={submitting}
                  >
                    {submitting ? "Signing in..." : "Sign in"}
                  </Button>
                </form>
              </TabsContent>

              <TabsContent value="signup">
                <form onSubmit={handleSignUp} className="space-y-4">
                  <div className="space-y-2">
                    <p className="text-xs uppercase tracking-widest text-slate-400">I am a</p>
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

                  <Field
                    id="signup-name"
                    label="Full name"
                    type="text"
                    icon={UserIcon}
                    value={fullName}
                    onChange={setFullName}
                  />
                  <Field
                    id="signup-email"
                    label="Email"
                    type="email"
                    icon={Mail}
                    autoComplete="email"
                    value={signupEmail}
                    onChange={setSignupEmail}
                  />
                  <Field
                    id="signup-password"
                    label="Password"
                    type="password"
                    icon={Lock}
                    autoComplete="new-password"
                    value={signupPassword}
                    onChange={setSignupPassword}
                    hint="Minimum 8 characters."
                  />

                  <Button
                    type="submit"
                    className="w-full bg-white text-[#0d0f12] hover:bg-slate-200 h-11"
                    disabled={submitting}
                  >
                    {submitting ? "Creating account..." : "Create account"}
                  </Button>
                </form>
              </TabsContent>
            </Tabs>
          </div>

          <p className="mt-6 text-center text-xs text-slate-500">
            By continuing you agree to our terms of service and privacy policy.
          </p>
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
      <label htmlFor={id} className="text-xs font-medium text-slate-300">
        {label}
      </label>
      <div className="relative">
        <Icon className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-slate-500" />
        <input
          id={id}
          type={type}
          autoComplete={autoComplete}
          required
          value={value}
          onChange={(e) => onChange(e.target.value)}
          className="w-full h-11 rounded-lg bg-white/5 border border-white/10 pl-10 pr-3 text-sm text-white placeholder:text-slate-500 outline-none transition-colors focus:border-sky-400/60 focus:bg-white/[0.07] focus:ring-2 focus:ring-sky-400/20"
        />
      </div>
      {hint && <p className="text-[11px] text-slate-500">{hint}</p>}
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
        "flex flex-col items-center justify-center gap-2 rounded-lg border p-4 text-sm transition-all",
        active
          ? "border-sky-400/50 bg-sky-400/10 text-white shadow-[0_0_0_3px_rgba(56,189,248,0.1)]"
          : "border-white/10 bg-white/[0.03] text-slate-300 hover:bg-white/[0.06] hover:text-white"
      )}
    >
      {icon}
      <span className="font-medium">{label}</span>
    </button>
  );
}
