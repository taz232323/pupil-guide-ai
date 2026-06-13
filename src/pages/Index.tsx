import { Navigate, Link, useNavigate } from "react-router-dom";
import { useEffect, useRef, useState, type MouseEvent } from "react";
import {
  Sparkles, BookOpen, MessagesSquare, ArrowRight, Play, Star,
  FileText, TrendingUp, BarChart3, Bell, Crown, Coins, Check,
} from "lucide-react";
import { useAuth } from "@/hooks/useAuth";
import { Button } from "@/components/ui/button";
import { Reveal } from "@/components/Reveal";
import { MountainSketch } from "@/components/MountainSketch";
import grapheionMark from "@/assets/grapheion-mark.png";

const FEATURES = [
  {
    icon: FileText,
    tint: "bg-primary-soft text-primary",
    title: "Stay organized",
    body: "Keep all your classes, assignments, and deadlines in one place.",
    link: "Explore classes",
  },
  {
    icon: TrendingUp,
    tint: "bg-success-soft text-success",
    title: "Make progress",
    body: "Track your learning, celebrate wins, and keep moving forward.",
    link: "See your progress",
  },
  {
    icon: BarChart3,
    tint: "bg-warning-soft text-warning",
    title: "Achieve more",
    body: "Focused tools and feedback that help you reach your goals.",
    link: "How it works",
  },
];

const STEPS = [
  { icon: BookOpen, title: "Create your class", body: "Spin up a class in seconds and customize units, modules, and rewards." },
  { icon: MessagesSquare, title: "Invite your students", body: "Share a join code — students hop in and instantly see what's due." },
  { icon: Sparkles, title: "Start learning together", body: "Assign work, chat, celebrate streaks, and watch progress soar." },
];

const TESTIMONIALS = [
  { quote: "I actually want to do my homework now. The coins and streaks make it feel like a game and the Study Buddy explains things better than YouTube.", role: "9th-grade student", initials: "A" },
  { quote: "Grapheion replaced four different tools for me. Grading, attendance, messaging — it's all in one beautiful place and the kids love it.", role: "Math teacher", initials: "M" },
  { quote: "The supervised messaging and analytics give us the visibility we need without micromanaging teachers. Onboarding took one afternoon.", role: "School principal", initials: "P" },
];

const NAV = [
  { id: "features", label: "Classes" },
  { id: "how", label: "How it works" },
  { id: "love", label: "Loved by" },
  { id: "contact", label: "Contact" },
];

const AUTH_ZOOM_DURATION_MS = 1200;

export default function Index() {
  const { user, role, loading } = useAuth();
  const navigate = useNavigate();
  const [scrolled, setScrolled] = useState(false);
  const [zooming, setZooming] = useState(false);
  const zoomTimeoutRef = useRef<number | null>(null);

  useEffect(() => {
    const onScroll = () => setScrolled(window.scrollY > 8);
    onScroll();
    window.addEventListener("scroll", onScroll, { passive: true });
    return () => window.removeEventListener("scroll", onScroll);
  }, []);

  useEffect(() => {
    return () => {
      if (zoomTimeoutRef.current) window.clearTimeout(zoomTimeoutRef.current);
    };
  }, []);

  const startAuthZoom = (event: MouseEvent<HTMLAnchorElement>) => {
    if (
      event.defaultPrevented ||
      event.metaKey ||
      event.ctrlKey ||
      event.shiftKey ||
      event.altKey ||
      event.button !== 0
    ) {
      return;
    }

    event.preventDefault();
    if (zooming) return;

    const prefersReducedMotion = window.matchMedia?.("(prefers-reduced-motion: reduce)").matches;
    if (prefersReducedMotion) {
      navigate("/auth");
      return;
    }

    setZooming(true);
    zoomTimeoutRef.current = window.setTimeout(() => {
      navigate("/auth");
    }, AUTH_ZOOM_DURATION_MS);
  };

  if (!loading && user && role) {
    return <Navigate to={role === "teacher" ? "/teacher" : "/student"} replace />;
  }

  return (
    <div className="min-h-screen overflow-x-hidden text-foreground antialiased">
      {zooming && (
        <div
          aria-hidden="true"
          className="fixed inset-0 z-[100] flex items-center justify-center overflow-hidden bg-background"
        >
          <div className="absolute inset-0 bg-[radial-gradient(circle_at_center,hsl(var(--primary)/0.22),transparent_48%),linear-gradient(180deg,hsl(var(--background)/0.2),hsl(var(--background)))] animate-grapheion-zoom-wash" />
          <img
            src={grapheionMark}
            alt=""
            className="relative h-auto w-[88vmin] max-w-none object-contain opacity-45 grayscale contrast-150 brightness-75 mix-blend-multiply animate-grapheion-mark-zoom dark:invert dark:mix-blend-screen"
          />
        </div>
      )}

      {/* === Top nav === */}
      <header
        className={[
          "fixed top-0 inset-x-0 z-50 transition-all duration-300",
          scrolled ? "bg-background/80 backdrop-blur-md border-b border-border" : "bg-transparent",
        ].join(" ")}
      >
        <div className="max-w-7xl mx-auto px-5 sm:px-8 h-16 flex items-center justify-between">
          <a href="#top" className="flex items-center gap-2.5 group">
            <img src={grapheionMark} alt="" width={32} height={32} className="h-8 w-8 object-contain transition-transform duration-300 group-hover:scale-110" />
            <span className="font-display text-xl font-semibold tracking-tight">Grapheion</span>
          </a>
          <nav className="hidden md:flex items-center gap-8 text-sm font-medium text-muted-foreground">
            {NAV.slice(0, 4).map((n) => (
              <a key={n.id} href={`#${n.id}`} className="nav-underline hover:text-foreground transition-colors">
                {n.label}
              </a>
            ))}
          </nav>
          <div className="flex items-center gap-2">
            <Button asChild variant="ghost">
              <Link to="/auth">Log in</Link>
            </Button>
            <Button asChild>
              <Link to="/auth" onClick={startAuthZoom}>Get started</Link>
            </Button>
          </div>
        </div>
      </header>

      {/* === Hero === */}
      <section id="top" className="relative overflow-hidden pt-28 sm:pt-36 pb-20 sm:pb-28">
        <div aria-hidden="true" className="pointer-events-none absolute inset-0 z-0 overflow-hidden">
          <img
            src={grapheionMark}
            alt=""
            className="absolute left-[45%] top-[42%] w-[44rem] max-w-none -translate-x-1/2 -translate-y-1/2 object-contain opacity-[0.16] grayscale contrast-150 brightness-75 mix-blend-multiply dark:invert dark:mix-blend-screen dark:opacity-[0.11] sm:w-[58rem] lg:left-[43%] lg:top-[45%] lg:w-[78rem]"
          />
        </div>
        {/* Ambient pencil-mountain backdrop — sits behind the hero, peaks rising above the preview card */}
        <MountainSketch
          variant="range"
          className="pointer-events-none absolute right-[-3%] top-16 -z-10 hidden w-[66%] max-w-3xl text-muted-foreground/45 lg:block"
        />
        <div className="max-w-7xl mx-auto px-5 sm:px-8 grid lg:grid-cols-2 gap-12 lg:gap-8 items-center">
          {/* Left: copy */}
          <div className="relative z-10">
            <span className="inline-flex items-center gap-2 rounded-full border border-border bg-card px-3 py-1 text-xs font-medium text-muted-foreground shadow-card animate-fade-up">
              <Sparkles className="h-3.5 w-3.5 text-gold" />
              New: AI Study Buddy is now in every class
            </span>

            <div className="relative isolate mt-6">
              <h1 className="relative font-display font-semibold tracking-tight text-5xl sm:text-6xl lg:text-[4.2rem] leading-[1.02]">
                {["Learn", "with", "clarity."].map((w, i) => (
                  <span key={i} className="animate-fade-up inline-block" style={{ animationDelay: `${i * 70}ms` }}>
                    {w}&nbsp;
                  </span>
                ))}
                <br />
                <span className="text-primary italic animate-fade-up inline-block" style={{ animationDelay: "240ms" }}>
                  Grow with purpose.
                </span>
              </h1>
            </div>

            <p className="mt-6 max-w-md text-base sm:text-lg leading-relaxed text-muted-foreground animate-fade-up" style={{ animationDelay: "320ms" }}>
              Grapheion helps teachers run better classes and helps students stay motivated and make progress.
            </p>

            <div className="mt-8 flex flex-col sm:flex-row gap-3 animate-fade-up" style={{ animationDelay: "380ms" }}>
              <Button asChild size="lg" className="cta-shimmer h-12 px-7 text-base">
                <Link to="/auth" onClick={startAuthZoom}>Get started for free</Link>
              </Button>
              <Button asChild size="lg" variant="outline" className="h-12 px-7 text-base">
                <a href="#how"><Play className="h-4 w-4" /> See how it works</a>
              </Button>
            </div>

            <div className="mt-8 flex items-center gap-4 animate-fade-up" style={{ animationDelay: "440ms" }}>
              <div className="flex -space-x-2">
                {["from-primary to-primary-deep", "from-success to-teal", "from-gold to-warning", "from-teal to-primary"].map((g, i) => (
                  <span key={i} className={`h-9 w-9 rounded-full bg-gradient-to-br ${g} ring-2 ring-background`} />
                ))}
              </div>
              <div>
                <div className="flex text-gold">
                  {Array.from({ length: 5 }).map((_, i) => <Star key={i} className="h-4 w-4 fill-current" />)}
                </div>
                <p className="mt-0.5 text-xs text-muted-foreground">Trusted by teachers and students in thousands of schools.</p>
              </div>
            </div>
          </div>

          {/* Right: product preview (floats in front of the mountain backdrop) */}
          <div className="relative z-10">
            <Reveal flip delay={120}>
              <HeroPreview />
            </Reveal>
          </div>
        </div>
      </section>

      {/* === Features === */}
      <section id="features" className="relative py-16 sm:py-20 border-t border-border">
        <div className="max-w-7xl mx-auto px-5 sm:px-8 grid gap-5 md:grid-cols-3">
          {FEATURES.map((f, i) => (
            <Reveal key={f.title} delay={i * 80}>
              <div className="hover-lift group h-full rounded-2xl border border-border bg-card p-7 shadow-card">
                <span className={`inline-flex h-12 w-12 items-center justify-center rounded-2xl ${f.tint} transition-transform duration-300 group-hover:scale-110`}>
                  <f.icon className="h-6 w-6" />
                </span>
                <h3 className="mt-5 font-display text-xl font-semibold tracking-tight">{f.title}</h3>
                <p className="mt-2 text-sm leading-relaxed text-muted-foreground">{f.body}</p>
                <span className="mt-4 inline-flex items-center gap-1.5 text-sm font-medium text-primary">
                  {f.link} <ArrowRight className="h-3.5 w-3.5 transition-transform group-hover:translate-x-1" />
                </span>
              </div>
            </Reveal>
          ))}
        </div>
      </section>

      {/* === How it works === */}
      <section id="how" className="relative py-20 sm:py-24 border-t border-border">
        <div className="max-w-6xl mx-auto px-5 sm:px-8">
          <SectionHeader eyebrow="How it works" title="Up and running in three steps" sub="No training session required. Most teachers launch their first class the day they sign up." />
          <ol className="mt-14 grid gap-10 md:grid-cols-3">
            {STEPS.map((s, i) => (
              <Reveal as="li" key={s.title} delay={i * 90} className="relative text-center md:text-left">
                <div className="mx-auto md:mx-0 relative inline-flex h-16 w-16 items-center justify-center rounded-2xl bg-primary-soft text-primary">
                  <s.icon className="h-7 w-7" />
                  <span className="absolute -top-2 -right-2 h-7 w-7 rounded-full bg-primary text-primary-foreground text-sm font-bold flex items-center justify-center font-tabular ring-4 ring-background">
                    {i + 1}
                  </span>
                </div>
                <h3 className="mt-6 font-display text-lg font-semibold tracking-tight">{s.title}</h3>
                <p className="mt-2 text-sm text-muted-foreground max-w-sm md:max-w-none">{s.body}</p>
              </Reveal>
            ))}
          </ol>
        </div>
      </section>

      {/* === Testimonials === */}
      <section id="love" className="relative py-20 sm:py-24 border-t border-border">
        <div className="max-w-7xl mx-auto px-5 sm:px-8">
          <SectionHeader eyebrow="Loved by classrooms" title="Words from students, teachers, and leaders" />
          <div className="mt-14 grid gap-5 md:grid-cols-3">
            {TESTIMONIALS.map((t, i) => (
              <Reveal key={t.role} delay={i * 80}>
                <figure className="hover-lift h-full rounded-2xl border border-border bg-card p-7 flex flex-col shadow-card">
                  <div className="font-display text-5xl leading-none text-primary/30 select-none">&ldquo;</div>
                  <blockquote className="mt-1 text-[15px] leading-relaxed text-foreground/90 flex-1">{t.quote}</blockquote>
                  <figcaption className="mt-6 flex items-center gap-3">
                    <span className="inline-flex h-10 w-10 items-center justify-center rounded-full bg-gradient-to-br from-primary to-teal text-primary-foreground text-sm font-semibold">
                      {t.initials}
                    </span>
                    <p className="text-sm text-muted-foreground">{t.role}</p>
                  </figcaption>
                </figure>
              </Reveal>
            ))}
          </div>
        </div>
      </section>

      {/* === Final CTA band === */}
      <section className="relative py-16 sm:py-20">
        <div className="max-w-6xl mx-auto px-5 sm:px-8">
          <Reveal>
            <div className="relative overflow-hidden rounded-3xl border border-primary/15 bg-gradient-hero px-8 py-12 sm:px-14 sm:py-16">
              <MountainSketch variant="path" className="pointer-events-none absolute bottom-0 right-0 w-[55%] max-w-md text-primary/40" />
              <div className="relative max-w-lg">
                <h2 className="font-display text-3xl sm:text-4xl font-semibold tracking-tight text-foreground">Ready to elevate your learning?</h2>
                <p className="mt-3 text-muted-foreground">Join Grapheion today and see the difference.</p>
                <Button asChild size="lg" className="cta-shimmer mt-8 h-12 px-7 text-base">
                  <Link to="/auth" onClick={startAuthZoom}>Get started for free <ArrowRight className="h-4 w-4" /></Link>
                </Button>
              </div>
            </div>
          </Reveal>
        </div>
      </section>

      {/* === Footer === */}
      <footer id="contact" className="border-t border-border">
        <div className="max-w-7xl mx-auto px-5 sm:px-8 py-12 flex flex-col md:flex-row items-center md:items-start justify-between gap-8">
          <div className="text-center md:text-left">
            <a href="#top" className="inline-flex items-center gap-2.5">
              <img src={grapheionMark} alt="" width={32} height={32} className="h-8 w-8 object-contain" />
              <span className="font-display text-xl font-semibold tracking-tight">Grapheion</span>
            </a>
            <p className="mt-2 text-sm text-muted-foreground italic">Knowledge Surpasses Mountains</p>
          </div>
          <nav className="flex flex-wrap items-center justify-center gap-x-8 gap-y-2 text-sm text-muted-foreground">
            <a href="#top" className="hover:text-foreground transition-colors">Home</a>
            <a href="#features" className="hover:text-foreground transition-colors">Features</a>
            <a href="#how" className="hover:text-foreground transition-colors">About</a>
            <a href="mailto:hello@grapheion.app" className="hover:text-foreground transition-colors">Contact</a>
          </nav>
        </div>
        <div className="border-t border-border">
          <p className="max-w-7xl mx-auto px-5 sm:px-8 py-5 text-xs text-muted-foreground text-center md:text-left">
            © {new Date().getFullYear()} Grapheion. All rights reserved.
          </p>
        </div>
      </footer>
    </div>
  );
}

/* === Helpers === */

function SectionHeader({ eyebrow, title, sub }: { eyebrow: string; title: string; sub?: string }) {
  return (
    <Reveal className="max-w-2xl mx-auto text-center">
      <p className="text-xs font-semibold uppercase tracking-[0.2em] text-primary">{eyebrow}</p>
      <h2 className="mt-3 font-display text-3xl sm:text-4xl font-semibold tracking-tight">{title}</h2>
      {sub && <p className="mt-4 text-muted-foreground">{sub}</p>}
    </Reveal>
  );
}

/** Stylized static dashboard preview shown in the hero (decorative). */
function HeroPreview() {
  const classes = [
    { name: "Algebra 1", teacher: "Mr. Rivera", pct: 75, tint: "bg-primary-soft text-primary" },
    { name: "English 10", teacher: "Ms. Carter", pct: 60, tint: "bg-success-soft text-success" },
    { name: "World History", teacher: "Mr. Lee", pct: 68, tint: "bg-warning-soft text-warning" },
  ];
  return (
    <div className="relative rounded-2xl border border-border bg-card p-4 shadow-elevated">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2">
          <img src={grapheionMark} alt="" className="h-6 w-6 object-contain" />
        </div>
        <div className="flex items-center gap-3 text-muted-foreground">
          <Bell className="h-4 w-4" />
          <span className="h-7 w-7 rounded-full bg-gradient-to-br from-primary to-teal" />
        </div>
      </div>

      <div className="mt-3 flex items-start justify-between">
        <div>
          <p className="font-display text-lg font-semibold">Welcome back, Alex 👋</p>
          <p className="text-xs text-muted-foreground">You've got this.</p>
        </div>
      </div>

      <div className="mt-3 grid grid-cols-3 gap-3">
        <div className="col-span-2 rounded-xl border border-border bg-background/60 p-3">
          <p className="text-[11px] font-medium text-muted-foreground">Today's focus</p>
          <p className="mt-1 text-sm font-medium">Solve 10 math problems</p>
          <div className="mt-2 h-1.5 w-full rounded-full bg-muted">
            <div className="h-full w-3/5 rounded-full bg-primary" />
          </div>
          <span className="mt-2 inline-block rounded-md bg-gold-soft px-1.5 py-0.5 text-[10px] font-semibold text-gold">+50 XP</span>
        </div>
        <div className="rounded-xl border border-border bg-background/60 p-3 flex flex-col items-center justify-center">
          <p className="text-[11px] font-medium text-muted-foreground self-start">Progress</p>
          <div className="relative mt-1 h-14 w-14">
            <svg viewBox="0 0 36 36" className="h-14 w-14 -rotate-90">
              <circle cx="18" cy="18" r="15.5" fill="none" stroke="hsl(var(--muted))" strokeWidth="4" />
              <circle cx="18" cy="18" r="15.5" fill="none" stroke="hsl(var(--primary))" strokeWidth="4" strokeLinecap="round" strokeDasharray="97.4" strokeDashoffset="27" />
            </svg>
            <span className="absolute inset-0 flex items-center justify-center font-tabular text-xs font-bold">72%</span>
          </div>
        </div>
      </div>

      <div className="mt-3 grid grid-cols-3 gap-2">
        {classes.map((c) => (
          <div key={c.name} className="rounded-xl border border-border bg-background/60 p-2.5">
            <span className={`inline-flex h-7 w-7 items-center justify-center rounded-lg ${c.tint}`}>
              <BookOpen className="h-3.5 w-3.5" />
            </span>
            <p className="mt-1.5 text-[11px] font-medium leading-tight">{c.name}</p>
            <div className="mt-1.5 h-1 w-full rounded-full bg-muted">
              <div className="h-full rounded-full bg-primary" style={{ width: `${c.pct}%` }} />
            </div>
          </div>
        ))}
      </div>

      <div className="mt-3 flex items-center justify-between rounded-xl border border-border bg-background/60 px-3 py-2">
        <div className="flex items-center gap-2 text-xs">
          <Check className="h-3.5 w-3.5 text-success" />
          <span className="text-muted-foreground">Essay Assignment</span>
        </div>
        <span className="text-[11px] font-medium text-success">Submitted</span>
      </div>

      {/* floating coin/crown chips */}
      <div className="absolute -right-3 -top-3 flex gap-1.5">
        <span className="inline-flex items-center gap-1 rounded-full border border-border bg-card px-2 py-1 text-[11px] font-semibold text-gold shadow-card font-tabular">
          <Coins className="h-3 w-3" /> 1,250
        </span>
        <span className="inline-flex items-center gap-1 rounded-full border border-border bg-card px-2 py-1 text-[11px] font-semibold text-plum shadow-card font-tabular">
          <Crown className="h-3 w-3" /> 320
        </span>
      </div>
    </div>
  );
}
