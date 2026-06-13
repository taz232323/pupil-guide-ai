import { useState } from "react";
import {
  Library, ExternalLink, Search, BookOpen, FlaskConical, Sigma, Sparkles, Loader2,
} from "lucide-react";
import { DashboardShell } from "@/components/DashboardShell";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import {
  Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription,
} from "@/components/ui/dialog";
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from "@/components/ui/select";
import { Reveal } from "@/components/Reveal";
import { MountainSketch } from "@/components/MountainSketch";
import { cn } from "@/lib/utils";
import {
  MATH_IM, MATH_ATTRIBUTION, SCIENCE_PHET, phetEmbedUrl, SCIENCE_ATTRIBUTION,
  READING_CLASSICS, gutenbergReadUrl, READING_ATTRIBUTION, type PhetSim,
  GRADE_BANDS, inGradeBand,
} from "@/data/oerLibrary";

const TILE = [
  "bg-primary-soft text-primary",
  "bg-success-soft text-success",
  "bg-teal-soft text-teal",
  "bg-warning-soft text-warning",
];

type SearchBook = { id: number; title: string; author: string };

export default function LessonLibrary() {
  const [sim, setSim] = useState<PhetSim | null>(null);
  const [grade, setGrade] = useState("all");

  const mathItems = MATH_IM.filter((m) => inGradeBand(m, grade));
  const scienceItems = SCIENCE_PHET.filter((s) => inGradeBand(s, grade));

  // Reading: live Gutendex search with graceful fallback to the curated shelf
  const [q, setQ] = useState("");
  const [results, setResults] = useState<SearchBook[] | null>(null);
  const [searching, setSearching] = useState(false);
  const [searchError, setSearchError] = useState(false);

  const runSearch = async (e?: React.FormEvent) => {
    e?.preventDefault();
    const query = q.trim();
    if (!query) { setResults(null); setSearchError(false); return; }
    setSearching(true);
    setSearchError(false);
    try {
      const res = await fetch(
        `https://gutendex.com/books?search=${encodeURIComponent(query)}&mime_type=text%2Fhtml`,
      );
      if (!res.ok) throw new Error("bad status");
      const data = await res.json();
      const mapped: SearchBook[] = (data.results ?? []).slice(0, 12).map((r: any) => ({
        id: r.id,
        title: r.title,
        author: (r.authors?.[0]?.name as string) || "Unknown",
      }));
      setResults(mapped);
    } catch {
      setSearchError(true);
      setResults([]);
    } finally {
      setSearching(false);
    }
  };

  return (
    <DashboardShell>
      <div className="space-y-6">
        {/* Header */}
        <div className="relative overflow-hidden">
          <MountainSketch variant="range" className="pointer-events-none absolute -top-4 right-0 hidden w-64 text-muted-foreground/30 sm:block" />
          <div className="flex items-center gap-3">
            <span className="inline-flex h-11 w-11 items-center justify-center rounded-2xl bg-primary-soft text-primary">
              <Library className="h-6 w-6" />
            </span>
            <div>
              <h1 className="font-display text-3xl font-semibold tracking-tight sm:text-4xl">Lesson Library</h1>
              <p className="mt-1 max-w-xl text-sm text-muted-foreground sm:text-base">
                Free, open lessons curated from trusted sources — explore by subject.
              </p>
            </div>
          </div>
        </div>

        <Tabs defaultValue="math">
          <TabsList className="grid w-full max-w-md grid-cols-3">
            <TabsTrigger value="math"><Sigma className="mr-1.5 h-4 w-4" /> Math</TabsTrigger>
            <TabsTrigger value="science"><FlaskConical className="mr-1.5 h-4 w-4" /> Science</TabsTrigger>
            <TabsTrigger value="reading"><BookOpen className="mr-1.5 h-4 w-4" /> Reading</TabsTrigger>
          </TabsList>

          {/* ---------------- MATH (Illustrative Mathematics) ---------------- */}
          <TabsContent value="math" className="mt-5 space-y-4">
            <GradeFilter grade={grade} onChange={setGrade} />
            {mathItems.length === 0 ? (
              <EmptyGrade />
            ) : (
            <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
              {mathItems.map((m, i) => (
                <Reveal key={m.url} delay={i * 60}>
                  <a href={m.url} target="_blank" rel="noopener noreferrer" className="block h-full">
                    <Card className="hover-lift group h-full">
                      <CardContent className="flex h-full flex-col p-5">
                        <span className={cn("inline-flex h-12 w-12 items-center justify-center rounded-2xl transition-transform duration-300 group-hover:scale-110", TILE[i % 4])}>
                          <Sigma className="h-6 w-6" />
                        </span>
                        <h3 className="mt-4 font-display text-lg font-semibold tracking-tight">{m.title}</h3>
                        <p className="text-xs text-muted-foreground">{m.grades}</p>
                        <span className="mt-4 inline-flex items-center gap-1.5 text-sm font-medium text-primary">
                          Open curriculum <ExternalLink className="h-3.5 w-3.5 transition-transform group-hover:translate-x-0.5" />
                        </span>
                      </CardContent>
                    </Card>
                  </a>
                </Reveal>
              ))}
            </div>
            )}
            <Attribution text={MATH_ATTRIBUTION} />
          </TabsContent>

          {/* ---------------- SCIENCE (PhET) ---------------- */}
          <TabsContent value="science" className="mt-5 space-y-4">
            <GradeFilter grade={grade} onChange={setGrade} />
            {scienceItems.length === 0 ? (
              <EmptyGrade />
            ) : (
            <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
              {scienceItems.map((s, i) => (
                <Reveal key={s.slug} delay={i * 50}>
                  <Card className="hover-lift group h-full">
                    <CardContent className="flex h-full flex-col p-5">
                      <span className={cn("inline-flex h-12 w-12 items-center justify-center rounded-2xl transition-transform duration-300 group-hover:scale-110", TILE[i % 4])}>
                        <FlaskConical className="h-6 w-6" />
                      </span>
                      <h3 className="mt-4 font-display text-base font-semibold tracking-tight">{s.name}</h3>
                      <p className="text-xs text-muted-foreground">{s.subject} · Grades {s.grades}</p>
                      <div className="mt-4 flex gap-2">
                        <Button size="sm" onClick={() => setSim(s)}>
                          <Sparkles className="h-3.5 w-3.5" /> Launch
                        </Button>
                        <Button size="sm" variant="outline" asChild>
                          <a href={phetEmbedUrl(s.slug)} target="_blank" rel="noopener noreferrer">
                            <ExternalLink className="h-3.5 w-3.5" />
                          </a>
                        </Button>
                      </div>
                    </CardContent>
                  </Card>
                </Reveal>
              ))}
            </div>
            )}
            <Attribution text={SCIENCE_ATTRIBUTION} />
          </TabsContent>

          {/* ---------------- READING (Project Gutenberg) ---------------- */}
          <TabsContent value="reading" className="mt-5 space-y-4">
            <form onSubmit={runSearch} className="flex gap-2">
              <div className="relative flex-1">
                <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
                <Input
                  value={q}
                  onChange={(e) => setQ(e.target.value)}
                  placeholder="Search 70,000+ public-domain books (title or author)…"
                  className="pl-10"
                />
              </div>
              <Button type="submit" disabled={searching}>
                {searching ? <Loader2 className="h-4 w-4 animate-spin" /> : "Search"}
              </Button>
            </form>

            {searchError && (
              <p className="text-sm text-warning">
                Search is unavailable right now — browse the featured classics below.
              </p>
            )}

            {results && results.length > 0 ? (
              <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
                {results.map((b, i) => (
                  <Reveal key={b.id} delay={i * 40}>
                    <BookCard id={b.id} title={b.title} author={b.author} emoji="📖" />
                  </Reveal>
                ))}
              </div>
            ) : results && results.length === 0 && !searchError ? (
              <p className="text-sm text-muted-foreground">No matches — try another title or author.</p>
            ) : (
              <>
                <h2 className="font-display text-lg font-semibold tracking-tight">Featured classics</h2>
                <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
                  {READING_CLASSICS.map((c, i) => (
                    <Reveal key={c.id} delay={i * 40}>
                      <BookCard id={c.id} title={c.title} author={c.author} emoji={c.emoji} />
                    </Reveal>
                  ))}
                </div>
              </>
            )}
            <Attribution text={READING_ATTRIBUTION} />
          </TabsContent>
        </Tabs>
      </div>

      {/* PhET simulation embed dialog */}
      <Dialog open={!!sim} onOpenChange={(o) => !o && setSim(null)}>
        <DialogContent className="max-w-3xl">
          <DialogHeader>
            <DialogTitle className="font-display">{sim?.name}</DialogTitle>
            <DialogDescription>{sim?.subject} · Grades {sim?.grades} · PhET, CC BY 4.0</DialogDescription>
          </DialogHeader>
          {sim && (
            <div className="overflow-hidden rounded-xl border border-border bg-muted">
              <iframe
                title={sim.name}
                src={phetEmbedUrl(sim.slug)}
                className="h-[60vh] w-full"
                allowFullScreen
                loading="lazy"
              />
            </div>
          )}
          <p className="text-[11px] text-muted-foreground">{SCIENCE_ATTRIBUTION}</p>
        </DialogContent>
      </Dialog>
    </DashboardShell>
  );
}

function BookCard({ id, title, author, emoji }: { id: number; title: string; author: string; emoji: string }) {
  return (
    <a href={gutenbergReadUrl(id)} target="_blank" rel="noopener noreferrer" className="block h-full">
      <Card className="hover-lift group h-full">
        <CardContent className="flex h-full items-start gap-3 p-4">
          <span className="inline-flex h-11 w-11 shrink-0 items-center justify-center rounded-xl bg-secondary text-xl transition-transform duration-300 group-hover:scale-110">
            {emoji}
          </span>
          <div className="min-w-0 flex-1">
            <h3 className="font-display text-sm font-semibold leading-tight tracking-tight">{title}</h3>
            <p className="text-xs text-muted-foreground">{author}</p>
            <span className="mt-2 inline-flex items-center gap-1 text-xs font-medium text-primary">
              Read free <ExternalLink className="h-3 w-3 transition-transform group-hover:translate-x-0.5" />
            </span>
          </div>
        </CardContent>
      </Card>
    </a>
  );
}

function GradeFilter({ grade, onChange }: { grade: string; onChange: (v: string) => void }) {
  return (
    <div className="flex items-center gap-2">
      <span className="text-sm font-medium text-muted-foreground">Grade</span>
      <Select value={grade} onValueChange={onChange}>
        <SelectTrigger className="w-44" aria-label="Filter by grade">
          <SelectValue />
        </SelectTrigger>
        <SelectContent>
          {GRADE_BANDS.map((b) => (
            <SelectItem key={b.key} value={b.key}>{b.label}</SelectItem>
          ))}
        </SelectContent>
      </Select>
    </div>
  );
}

function EmptyGrade() {
  return (
    <Card>
      <CardContent className="py-10 text-center text-sm text-muted-foreground">
        No lessons for this grade band yet — try another grade.
      </CardContent>
    </Card>
  );
}

function Attribution({ text }: { text: string }) {
  return (
    <p className="rounded-xl border border-border bg-card/60 px-4 py-3 text-[11px] leading-relaxed text-muted-foreground">
      {text}
    </p>
  );
}
