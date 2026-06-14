import { useLocation, Link } from "react-router-dom";
import { useEffect } from "react";
import { ArrowLeft } from "lucide-react";
import { Button } from "@/components/ui/button";
import { MountainSketch } from "@/components/MountainSketch";
import grapheionMark from "@/assets/grapheion-mark.png";

const NAV = [
  { to: "/", label: "Classes" },
  { to: "/", label: "Assignments" },
  { to: "/", label: "Progress" },
  { to: "/", label: "Resources" },
];

const NotFound = () => {
  const location = useLocation();

  useEffect(() => {
    console.error("404 Error: User attempted to access non-existent route:", location.pathname);
  }, [location.pathname]);

  return (
    <div className="relative flex min-h-screen flex-col text-foreground antialiased">
      {/* Top nav */}
      <header className="flex items-center justify-between px-5 sm:px-8 h-16">
        <Link to="/" className="flex items-center gap-2.5">
          <img src={grapheionMark} alt="" width={32} height={32} className="h-8 w-8 object-contain" />
          <span className="font-display text-xl font-semibold tracking-tight">Grapheion</span>
        </Link>
        <nav className="hidden md:flex items-center gap-8 text-sm font-medium text-muted-foreground">
          {NAV.map((n, i) => (
            <Link key={i} to={n.to} className="nav-underline hover:text-foreground transition-colors">
              {n.label}
            </Link>
          ))}
        </nav>
        <div className="flex items-center gap-2">
          <Button asChild variant="ghost"><Link to="/auth">Log in</Link></Button>
          <Button asChild><Link to="/auth">Sign up</Link></Button>
        </div>
      </header>

      {/* Body */}
      <main className="relative flex flex-1 flex-col items-center justify-center px-5 pb-16 text-center">
        <div className="animate-fade-up">
          <p className="font-display text-7xl sm:text-8xl font-semibold tracking-tight text-primary font-tabular">404</p>
          <h1 className="mt-2 font-display text-2xl sm:text-3xl font-semibold tracking-tight">Page not found</h1>
          <p className="mx-auto mt-3 max-w-md text-muted-foreground">
            We can't seem to find the page you're looking for. It might have moved or doesn't exist.
          </p>
          <div className="mt-7 flex justify-center">
            <Button asChild size="lg" className="cta-shimmer h-12 px-7 text-base">
              <Link to="/"><ArrowLeft className="h-4 w-4" /> Back home</Link>
            </Button>
          </div>
        </div>

        {/* Signpost / trail illustration */}
        <MountainSketch
          variant="path"
          className="pointer-events-none mt-10 w-full max-w-2xl text-muted-foreground/40 animate-fade-up"
        />

        <p className="mt-8 text-sm text-muted-foreground animate-fade-up">
          Need help?{" "}
          <a href="mailto:hello@grapheion.app" className="font-medium text-primary hover:underline">
            Visit our help center
          </a>
        </p>
      </main>
    </div>
  );
};

export default NotFound;
