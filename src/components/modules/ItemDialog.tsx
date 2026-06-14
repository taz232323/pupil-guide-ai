import { useEffect, useState } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle,
} from "@/components/ui/dialog";
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from "@/components/ui/select";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";
import { SpinnerButton } from "@/components/SpinnerButton";
import { RichEditor } from "@/components/RichEditor";
import { ItemType } from "./ModuleItemIcon";

type Assignment = { id: string; title: string };

export type ItemDraft = {
  id?: string;
  item_type: ItemType;
  title: string;
  content_html?: string | null;
  url?: string | null;
  file_path?: string | null;
  file_name?: string | null;
  assignment_id?: string | null;
};

export function ItemDialog({
  open, onOpenChange, classId, moduleId, initial, onSaved,
}: {
  open: boolean;
  onOpenChange: (v: boolean) => void;
  classId: string;
  moduleId: string;
  initial?: ItemDraft | null;
  onSaved: () => void;
}) {
  const [type, setType] = useState<ItemType>("lesson");
  const [title, setTitle] = useState("");
  const [content, setContent] = useState("");
  const [url, setUrl] = useState("");
  const [file, setFile] = useState<File | null>(null);
  const [existingFile, setExistingFile] = useState<{ path: string; name: string } | null>(null);
  const [assignmentId, setAssignmentId] = useState<string>("");
  const [assignments, setAssignments] = useState<Assignment[]>([]);
  const [submitting, setSubmitting] = useState(false);

  useEffect(() => {
    if (!open) return;
    setType(initial?.item_type ?? "lesson");
    setTitle(initial?.title ?? "");
    setContent(initial?.content_html ?? "");
    setUrl(initial?.url ?? "");
    setAssignmentId(initial?.assignment_id ?? "");
    setExistingFile(initial?.file_path ? { path: initial.file_path, name: initial.file_name ?? initial.file_path } : null);
    setFile(null);
    supabase.from("assignments").select("id, title").eq("class_id", classId)
      .order("created_at", { ascending: false })
      .then(({ data }) => setAssignments((data ?? []) as Assignment[]));
  }, [open, initial, classId]);

  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!title.trim()) { toast.error("Title is required"); return; }
    setSubmitting(true);

    let file_path: string | null | undefined = existingFile?.path ?? null;
    let file_name: string | null | undefined = existingFile?.name ?? null;

    try {
      if (type === "file") {
        if (file) {
          const path = `${classId}/${crypto.randomUUID()}-${file.name}`;
          const { error: upErr } = await supabase.storage.from("module-files").upload(path, file, {
            upsert: false, contentType: file.type || undefined,
          });
          if (upErr) throw upErr;
          file_path = path;
          file_name = file.name;
        } else if (!existingFile) {
          throw new Error("Please choose a file to upload");
        }
      }
      if (type === "link" && !url.trim()) throw new Error("URL is required");
      if (type === "assignment" && !assignmentId) throw new Error("Pick an assignment");

      const payload = {
        module_id: moduleId,
        item_type: type,
        title: title.trim(),
        content_html: type === "lesson" || type === "announcement" ? content : null,
        url: type === "link" ? url.trim() : null,
        file_path: type === "file" ? (file_path ?? null) : null,
        file_name: type === "file" ? (file_name ?? null) : null,
        assignment_id: type === "assignment" ? assignmentId : null,
      };

      if (initial?.id) {
        const { error } = await supabase.from("module_items").update(payload).eq("id", initial.id);
        if (error) throw error;
      } else {
        const { count } = await supabase.from("module_items")
          .select("*", { count: "exact", head: true }).eq("module_id", moduleId);
        const { error } = await supabase.from("module_items").insert({ ...payload, position: count ?? 0 });
        if (error) throw error;
      }
      toast.success(initial?.id ? "Item updated" : "Item added");
      onOpenChange(false);
      onSaved();
    } catch (err: any) {
      toast.error(err?.message ?? "Could not save item");
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-2xl max-h-[85vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>{initial?.id ? "Edit item" : "Add item"}</DialogTitle>
          <DialogDescription>Pick a type and fill in the details.</DialogDescription>
        </DialogHeader>
        <form onSubmit={submit} className="space-y-4">
          <div className="space-y-2">
            <Label>Type</Label>
            <Select value={type} onValueChange={(v) => setType(v as ItemType)} disabled={!!initial?.id}>
              <SelectTrigger><SelectValue /></SelectTrigger>
              <SelectContent>
                <SelectItem value="lesson">Lesson page</SelectItem>
                <SelectItem value="announcement">Announcement</SelectItem>
                <SelectItem value="file">File attachment</SelectItem>
                <SelectItem value="link">External link</SelectItem>
                <SelectItem value="assignment">Assignment</SelectItem>
              </SelectContent>
            </Select>
          </div>

          <div className="space-y-2">
            <Label htmlFor="it-title">Title</Label>
            <Input id="it-title" value={title} onChange={(e) => setTitle(e.target.value)} required />
          </div>

          {(type === "lesson" || type === "announcement") && (
            <div key={type} className="space-y-2 animate-fade-up">
              <Label>Content</Label>
              <RichEditor value={content} onChange={setContent} placeholder={type === "lesson" ? "Write the lesson..." : "Write the announcement..."} />
            </div>
          )}

          {type === "link" && (
            <div className="space-y-2 animate-fade-up">
              <Label htmlFor="it-url">URL</Label>
              <Input id="it-url" type="url" placeholder="https://..." value={url} onChange={(e) => setUrl(e.target.value)} required />
            </div>
          )}

          {type === "file" && (
            <div className="space-y-2 animate-fade-up">
              <Label htmlFor="it-file">File</Label>
              <Input id="it-file" type="file" onChange={(e) => setFile(e.target.files?.[0] ?? null)} />
              {existingFile && !file && (
                <p className="text-xs text-muted-foreground">Current file: {existingFile.name}</p>
              )}
            </div>
          )}

          {type === "assignment" && (
            <div className="space-y-2 animate-fade-up">
              <Label>Assignment</Label>
              <Select value={assignmentId} onValueChange={setAssignmentId}>
                <SelectTrigger><SelectValue placeholder="Pick an assignment" /></SelectTrigger>
                <SelectContent>
                  {assignments.length === 0 ? (
                    <div className="px-2 py-1.5 text-sm text-muted-foreground">No assignments yet</div>
                  ) : assignments.map((a) => (
                    <SelectItem key={a.id} value={a.id}>{a.title}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
              <p className="text-xs text-muted-foreground">Tip: Create the assignment first from the Assignments tab.</p>
            </div>
          )}

          <DialogFooter>
            <Button type="button" variant="ghost" onClick={() => onOpenChange(false)}>Cancel</Button>
            <SpinnerButton type="submit" loading={submitting} loadingText="Saving...">Save</SpinnerButton>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}