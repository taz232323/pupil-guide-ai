import { useEffect, useState } from "react";
import { z } from "zod";
import { Plus, Copy, Users, Trash2, BookOpen } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import {
  Dialog, DialogContent, DialogDescription, DialogFooter,
  DialogHeader, DialogTitle, DialogTrigger,
} from "@/components/ui/dialog";
import { toast } from "sonner";
import { EmptyState } from "@/components/EmptyState";

type ClassRow = {
  id: string;
  name: string;
  subject: string;
  join_code: string;
  created_at: string;
  member_count?: number;
};

const createSchema = z.object({
  name: z.string().trim().min(1, "Name required").max(100),
  subject: z.string().trim().min(1, "Subject required").max(100),
});

export const TeacherClasses = () => {
  const [classes, setClasses] = useState<ClassRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [open, setOpen] = useState(false);
  const [name, setName] = useState("");
  const [subject, setSubject] = useState("");
  const [submitting, setSubmitting] = useState(false);

  const load = async () => {
    setLoading(true);
    const { data: cls, error } = await supabase
      .from("classes")
      .select("id, name, subject, join_code, created_at")
      .order("created_at", { ascending: false });
    if (error) {
      toast.error(error.message);
      setLoading(false);
      return;
    }
    // member counts
    const withCounts = await Promise.all(
      (cls ?? []).map(async (c) => {
        const { count } = await supabase
          .from("class_members")
          .select("*", { count: "exact", head: true })
          .eq("class_id", c.id);
        return { ...c, member_count: count ?? 0 };
      })
    );
    setClasses(withCounts);
    setLoading(false);
  };

  useEffect(() => {
    load();
  }, []);

  const handleCreate = async (e: React.FormEvent) => {
    e.preventDefault();
    const parsed = createSchema.safeParse({ name, subject });
    if (!parsed.success) {
      toast.error(parsed.error.issues[0].message);
      return;
    }
    setSubmitting(true);
    try {
      const { data: { user }, error: authErr } = await supabase.auth.getUser();
      if (authErr || !user) {
        toast.error("You're not signed in. Please sign in again.");
        return;
      }
      const { error } = await supabase.from("classes").insert({
        teacher_id: user.id,
        name: parsed.data.name,
        subject: parsed.data.subject,
      });
      if (error) {
        console.error("Create class failed:", error);
        if (error.code === "42501" || /permission denied|row-level security/i.test(error.message)) {
          toast.error("You don't have permission to create classes. Make sure your account is a teacher account.");
        } else if (/network|fetch|failed to fetch/i.test(error.message)) {
          toast.error("Couldn't reach the server. Check your connection and try again.");
        } else {
          toast.error(`Couldn't create class: ${error.message}`);
        }
        return;
      }
      toast.success("Class created");
      setOpen(false);
      setName("");
      setSubject("");
      load();
    } catch (err: any) {
      console.error("Unexpected error creating class:", err);
      toast.error(err?.message ?? "Something went wrong creating the class.");
    } finally {
      setSubmitting(false);
    }
  };

  const handleDelete = async (id: string) => {
    if (!confirm("Delete this class? This cannot be undone.")) return;
    const { error } = await supabase.from("classes").delete().eq("id", id);
    if (error) {
      toast.error(error.message);
      return;
    }
    toast.success("Class deleted");
    load();
  };

  const copyCode = (code: string) => {
    navigator.clipboard.writeText(code);
    toast.success("Join code copied");
  };

  return (
    <Card>
      <CardHeader className="flex flex-row items-center justify-between">
        <CardTitle className="text-base">My classes</CardTitle>
        <Dialog open={open} onOpenChange={setOpen}>
          <DialogTrigger asChild>
            <Button size="sm"><Plus className="h-4 w-4 mr-1" />New class</Button>
          </DialogTrigger>
          <DialogContent>
            <DialogHeader>
              <DialogTitle>Create a class</DialogTitle>
              <DialogDescription>Students will use the join code to enroll.</DialogDescription>
            </DialogHeader>
            <form onSubmit={handleCreate} className="space-y-4">
              <div className="space-y-2">
                <Label htmlFor="cls-name">Class name</Label>
                <Input id="cls-name" value={name} onChange={(e) => setName(e.target.value)}
                  placeholder="Period 3 Math" required />
              </div>
              <div className="space-y-2">
                <Label htmlFor="cls-subject">Subject</Label>
                <Input id="cls-subject" value={subject} onChange={(e) => setSubject(e.target.value)}
                  placeholder="Algebra II" required />
              </div>
              <DialogFooter>
                <Button type="submit" disabled={submitting}>
                  {submitting ? "Creating..." : "Create class"}
                </Button>
              </DialogFooter>
            </form>
          </DialogContent>
        </Dialog>
      </CardHeader>
      <CardContent>
        {loading ? (
          <p className="text-sm text-muted-foreground">Loading...</p>
        ) : classes.length === 0 ? (
          <EmptyState
            icon={BookOpen}
            title="No classes yet"
            description="Create your first class to invite students and post assignments."
          />
        ) : (
          <div className="divide-y divide-border">
            {classes.map((c) => (
              <div key={c.id} className="py-3 flex items-center justify-between gap-4">
                <div className="min-w-0">
                  <p className="font-medium truncate">{c.name}</p>
                  <p className="text-xs text-muted-foreground">{c.subject}</p>
                </div>
                <div className="flex items-center gap-2">
                  <span className="text-xs text-muted-foreground inline-flex items-center gap-1">
                    <Users className="h-3.5 w-3.5" />{c.member_count}
                  </span>
                  <button
                    onClick={() => copyCode(c.join_code)}
                    className="font-mono text-xs px-2 py-1 rounded bg-secondary hover:bg-accent inline-flex items-center gap-1.5"
                    title="Copy join code"
                  >
                    {c.join_code}
                    <Copy className="h-3 w-3" />
                  </button>
                  <Button variant="ghost" size="icon" onClick={() => handleDelete(c.id)}>
                    <Trash2 className="h-4 w-4 text-muted-foreground" />
                  </Button>
                </div>
              </div>
            ))}
          </div>
        )}
      </CardContent>
    </Card>
  );
};