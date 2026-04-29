import { useEffect, useState } from "react";
import { useAuth } from "@/hooks/useAuth";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { StudentAvatar } from "@/components/StudentAvatar";

type Member = { id: string; name: string; items: string[]; isTeacher?: boolean };
type ClassRow = { id: string; name: string; subject: string; members: Member[] };

export function StudentClasses() {
  const { user } = useAuth();
  const [classes, setClasses] = useState<ClassRow[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!user) return;
    (async () => {
      setLoading(true);
      const { data: cls } = await supabase
        .from("classes")
        .select("id, name, subject, teacher_id");
      const list = (cls ?? []) as { id: string; name: string; subject: string; teacher_id: string }[];
      if (list.length === 0) { setClasses([]); setLoading(false); return; }
      const ids = list.map((c) => c.id);
      const { data: members } = await supabase
        .from("class_members").select("class_id, student_id").in("class_id", ids);
      const allUserIds = new Set<string>();
      list.forEach((c) => allUserIds.add(c.teacher_id));
      (members ?? []).forEach((m: any) => allUserIds.add(m.student_id));
      const { data: profs } = await supabase
        .from("profiles").select("id, full_name, avatar_items").in("id", Array.from(allUserIds));
      const pmap = new Map<string, { name: string; items: string[] }>();
      (profs ?? []).forEach((p: any) => pmap.set(p.id, { name: p.full_name || "User", items: (p.avatar_items ?? []) as string[] }));

      const byClass = new Map<string, Member[]>();
      list.forEach((c) => {
        const t = pmap.get(c.teacher_id);
        const arr: Member[] = [{ id: c.teacher_id, name: t?.name ?? "Teacher", items: t?.items ?? [], isTeacher: true }];
        byClass.set(c.id, arr);
      });
      (members ?? []).forEach((m: any) => {
        const arr = byClass.get(m.class_id);
        if (!arr) return;
        const p = pmap.get(m.student_id);
        arr.push({ id: m.student_id, name: p?.name ?? "Student", items: p?.items ?? [] });
      });

      setClasses(list.map((c) => ({ ...c, members: byClass.get(c.id) ?? [] })));
      setLoading(false);
    })();
  }, [user]);

  return (
    <Card>
      <CardHeader>
        <CardTitle className="text-base">My classes</CardTitle>
        <CardDescription>Classmates and teachers.</CardDescription>
      </CardHeader>
      <CardContent>
        {loading ? (
          <p className="text-sm text-muted-foreground">Loading...</p>
        ) : classes.length === 0 ? (
          <p className="text-sm text-muted-foreground">You haven't joined any classes yet.</p>
        ) : (
          <div className="space-y-4">
            {classes.map((c) => (
              <div key={c.id} className="rounded-lg border border-border p-3">
                <div className="mb-2">
                  <p className="font-medium">{c.name}</p>
                  <p className="text-xs text-muted-foreground">{c.subject}</p>
                </div>
                <ul className="flex flex-wrap gap-3">
                  {c.members.map((m) => (
                    <li key={m.id} className="inline-flex items-center gap-2">
                      <StudentAvatar size="sm" name={m.name} items={m.items} />
                      <span className="text-sm">
                        {m.id === user?.id ? "You" : m.name}
                        {m.isTeacher && <span className="ml-1 text-xs text-muted-foreground">(Teacher)</span>}
                      </span>
                    </li>
                  ))}
                </ul>
              </div>
            ))}
          </div>
        )}
      </CardContent>
    </Card>
  );
}
