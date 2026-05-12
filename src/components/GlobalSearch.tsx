import { useEffect, useMemo, useRef, useState } from "react";
import { Link, useNavigate } from "react-router-dom";
import { Search, X, ClipboardList, BookOpen, MessageSquare, User, Loader2 } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";
import { cn } from "@/lib/utils";

type Result = {
  id: string;
  type: "assignment" | "module" | "message" | "student";
  title: string;
  subtitle: string;
  to: string;
};

const isMac = typeof navigator !== "undefined" && /Mac/i.test(navigator.platform);

function highlight(text: string, q: string) {
  if (!q) return text;
  const i = text.toLowerCase().indexOf(q.toLowerCase());
  if (i === -1) return text;
  return (
    <>
      {text.slice(0, i)}
      <span className="font-semibold text-foreground">{text.slice(i, i + q.length)}</span>
      {text.slice(i + q.length)}
    </>
  );
}

export function GlobalSearch() {
  const { user, role } = useAuth();
  const navigate = useNavigate();
  const [open, setOpen] = useState(false);
  const [q, setQ] = useState("");
  const [loading, setLoading] = useState(false);
  const [results, setResults] = useState<{
    assignments: Result[];
    modules: Result[];
    messages: Result[];
    students: Result[];
  }>({ assignments: [], modules: [], messages: [], students: [] });
  const inputRef = useRef<HTMLInputElement>(null);

  // Keyboard shortcut Cmd/Ctrl+K and Escape
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if ((e.metaKey || e.ctrlKey) && e.key.toLowerCase() === "k") {
        e.preventDefault();
        setOpen(true);
      } else if (e.key === "Escape") {
        setOpen(false);
      }
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, []);

  useEffect(() => {
    if (open) setTimeout(() => inputRef.current?.focus(), 50);
    else {
      setQ("");
      setResults({ assignments: [], modules: [], messages: [], students: [] });
    }
  }, [open]);

  // Live search debounced
  useEffect(() => {
    if (!user || q.trim().length < 2) {
      setResults({ assignments: [], modules: [], messages: [], students: [] });
      setLoading(false);
      return;
    }
    setLoading(true);
    const term = q.trim();
    const like = `%${term}%`;
    const handle = setTimeout(async () => {
      try {
        const isTeacher = role === "teacher";
        const aBase = `/${role}/assignments`;
        const cBase = `/${role}/classes`;

        // Class lookup for subtitles
        const classMap = new Map<string, string>();
        const { data: classes } = await supabase.from("classes").select("id, name");
        classes?.forEach((c: any) => classMap.set(c.id, c.name));

        const [aRes, mRes, msgRes, stuRes] = await Promise.all([
          supabase
            .from("assignments")
            .select("id, title, class_id, due_date")
            .ilike("title", like)
            .limit(10),
          supabase
            .from("modules")
            .select("id, title, class_id")
            .ilike("title", like)
            .limit(10),
          supabase
            .from("messages")
            .select("id, body, sender_id, recipient_id, class_id, created_at")
            .ilike("body", like)
            .order("created_at", { ascending: false })
            .limit(10),
          isTeacher
            ? supabase
                .from("class_members")
                .select("student_id, class_id")
                .limit(200)
            : Promise.resolve({ data: [] as any[] }),
        ]);

        const assignments: Result[] = (aRes.data ?? []).map((a: any) => ({
          id: a.id,
          type: "assignment",
          title: a.title,
          subtitle: `${classMap.get(a.class_id) ?? "Class"}${
            a.due_date ? ` · Due ${new Date(a.due_date).toLocaleDateString()}` : ""
          }`,
          to: `${aBase}/${a.id}`,
        }));

        const modules: Result[] = (mRes.data ?? []).map((m: any) => ({
          id: m.id,
          type: "module",
          title: m.title,
          subtitle: classMap.get(m.class_id) ?? "Class",
          to: `${cBase}/${m.class_id}`,
        }));

        // Sender names for messages
        const senderIds = Array.from(new Set((msgRes.data ?? []).map((m: any) => m.sender_id)));
        const nameMap = new Map<string, string>();
        if (senderIds.length) {
          const { data: profs } = await supabase
            .from("profiles")
            .select("id, full_name")
            .in("id", senderIds);
          profs?.forEach((p: any) => nameMap.set(p.id, p.full_name || "Unknown"));
        }
        const messages: Result[] = (msgRes.data ?? []).map((m: any) => ({
          id: m.id,
          type: "message",
          title: (m.body as string).slice(0, 80),
          subtitle: `From ${nameMap.get(m.sender_id) ?? "Unknown"}`,
          to: `/messages`,
        }));

        let students: Result[] = [];
        if (isTeacher && stuRes.data?.length) {
          const studentIds = Array.from(new Set(stuRes.data.map((r: any) => r.student_id)));
          const { data: profs } = await supabase
            .from("profiles")
            .select("id, full_name")
            .in("id", studentIds)
            .ilike("full_name", like)
            .limit(10);
          const stuClassMap = new Map<string, string>();
          stuRes.data.forEach((r: any) => {
            if (!stuClassMap.has(r.student_id))
              stuClassMap.set(r.student_id, classMap.get(r.class_id) ?? "Class");
          });
          students = (profs ?? []).map((p: any) => ({
            id: p.id,
            type: "student",
            title: p.full_name || "Unnamed",
            subtitle: stuClassMap.get(p.id) ?? "Student",
            to: `/messages`,
          }));
        }

        setResults({ assignments, modules, messages, students });
      } finally {
        setLoading(false);
      }
    }, 200);
    return () => clearTimeout(handle);
  }, [q, user, role]);

  const total =
    results.assignments.length +
    results.modules.length +
    results.messages.length +
    results.students.length;

  const sections = useMemo(
    () =>
      [
        { key: "assignments", label: "Assignments", icon: ClipboardList, items: results.assignments, seeAll: `/${role}/assignments` },
        { key: "modules", label: "Modules", icon: BookOpen, items: results.modules, seeAll: `/${role}/classes` },
        { key: "messages", label: "Messages", icon: MessageSquare, items: results.messages, seeAll: `/messages` },
        ...(role === "teacher"
          ? [{ key: "students", label: "Students", icon: User, items: results.students, seeAll: `/teacher/classes` }]
          : []),
      ].filter((s) => s.items.length > 0),
    [results, role]
  );

  const go = (to: string) => {
    setOpen(false);
    navigate(to);
  };

  return (
    <>
      <button
        aria-label="Search"
        onClick={() => setOpen(true)}
        className="inline-flex items-center gap-2 rounded-full border border-border bg-background/60 px-3 h-9 text-xs text-muted-foreground hover:bg-secondary transition-base"
      >
        <Search className="h-4 w-4" />
        <span className="hidden sm:inline">Search…</span>
        <kbd className="hidden md:inline ml-1 rounded bg-muted px-1.5 py-0.5 text-[10px] font-mono">
          {isMac ? "⌘K" : "Ctrl K"}
        </kbd>
      </button>

      {open && (
        <div
          className="fixed inset-0 z-50 bg-background/70 backdrop-blur-sm animate-fade-in"
          onClick={() => setOpen(false)}
        >
          <div
            className="mx-auto mt-[10vh] w-[min(720px,92vw)] rounded-2xl border border-border bg-card shadow-xl overflow-hidden animate-scale-in"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="flex items-center gap-2 px-4 h-14 border-b border-border">
              <Search className="h-5 w-5 text-muted-foreground shrink-0" />
              <input
                ref={inputRef}
                value={q}
                onChange={(e) => setQ(e.target.value)}
                placeholder={`Search assignments, modules, messages…  (${isMac ? "⌘K" : "Ctrl K"})`}
                className="flex-1 bg-transparent outline-none text-base placeholder:text-muted-foreground"
              />
              {loading && <Loader2 className="h-4 w-4 animate-spin text-muted-foreground" />}
              <button
                onClick={() => setOpen(false)}
                className="p-1 rounded hover:bg-secondary"
                aria-label="Close"
              >
                <X className="h-4 w-4" />
              </button>
            </div>

            <div className="max-h-[60vh] overflow-y-auto">
              {q.trim().length < 2 ? (
                <div className="px-6 py-10 text-center text-sm text-muted-foreground">
                  Type at least 2 characters to search.
                </div>
              ) : !loading && total === 0 ? (
                <div className="px-6 py-10 text-center text-sm">
                  <p className="font-medium">No results for “{q}”</p>
                  <p className="text-muted-foreground mt-1">
                    Try different keywords or check spelling.
                  </p>
                </div>
              ) : (
                <div className="py-2">
                  {sections.map((s) => {
                    const Icon = s.icon;
                    const shown = s.items.slice(0, 3);
                    return (
                      <div key={s.key} className="py-2">
                        <div className="flex items-center justify-between px-4 pb-1">
                          <span className="text-[11px] font-semibold uppercase tracking-wider text-muted-foreground">
                            {s.label}
                          </span>
                          {s.items.length > 3 && (
                            <button
                              onClick={() => go(s.seeAll)}
                              className="text-xs text-primary hover:underline"
                            >
                              See all
                            </button>
                          )}
                        </div>
                        <ul>
                          {shown.map((r) => (
                            <li key={`${s.key}-${r.id}`}>
                              <button
                                onClick={() => go(r.to)}
                                className={cn(
                                  "w-full flex items-start gap-3 px-4 py-2.5 text-left hover:bg-secondary transition-base"
                                )}
                              >
                                <span className="mt-0.5 h-8 w-8 rounded-lg bg-primary-soft text-primary flex items-center justify-center shrink-0">
                                  <Icon className="h-4 w-4" />
                                </span>
                                <span className="min-w-0 flex-1">
                                  <span className="block text-sm text-muted-foreground truncate">
                                    {highlight(r.title, q)}
                                  </span>
                                  <span className="block text-xs text-muted-foreground/80 truncate">
                                    {r.subtitle}
                                  </span>
                                </span>
                              </button>
                            </li>
                          ))}
                        </ul>
                      </div>
                    );
                  })}
                </div>
              )}
            </div>
          </div>
        </div>
      )}
    </>
  );
}

export default GlobalSearch;