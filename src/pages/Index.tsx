import { Navigate, Link, useNavigate } from "react-router-dom";
import { useEffect, useRef, useState } from "react";
import {
  Sparkles, BookOpen, BarChart3, ShieldCheck, Trophy, Bot,
  ClipboardCheck, MessagesSquare, ArrowRight, Play, GraduationCap,
  Users2, School, Mountain,
} from "lucide-react";
import { useAuth } from "@/hooks/useAuth";
import { Button } from "@/components/ui/button";
import grapheionMark from "@/assets/grapheion-mark.png";
import grapheionMarkHd from "@/assets/grapheion-mark-hd.png";
import AOS from "aos";
import "aos/dist/aos.css";

const FEATURES = [
  {
    icon: GraduationCap,
    badge: "For Students",
    title: "Learn, earn, and level up",
    body:
      "Turn assignments into adventures with Star and Crown coin rewards. A built-in AI Study Buddy explains tough concepts and quizzes you on demand.",
    accent: "from-amber-400/20 to-amber-500/0",
  },
  {
    icon: Users2,
    badge: "For Teachers",
    title: "A gradebook that works for you",
    body:
      "Plan, grade, and grow at a glance. Live progress tracking, automated reminders, and a unified gradebook keep every class on course.",
    accent: "from-sky-400/20 to-sky-500/0",
  },
  {
    icon: School,
    badge: "For Schools",
    title: "Safe by design, smart by default",
    body:
      "Teacher-supervised messaging keeps students secure while school-wide analytics surface trends across classes, units, and outcomes.",
    accent: "from-violet-400/20 to-violet-500/0",
  },
];

const STEPS = [
  { icon: BookOpen,        title: "Create your class", body: "Spin up a class in seconds and customize units, modules, and rewards." },
  { icon: MessagesSquare,  title: "Invite your students", body: "Share a join code — students hop in and instantly see what's due." },
  { icon: Sparkles,        title: "Start learning together", body: "Assign work, chat, celebrate streaks, and watch progress soar." },
];

const TESTIMONIALS = [
  {
    quote: "I actually want to do my homework now. The coins and streaks make it feel like a game and the Study Buddy explains things better than YouTube.",
    name: "Anonymous", role: "9th-grade student", initials: "A",
  },
  {
    quote: "Grapheion replaced four different tools for me. Grading, attendance, messaging — it's all in one beautiful place and the kids love it.",
    name: "Anonymous", role: "Math teacher", initials: "A",
  },
  {
    quote: "The supervised messaging and analytics give us the visibility we need without micromanaging teachers. Onboarding our staff took one afternoon.",
    name: "Anonymous", role: "School principal", initials: "A",
  },
];

const NAV = [
  { id: "features", label: "Features" },
  { id: "how", label: "How it works" },
  { id: "love", label: "Loved by" },
  { id: "contact", label: "Contact" },
];

export default function Index() {
  const { user, role, loading } = useAuth();
  const navigate = useNavigate();
  const [scrolled, setScrolled] = useState(false);
  const [scrollY, setScrollY] = useState(0);
  const [zooming, setZooming] = useState(false);
  const rafId = useRef<number | null>(null);
  const heroSectionRef = useRef<HTMLDivElement | null>(null);
  const sceneLayerRef = useRef<HTMLDivElement | null>(null);
  const headlineRef = useRef<HTMLHeadingElement | null>(null);
  const ctaRef = useRef<HTMLDivElement | null>(null);
  const vignetteRef = useRef<HTMLDivElement | null>(null);
  const gridRef = useRef<HTMLDivElement | null>(null);
  const mountainLayerRef = useRef<HTMLDivElement | null>(null);
  const glowRef = useRef<HTMLDivElement | null>(null);
  const overlayRef = useRef<HTMLDivElement | null>(null);

  useEffect(() => {
    document.documentElement.style.scrollBehavior = "smooth";

    const prefersReduced = window.matchMedia(
      "(prefers-reduced-motion: reduce)"
    ).matches;

    let ticking = false;
    let lastY = window.scrollY;
    let lastScrolledState = lastY > 8;
    setScrolled(lastScrolledState);

    const apply = () => {
      ticking = false;
      const y = lastY;

      const nextScrolled = y > 8;
      if (nextScrolled !== lastScrolledState) {
        lastScrolledState = nextScrolled;
        setScrolled(nextScrolled);
      }

      if (prefersReduced) return;

      // Sticky cinematic zoom progress (0 → 1 across the hero section)
      const heroEl = heroSectionRef.current;
      if (heroEl) {
        const vh = window.innerHeight || 1;
        const vw = window.innerWidth || 1;
        const localY = Math.max(y - heroEl.offsetTop, 0);
        const total = Math.max(heroEl.offsetHeight - vh, 1);
        const progress = Math.min(Math.max(localY / total, 0), 1);
        // Smooth ease-out for cinematic camera dolly
        const eased = 1 - Math.pow(1 - progress, 2.2);

        if (gridRef.current) {
          gridRef.current.style.transform = `translate3d(0, ${eased * 18}px, 0)`;
        }

        // Layer 1: camera moves into the complete mountain scene only.
        if (sceneLayerRef.current) {
          const isMobile = vw < 640;
          const scale = 1 + eased * (isMobile ? 0.72 : 1.05);
          const translateY = -eased * (isMobile ? 18 : 30);
          sceneLayerRef.current.style.transform = `translate3d(0, ${translateY}px, 0) scale(${scale})`;
        }

        // Vignette darkens for text legibility
        if (vignetteRef.current) {
          vignetteRef.current.style.opacity = String(Math.min(eased * 1.25, 0.9));
        }

        // Headline + CTA stay locked to the viewport and fully visible.
        if (headlineRef.current) {
          headlineRef.current.style.transform = "translate3d(0, 0, 0)";
        }
        if (ctaRef.current) {
          ctaRef.current.style.transform = "translate3d(0, 0, 0)";
        }
      }
    };

    const onScroll = () => {
      lastY = window.scrollY;
      if (!ticking) {
        ticking = true;
        window.requestAnimationFrame(apply);
      }
    };

    apply();
    window.addEventListener("scroll", onScroll, { passive: true });
    return () => {
      window.removeEventListener("scroll", onScroll);
      if (rafId.current) window.cancelAnimationFrame(rafId.current);
      document.documentElement.style.scrollBehavior = "";
    };
  }, []);

  const startZoom = (e: React.MouseEvent) => {
    e.preventDefault();
    if (zooming) return;
    const reduced =
      typeof window !== "undefined" &&
      window.matchMedia?.("(prefers-reduced-motion: reduce)").matches;
    if (reduced) {
      navigate("/auth");
      return;
    }
    setZooming(true);
    const duration = 1600;
    const start = performance.now();
    const step = (now: number) => {
      const t = Math.min(1, (now - start) / duration);
      // ease-in-cubic
      const eased = t * t * t;
      const mountain = mountainLayerRef.current;
      if (mountain) {
        mountain.style.transform = `translate3d(0, ${-eased * 6}vh, 0) scale(${1 + eased * 6})`;
      }
      const glow = glowRef.current;
      if (glow) {
        const size = 90 + eased * 80;
        glow.style.width = `${size}vmax`;
        glow.style.height = `${size}vmax`;
        glow.style.opacity = String(0.7 + eased * 0.3);
      }
      const overlay = overlayRef.current;
      if (overlay) {
        overlay.style.opacity = String(Math.max(0, 1 - eased * 1.25));
        overlay.style.transform = `translate3d(0, ${eased * 4}vh, 0)`;
      }
      if (t < 1) {
        rafId.current = window.requestAnimationFrame(step);
      } else {
        navigate("/auth");
      }
    };
    rafId.current = window.requestAnimationFrame(step);
  };

  useEffect(() => {
    AOS.init({
      duration: 1100,
      easing: "ease-out-cubic",
      once: true,
      mirror: false,
      offset: 80,
      anchorPlacement: "top-bottom",
      disable: false,
    });
    // Refresh after the first paint so AOS picks up dynamic content sizes.
    const t = window.setTimeout(() => AOS.refresh(), 200);
    return () => window.clearTimeout(t);
  }, []);

  if (!loading && user && role) {
    return <Navigate to={role === "teacher" ? "/teacher" : "/student"} replace />;
  }

  return (
    <div className="min-h-screen overflow-x-hidden bg-[#0d0f12] text-slate-100 antialiased selection:bg-sky-400/30">
      {/* === Top nav === */}
      <header
        className={[
          "fixed top-0 inset-x-0 z-50 transition-all duration-300",
          scrolled
            ? "bg-[#0d0f12]/80 backdrop-blur-md border-b border-white/5"
            : "bg-transparent",
        ].join(" ")}
      >
        <div className="max-w-7xl mx-auto px-5 sm:px-8 h-16 flex items-center justify-between">
          <a href="#top" className="flex items-center gap-2.5 group">
            <img src={grapheionMark} alt="" width={32} height={32} className="h-8 w-8 object-contain" />
            <span className="text-lg font-semibold tracking-tight">Grapheion</span>
          </a>
          <nav className="hidden md:flex items-center gap-8 text-sm text-slate-300">
            {NAV.map((n) => (
              <a key={n.id} href={`#${n.id}`} className="hover:text-white transition-colors">
                {n.label}
              </a>
            ))}
          </nav>
          <div className="flex items-center gap-2">
            <Button asChild variant="ghost" className="text-slate-200 hover:bg-white/5 hover:text-white">
              <Link to="/auth">Sign in</Link>
            </Button>
            <Button asChild className="bg-white text-[#0d0f12] hover:bg-slate-200">
              <Link to="/auth">Get started</Link>
            </Button>
          </div>
        </div>
      </header>

      {/* === Hero (click-triggered zoom) === */}
      <section id="hero-zoom" className="relative h-screen">
        <div id="top" className="relative h-screen w-full overflow-hidden bg-[#0d0f12]">
          <AnimatedBackdrop />

          {/* Mountain background layer — fills viewport, zooms toward camera */}
          <div
            ref={mountainLayerRef}
            className="absolute inset-0 flex items-center justify-center pointer-events-none"
            style={{
              transform: "translate3d(0, 0, 0) scale(1)",
              transformOrigin: "center center",
              willChange: "transform",
              backfaceVisibility: "hidden",
            }}
          >
            <div className="relative h-full w-full flex items-center justify-center">
              {/* Atmospheric glow that grows with the zoom so the frame never feels empty */}
              <div
                ref={glowRef}
                className="absolute left-1/2 top-1/2 -translate-x-1/2 -translate-y-1/2 -z-10 rounded-full blur-3xl"
                style={{
                  width: "90vmax",
                  height: "90vmax",
                  background:
                    "radial-gradient(circle, rgba(59,130,246,0.35) 0%, rgba(99,102,241,0.18) 35%, rgba(13,15,18,0) 70%)",
                  opacity: 0.7,
                  willChange: "width, height, opacity",
                }}
              />
              <img
                src={grapheionMarkHd}
                alt="Grapheion mountain logo"
                width={1920}
                height={1080}
                decoding="async"
                fetchPriority="high"
                className="w-[92vw] max-w-[1100px] h-auto object-contain drop-shadow-[0_18px_60px_rgba(96,165,250,0.55)]"
              />
            </div>
          </div>

          {/* Vignette + bottom fade so the dark void blends into the next section */}
          <div
            aria-hidden
            className="absolute inset-0 pointer-events-none"
            style={{
              background:
                "radial-gradient(ellipse at center, transparent 35%, rgba(13,15,18,0.55) 80%, rgba(13,15,18,0.95) 100%)",
            }}
          />
          <div
            aria-hidden
            className="absolute inset-x-0 bottom-0 h-40 pointer-events-none"
            style={{
              background:
                "linear-gradient(to bottom, rgba(13,15,18,0) 0%, rgba(13,15,18,1) 100%)",
            }}
          />

          {/* Overlay content layer — stays fixed/visible throughout */}
          <div
            ref={overlayRef}
            className="relative z-10 h-full flex flex-col items-center justify-center px-5 sm:px-8 text-center"
            style={{
              opacity: 1,
              transform: "translate3d(0, 0, 0)",
              pointerEvents: zooming ? "none" : undefined,
              willChange: "transform, opacity",
            }}
          >
            <span className="inline-flex items-center gap-2 rounded-full border border-white/10 bg-white/5 backdrop-blur-sm px-3 py-1 text-xs text-slate-300">
              <Sparkles className="h-3.5 w-3.5 text-amber-300" />
              New: AI Study Buddy is now in every class
            </span>

            <h1 className="mt-8 font-bold tracking-tight text-4xl sm:text-6xl lg:text-7xl leading-[1.05] drop-shadow-[0_4px_24px_rgba(0,0,0,0.6)]">
              <span className="bg-gradient-to-b from-white to-slate-400 bg-clip-text text-transparent">
                Knowledge Surpasses
              </span>
              <br />
              <span className="bg-gradient-to-r from-sky-300 via-indigo-300 to-violet-300 bg-clip-text text-transparent">
                Mountains
              </span>
            </h1>

            <p className="mt-6 max-w-2xl mx-auto text-base sm:text-lg text-slate-300 drop-shadow-[0_2px_12px_rgba(0,0,0,0.6)]">
              One beautiful place for students to learn, teachers to teach, and schools to grow.
            </p>

            <div className="mt-10 flex flex-col sm:flex-row items-center justify-center gap-3">
              <Button onClick={startZoom} size="lg" className="bg-white text-[#0d0f12] hover:bg-slate-200 h-12 px-7 text-base">
                Get Started <ArrowRight className="h-4 w-4" />
              </Button>
              <Button
                onClick={startZoom}
                size="lg"
                variant="outline"
                className="h-12 px-7 text-base border-white/15 bg-white/10 backdrop-blur-sm text-white hover:bg-white/20 hover:text-white"
              >
                <Play className="h-4 w-4" /> Watch Demo
              </Button>
            </div>
          </div>
        </div>
      </section>

      {/* === Features === */}
      <section id="features" className="relative py-24 sm:py-32 border-t border-white/5">
        <div className="max-w-7xl mx-auto px-5 sm:px-8">
          <div data-aos="fade-up" data-aos-anchor-placement="top-bottom">
            <SectionHeader
              eyebrow="What's inside"
              title="Built for everyone in the classroom"
              sub="A focused toolkit for students, teachers, and school leaders — designed to work together."
            />
          </div>

          <div className="mt-14 grid gap-5 md:grid-cols-3">
            {FEATURES.map((f, i) => {
              const aos = i === 0 ? "fade-right" : i === 2 ? "fade-left" : "fade-down";
              return (
              <div
                key={f.title}
                data-aos={aos}
                data-aos-duration="700"
                data-aos-delay={i * 250}
                data-aos-anchor-placement="top-bottom"
                className="group relative overflow-hidden rounded-2xl border border-white/10 bg-gradient-to-b from-white/[0.04] to-white/[0.01] p-7 transition-all duration-500 ease-out hover:-translate-y-1.5 hover:border-white/20 hover:shadow-[0_20px_60px_-20px_rgba(56,189,248,0.25)]"
              >
                <div
                  className={`absolute -inset-px rounded-2xl bg-gradient-to-br ${f.accent} opacity-0 group-hover:opacity-100 transition-opacity duration-500 -z-10`}
                />
                <div
                  data-aos="zoom-in"
                  data-aos-duration="600"
                  data-aos-delay="500"
                  data-aos-easing="ease-out-back"
                  data-aos-anchor-placement="top-bottom"
                  className="inline-flex h-12 w-12 items-center justify-center rounded-xl bg-white/5 ring-1 ring-white/10 text-white"
                >
                  <f.icon className="h-6 w-6" />
                </div>
                <p className="mt-6 text-xs font-medium uppercase tracking-widest text-slate-400">{f.badge}</p>
                <h3 className="mt-2 text-xl font-semibold tracking-tight">{f.title}</h3>
                <p className="mt-3 text-sm leading-relaxed text-slate-400">{f.body}</p>

                <div className="mt-8 flex flex-wrap gap-2">
                  {f.badge === "For Students" && (
                    <>
                      <Pill icon={Trophy} label="Coin rewards" />
                      <Pill icon={Bot} label="AI Study Buddy" />
                    </>
                  )}
                  {f.badge === "For Teachers" && (
                    <>
                      <Pill icon={ClipboardCheck} label="Gradebook" />
                      <Pill icon={BarChart3} label="Live progress" />
                    </>
                  )}
                  {f.badge === "For Schools" && (
                    <>
                      <Pill icon={ShieldCheck} label="Supervised chat" />
                      <Pill icon={BarChart3} label="Analytics" />
                    </>
                  )}
                </div>
              </div>
              );
            })}
          </div>
        </div>
      </section>

      {/* === How it works === */}
      <section id="how" className="relative py-24 sm:py-32 border-t border-white/5 bg-gradient-to-b from-transparent via-white/[0.02] to-transparent">
        <div className="max-w-6xl mx-auto px-5 sm:px-8">
          <div data-aos="fade-up" data-aos-anchor-placement="top-bottom">
            <SectionHeader
              eyebrow="How it works"
              title="Up and running in three steps"
              sub="No training session required. Most teachers launch their first class the day they sign up."
            />
          </div>

          <ol className="mt-16 relative grid gap-10 md:grid-cols-3">
            {/* connecting line on desktop */}
            <div
              aria-hidden
              data-aos="zoom-in-right"
              data-aos-duration="900"
              data-aos-delay="100"
              data-aos-anchor-placement="top-bottom"
              className="hidden md:block absolute top-8 left-[16%] right-[16%] h-px bg-gradient-to-r from-transparent via-white/15 to-transparent origin-left"
            />
            {STEPS.map((s, i) => (
              <li
                key={s.title}
                data-aos="fade-right"
                data-aos-duration="700"
                data-aos-delay={i * 250}
                data-aos-anchor-placement="top-bottom"
                className="relative text-center md:text-left"
              >
                <div
                  data-aos="zoom-in"
                  data-aos-duration="600"
                  data-aos-delay={i * 250 + 250}
                  data-aos-easing="ease-out-back"
                  data-aos-anchor-placement="top-bottom"
                  className="mx-auto md:mx-0 inline-flex h-16 w-16 items-center justify-center rounded-2xl bg-[#0d0f12] ring-1 ring-white/15 shadow-[0_0_0_6px_rgba(255,255,255,0.02)] relative"
                >
                  <s.icon className="h-7 w-7 text-sky-300" />
                  <span className="absolute -top-2 -right-2 h-7 w-7 rounded-full bg-gradient-to-br from-sky-400 to-indigo-500 text-[#0d0f12] text-sm font-bold flex items-center justify-center ring-4 ring-[#0d0f12]">
                    {i + 1}
                  </span>
                </div>
                <h3 className="mt-6 text-lg font-semibold tracking-tight">{s.title}</h3>
                <p className="mt-2 text-sm text-slate-400 max-w-sm md:max-w-none">{s.body}</p>
              </li>
            ))}
          </ol>
        </div>
      </section>

      {/* === Testimonials === */}
      <section id="love" className="relative py-24 sm:py-32 border-t border-white/5">
        <div className="max-w-7xl mx-auto px-5 sm:px-8">
          <div data-aos="fade-up" data-aos-anchor-placement="top-bottom">
            <SectionHeader
              eyebrow="Loved by classrooms"
              title="Words from students, teachers, and leaders"
            />
          </div>

          <div className="mt-14 grid gap-5 md:grid-cols-3">
            {TESTIMONIALS.map((t) => (
              <figure
                key={t.role}
                data-aos="fade-up"
                data-aos-duration="600"
                data-aos-delay={TESTIMONIALS.indexOf(t) * 250}
                data-aos-anchor-placement="top-bottom"
                className="rounded-2xl border border-white/10 bg-white/[0.03] p-7 flex flex-col transition-all duration-500 ease-out hover:-translate-y-1 hover:border-white/20 hover:bg-white/[0.05]"
              >
                <div className="text-sky-300/60 text-5xl leading-none font-serif select-none">"</div>
                <blockquote className="mt-2 text-[15px] leading-relaxed text-slate-200 flex-1">
                  {t.quote}
                </blockquote>
                <figcaption className="mt-6 flex items-center gap-3">
                  <span
                    data-aos="zoom-in"
                    data-aos-duration="600"
                    data-aos-delay="250"
                    data-aos-easing="ease-out-back"
                    data-aos-anchor-placement="top-bottom"
                    className="inline-flex h-10 w-10 items-center justify-center rounded-full bg-gradient-to-br from-sky-500 to-indigo-600 text-white text-sm font-semibold ring-2 ring-white/10"
                  >
                    {t.initials}
                  </span>
                  <div className="leading-tight">
                    <p className="text-sm font-medium text-white">{t.name}</p>
                    <p className="text-xs text-slate-400">{t.role}</p>
                  </div>
                </figcaption>
              </figure>
            ))}
          </div>
        </div>
      </section>

      {/* === Final CTA === */}
      <section className="relative py-24 sm:py-32 border-t border-white/5">
        <div className="relative max-w-5xl mx-auto px-5 sm:px-8">
          <div
            data-aos="fade"
            data-aos-duration="900"
            data-aos-anchor-placement="top-bottom"
            className="relative overflow-hidden rounded-3xl border border-white/10 bg-gradient-to-br from-slate-800/60 via-[#1a1f29] to-[#0d0f12] p-10 sm:p-16 text-center"
          >
            <div className="absolute -top-24 -right-24 h-72 w-72 rounded-full bg-sky-500/20 blur-3xl" />
            <div className="absolute -bottom-32 -left-24 h-72 w-72 rounded-full bg-indigo-500/20 blur-3xl" />

            <div
              data-aos="zoom-in"
              data-aos-duration="600"
              data-aos-delay="500"
              data-aos-easing="ease-out-back"
              data-aos-anchor-placement="top-bottom"
              className="relative mx-auto inline-block"
            >
              <Mountain className="h-10 w-10 text-sky-300" />
            </div>
            <h2 className="relative mt-6 text-3xl sm:text-5xl font-bold tracking-tight">
              Start climbing today.
            </h2>
            <p className="relative mt-4 text-slate-400 max-w-xl mx-auto">
              Free for teachers and students. No credit card. Set up your first class in under five minutes.
            </p>
            <div className="relative mt-10 flex justify-center">
              <Button
                asChild
                size="lg"
                className="bg-white text-[#0d0f12] hover:bg-slate-200 h-12 px-8 text-base"
              >
                <Link to="/auth">
                  Get Started Free <ArrowRight className="h-4 w-4" />
                </Link>
              </Button>
            </div>
          </div>
        </div>
      </section>

      {/* === Footer === */}
      <footer id="contact" className="border-t border-white/5">
        <div className="max-w-7xl mx-auto px-5 sm:px-8 py-12 flex flex-col md:flex-row items-center md:items-start justify-between gap-8">
          <div className="text-center md:text-left">
            <a href="#top" className="inline-flex items-center gap-2.5">
              <img src={grapheionMark} alt="" width={32} height={32} className="h-8 w-8 object-contain" />
              <span className="text-lg font-semibold tracking-tight">Grapheion</span>
            </a>
            <p className="mt-2 text-sm text-slate-400 italic">Knowledge Surpasses Mountains</p>
          </div>
          <nav className="flex flex-wrap items-center justify-center gap-x-8 gap-y-2 text-sm text-slate-400">
            <a href="#top" className="hover:text-white transition-colors">Home</a>
            <a href="#features" className="hover:text-white transition-colors">Features</a>
            <a href="#how" className="hover:text-white transition-colors">About</a>
            <a href="mailto:hello@grapheion.app" className="hover:text-white transition-colors">Contact</a>
          </nav>
        </div>
        <div className="border-t border-white/5">
          <p className="max-w-7xl mx-auto px-5 sm:px-8 py-5 text-xs text-slate-500 text-center md:text-left">
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
    <div className="max-w-2xl mx-auto text-center">
      <p className="text-xs font-medium uppercase tracking-[0.2em] text-sky-300/80">{eyebrow}</p>
      <h2 className="mt-3 text-3xl sm:text-4xl font-bold tracking-tight">
        <span className="bg-gradient-to-b from-white to-slate-400 bg-clip-text text-transparent">{title}</span>
      </h2>
      {sub && <p className="mt-4 text-slate-400">{sub}</p>}
    </div>
  );
}

function Pill({ icon: Icon, label }: { icon: typeof Trophy; label: string }) {
  return (
    <span className="inline-flex items-center gap-1.5 rounded-full bg-white/5 ring-1 ring-white/10 px-2.5 py-1 text-xs text-slate-300">
      <Icon className="h-3.5 w-3.5" />
      {label}
    </span>
  );
}

function AnimatedBackdrop() {
  return (
    <div aria-hidden className="absolute inset-0 -z-10 overflow-hidden">
      {/* Base radial wash */}
      <div className="absolute inset-0 bg-[radial-gradient(ellipse_at_top,rgba(56,89,140,0.35),transparent_60%)]" />
      {/* Subtle grid */}
      <div
        className="absolute inset-0 opacity-[0.07]"
        style={{
          backgroundImage:
            "linear-gradient(to right, #ffffff 1px, transparent 1px), linear-gradient(to bottom, #ffffff 1px, transparent 1px)",
          backgroundSize: "56px 56px",
          maskImage: "radial-gradient(ellipse at center, black 40%, transparent 75%)",
          WebkitMaskImage: "radial-gradient(ellipse at center, black 40%, transparent 75%)",
        }}
      />
      {/* Slow-floating gradient blobs */}
      <div className="absolute -top-40 -left-32 h-[28rem] w-[28rem] rounded-full bg-sky-600/30 blur-3xl animate-blob-slow" />
      <div className="absolute top-20 -right-32 h-[26rem] w-[26rem] rounded-full bg-indigo-600/25 blur-3xl animate-blob-slower" />
      <div className="absolute bottom-0 left-1/3 h-[22rem] w-[22rem] rounded-full bg-slate-500/20 blur-3xl animate-blob-slow" />
    </div>
  );
}
