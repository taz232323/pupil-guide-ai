import { useEffect, useMemo, useState } from "react";
import { Link } from "react-router-dom";
import {
  Plus, Pencil, Trash2, ChevronDown, ChevronRight, GripVertical, CheckCircle2,
  Download, ExternalLink, FileText, Megaphone, Paperclip, LinkIcon, ClipboardList,
} from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import {
  Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle,
} from "@/components/ui/dialog";
import { ConfirmDialog } from "@/components/ConfirmDialog";
import { IconButton } from "@/components/IconButton";
import { EmptyState } from "@/components/EmptyState";
import { SpinnerButton } from "@/components/SpinnerButton";
import { CardListSkeleton } from "@/components/Skeletons";
import { toast } from "sonner";
import { cn } from "@/lib/utils";
import { RichContent } from "@/components/RichEditor";
import { ItemDialog, ItemDraft } from "./ItemDialog";
import { ItemType, itemMeta } from "./ModuleItemIcon";
import {
  DndContext, PointerSensor, useSensor, useSensors, closestCenter, DragEndEvent,
} from "@dnd-kit/core";
import {
  SortableContext, useSortable, verticalListSortingStrategy, arrayMove,
} from "@dnd-kit/sortable";
import { CSS } from "@dnd-kit/utilities";

type ModuleRow = {
  id: string;
  class_id: string;
  title: string;
  description: string | null;
  position: number;
};

type ItemRow = {
  id: string;
  module_id: string;
  item_type: ItemType;
  title: string;
  position: number;
  content_html: string | null;
  url: string | null;
  file_path: string | null;
  file_name: string | null;
  assignment_id: string | null;
};

const FILES_BUCKET = "module-files";

function fileUrl(path: string) {
  return supabase.storage.from(FILES_BUCKET).getPublicUrl(path).data.publicUrl;
}

export function ClassModules({ classId, isTeacher }: { classId: string; isTeacher: boolean }) {
  const { user } = useAuth();
  const [loading, setLoading] = useState(true);
  const [modules, setModules] = useState<ModuleRow[]>([]);
  const [items, setItems] = useState<ItemRow[]>([]);
  const [completed, setCompleted] = useState<Set<string>>(new Set());
  const [openModuleIds, setOpenModuleIds] = useState<Set<string>>(new Set());

  // module dialogs
  const [modOpen, setModOpen] = useState(false);
  const [modEditing, setModEditing] = useState<ModuleRow | null>(null);
  const [modTitle, setModTitle] = useState("");
  const [modDesc, setModDesc] = useState("");
  const [modSubmitting, setModSubmitting] = useState(false);
  const [modToDelete, setModToDelete] = useState<ModuleRow | null>(null);

  // item dialog
  const [itemDialogOpen, setItemDialogOpen] = useState(false);
  const [itemEditing, setItemEditing] = useState<ItemRow | null>(null);
  const [itemModuleId, setItemModuleId] = useState<string>("");
  const [itemToDelete, setItemToDelete] = useState<ItemRow | null>(null);

  // lesson viewer
  const [viewItem, setViewItem] = useState<ItemRow | null>(null);

  const load = async () => {
    setLoading(true);
    const { data: mods } = await supabase
      .from("modules").select("*").eq("class_id", classId)
      .order("position", { ascending: true });
    const modList = (mods ?? []) as ModuleRow[];
    setModules(modList);
    const ids = modList.map((m) => m.id);
    if (ids.length === 0) {
      setItems([]); setCompleted(new Set()); setLoading(false); return;
    }
    const { data: its } = await supabase
      .from("module_items").select("*").in("module_id", ids)
      .order("position", { ascending: true });
    const itemList = (its ?? []) as ItemRow[];
    setItems(itemList);

    if (!isTeacher && user) {
      const itemIds = itemList.map((i) => i.id);
      let completedSet = new Set<string>();
      if (itemIds.length) {
        const { data: comps } = await supabase
          .from("module_item_completions").select("item_id")
          .eq("student_id", user.id).in("item_id", itemIds);
        completedSet = new Set((comps ?? []).map((c: any) => c.item_id as string));
      }
      // Mark assignment items complete if a submission exists
      const asgnItems = itemList.filter((i) => i.item_type === "assignment" && i.assignment_id);
      if (asgnItems.length) {
        const { data: subs } = await supabase
          .from("submissions").select("assignment_id")
          .eq("student_id", user.id)
          .in("assignment_id", asgnItems.map((i) => i.assignment_id!));
        const submitted = new Set((subs ?? []).map((s: any) => s.assignment_id as string));
        asgnItems.forEach((i) => {
          if (i.assignment_id && submitted.has(i.assignment_id)) completedSet.add(i.id);
        });
      }
      setCompleted(completedSet);
    } else {
      setCompleted(new Set());
    }

    // expand all by default first time
    setOpenModuleIds((prev) => prev.size ? prev : new Set(modList.map((m) => m.id)));
    setLoading(false);
  };

  useEffect(() => { load(); /* eslint-disable-next-line */ }, [classId, user?.id]);

  const itemsByModule = useMemo(() => {
    const m = new Map<string, ItemRow[]>();
    items.forEach((i) => {
      const arr = m.get(i.module_id) ?? [];
      arr.push(i);
      m.set(i.module_id, arr);
    });
    return m;
  }, [items]);

  const toggleOpen = (id: string) => {
    setOpenModuleIds((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id); else next.add(id);
      return next;
    });
  };

  // Module CRUD
  const openCreateModule = () => {
    setModEditing(null); setModTitle(""); setModDesc(""); setModOpen(true);
  };
  const openEditModule = (m: ModuleRow) => {
    setModEditing(m); setModTitle(m.title); setModDesc(m.description ?? ""); setModOpen(true);
  };

  const submitModule = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!modTitle.trim()) { toast.error("Title is required"); return; }
    setModSubmitting(true);
    try {
      if (modEditing) {
        const { error } = await supabase.from("modules")
          .update({ title: modTitle.trim(), description: modDesc.trim() || null })
          .eq("id", modEditing.id);
        if (error) throw error;
      } else {
        const { error } = await supabase.from("modules").insert({
          class_id: classId,
          title: modTitle.trim(),
          description: modDesc.trim() || null,
          position: modules.length,
        });
        if (error) throw error;
      }
      toast.success(modEditing ? "Module updated" : "Module created");
      setModOpen(false);
      load();
    } catch (err: any) {
      toast.error(err?.message ?? "Could not save module");
    } finally {
      setModSubmitting(false);
    }
  };

  const deleteModule = async (id: string) => {
    const { error } = await supabase.from("modules").delete().eq("id", id);
    if (error) { toast.error(error.message); return; }
    toast.success("Module deleted");
    load();
  };

  const deleteItem = async (id: string) => {
    const { error } = await supabase.from("module_items").delete().eq("id", id);
    if (error) { toast.error(error.message); return; }
    toast.success("Item removed");
    load();
  };

  // Reorder
  const sensors = useSensors(useSensor(PointerSensor, { activationConstraint: { distance: 5 } }));

  const onModuleDragEnd = async (e: DragEndEvent) => {
    const { active, over } = e;
    if (!over || active.id === over.id) return;
    const oldIdx = modules.findIndex((m) => m.id === active.id);
    const newIdx = modules.findIndex((m) => m.id === over.id);
    if (oldIdx < 0 || newIdx < 0) return;
    const next = arrayMove(modules, oldIdx, newIdx);
    setModules(next);
    await Promise.all(
      next.map((m, i) => m.position === i ? null :
        supabase.from("modules").update({ position: i }).eq("id", m.id))
    );
  };

  const onItemDragEnd = (moduleId: string) => async (e: DragEndEvent) => {
    const { active, over } = e;
    if (!over || active.id === over.id) return;
    const list = (itemsByModule.get(moduleId) ?? []).slice();
    const oldIdx = list.findIndex((i) => i.id === active.id);
    const newIdx = list.findIndex((i) => i.id === over.id);
    if (oldIdx < 0 || newIdx < 0) return;
    const next = arrayMove(list, oldIdx, newIdx);
    // optimistic state update
    setItems((prev) => {
      const others = prev.filter((i) => i.module_id !== moduleId);
      return [...others, ...next.map((i, idx) => ({ ...i, position: idx }))];
    });
    await Promise.all(
      next.map((i, idx) => supabase.from("module_items").update({ position: idx }).eq("id", i.id))
    );
  };

  // Student: open lesson => mark complete on first open
  const openItem = async (item: ItemRow) => {
    if (item.item_type === "lesson" || item.item_type === "announcement") {
      setViewItem(item);
      if (!isTeacher && user && !completed.has(item.id)) {
        const { error } = await supabase.from("module_item_completions").insert({
          item_id: item.id, student_id: user.id,
        });
        if (!error) setCompleted((s) => new Set(s).add(item.id));
      }
    } else if (item.item_type === "file" && item.file_path) {
      window.open(fileUrl(item.file_path), "_blank", "noopener,noreferrer");
      if (!isTeacher && user && !completed.has(item.id)) {
        await supabase.from("module_item_completions").insert({ item_id: item.id, student_id: user.id });
        setCompleted((s) => new Set(s).add(item.id));
      }
    } else if (item.item_type === "link" && item.url) {
      window.open(item.url, "_blank", "noopener,noreferrer");
      if (!isTeacher && user && !completed.has(item.id)) {
        await supabase.from("module_item_completions").insert({ item_id: item.id, student_id: user.id });
        setCompleted((s) => new Set(s).add(item.id));
      }
    }
  };

  if (loading) return <CardListSkeleton count={2} />;

  if (modules.length === 0) {
    return (
      <EmptyState
        icon={FileText}
        title="No modules yet"
        description={isTeacher
          ? "Create your first module to organize lessons, files, and assignments."
          : "Your teacher hasn't added any modules to this class yet."}
        action={isTeacher ? (
          <Button onClick={openCreateModule}><Plus className="h-4 w-4 mr-1" />New module</Button>
        ) : undefined}
      />
    );
  }

  return (
    <div className="space-y-4">
      {isTeacher && (
        <div className="flex justify-end">
          <Button onClick={openCreateModule} size="sm"><Plus className="h-4 w-4 mr-1" />New module</Button>
        </div>
      )}

      {isTeacher ? (
        <DndContext sensors={sensors} collisionDetection={closestCenter} onDragEnd={onModuleDragEnd}>
          <SortableContext items={modules.map((m) => m.id)} strategy={verticalListSortingStrategy}>
            <div className="space-y-3">
              {modules.map((m) => (
                <SortableModule
                  key={m.id}
                  module={m}
                  isOpen={openModuleIds.has(m.id)}
                  onToggle={() => toggleOpen(m.id)}
                  onEdit={() => openEditModule(m)}
                  onDelete={() => setModToDelete(m)}
                  isTeacher
                >
                  <ModuleItemsList
                    moduleId={m.id}
                    items={itemsByModule.get(m.id) ?? []}
                    completed={completed}
                    isTeacher
                    onAdd={() => { setItemEditing(null); setItemModuleId(m.id); setItemDialogOpen(true); }}
                    onEdit={(it) => { setItemEditing(it); setItemModuleId(m.id); setItemDialogOpen(true); }}
                    onDelete={(it) => setItemToDelete(it)}
                    onOpen={openItem}
                    onDragEnd={onItemDragEnd(m.id)}
                    sensors={sensors}
                  />
                </SortableModule>
              ))}
            </div>
          </SortableContext>
        </DndContext>
      ) : (
        <div className="space-y-3">
          {modules.map((m) => {
            const list = itemsByModule.get(m.id) ?? [];
            const total = list.length;
            const done = list.filter((i) => completed.has(i.id)).length;
            return (
              <Card key={m.id} className="overflow-hidden">
                <button
                  type="button"
                  onClick={() => toggleOpen(m.id)}
                  className="w-full flex items-center gap-3 p-4 text-left hover:bg-muted/40 transition-colors"
                >
                  {openModuleIds.has(m.id) ? <ChevronDown className="h-4 w-4 shrink-0" /> : <ChevronRight className="h-4 w-4 shrink-0" />}
                  <div className="flex-1 min-w-0">
                    <p className="font-semibold truncate">{m.title}</p>
                    {m.description && <p className="text-xs text-muted-foreground truncate">{m.description}</p>}
                  </div>
                  <span className="text-xs text-muted-foreground shrink-0">{done}/{total}</span>
                </button>
                {openModuleIds.has(m.id) && (
                  <div className="border-t border-border">
                    {list.length === 0 ? (
                      <p className="px-4 py-3 text-sm text-muted-foreground">No items in this module yet.</p>
                    ) : (
                      <ul className="divide-y divide-border">
                        {list.map((it) => (
                          <li key={it.id}>
                            <StudentItemRow item={it} done={completed.has(it.id)} onOpen={() => openItem(it)} />
                          </li>
                        ))}
                      </ul>
                    )}
                  </div>
                )}
              </Card>
            );
          })}
        </div>
      )}

      {/* Module create/edit */}
      <Dialog open={modOpen} onOpenChange={setModOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>{modEditing ? "Edit module" : "New module"}</DialogTitle>
            <DialogDescription>Modules group related lessons and assignments.</DialogDescription>
          </DialogHeader>
          <form onSubmit={submitModule} className="space-y-4">
            <div className="space-y-2">
              <Label htmlFor="m-title">Title</Label>
              <Input id="m-title" placeholder="Unit 1 — Introduction" value={modTitle} onChange={(e) => setModTitle(e.target.value)} required />
            </div>
            <div className="space-y-2">
              <Label htmlFor="m-desc">Description (optional)</Label>
              <Textarea id="m-desc" rows={3} value={modDesc} onChange={(e) => setModDesc(e.target.value)} />
            </div>
            <DialogFooter>
              <Button type="button" variant="ghost" onClick={() => setModOpen(false)}>Cancel</Button>
              <SpinnerButton type="submit" loading={modSubmitting} loadingText="Saving...">Save</SpinnerButton>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>

      {/* Item create/edit */}
      <ItemDialog
        open={itemDialogOpen}
        onOpenChange={setItemDialogOpen}
        classId={classId}
        moduleId={itemModuleId}
        initial={itemEditing as ItemDraft | null}
        onSaved={load}
      />

      {/* Lesson viewer (also used for announcement) */}
      <Dialog open={!!viewItem} onOpenChange={(o) => !o && setViewItem(null)}>
        <DialogContent className="max-w-3xl max-h-[85vh] overflow-y-auto">
          {viewItem && (
            <>
              <DialogHeader>
                <DialogTitle className="flex items-center gap-2">
                  {viewItem.item_type === "announcement" ? <Megaphone className="h-5 w-5 text-warning" /> : <FileText className="h-5 w-5 text-primary" />}
                  {viewItem.title}
                </DialogTitle>
              </DialogHeader>
              <RichContent html={viewItem.content_html ?? ""} />
            </>
          )}
        </DialogContent>
      </Dialog>

      <ConfirmDialog
        open={!!modToDelete}
        onOpenChange={(o) => !o && setModToDelete(null)}
        title={`Delete "${modToDelete?.title ?? ""}"?`}
        description="This removes the module and every item inside it. This cannot be undone."
        confirmLabel="Delete module"
        destructive
        onConfirm={async () => { if (modToDelete) await deleteModule(modToDelete.id); }}
      />
      <ConfirmDialog
        open={!!itemToDelete}
        onOpenChange={(o) => !o && setItemToDelete(null)}
        title={`Remove "${itemToDelete?.title ?? ""}"?`}
        description="This removes the item from the module. Linked assignments are not deleted."
        confirmLabel="Remove item"
        destructive
        onConfirm={async () => { if (itemToDelete) await deleteItem(itemToDelete.id); }}
      />
    </div>
  );
}

/* ---------- Sortable wrappers ---------- */

function SortableModule({
  module: m, isOpen, onToggle, onEdit, onDelete, isTeacher, children,
}: {
  module: ModuleRow;
  isOpen: boolean;
  onToggle: () => void;
  onEdit: () => void;
  onDelete: () => void;
  isTeacher: boolean;
  children: React.ReactNode;
}) {
  const { attributes, listeners, setNodeRef, transform, transition, isDragging } = useSortable({ id: m.id });
  const style = { transform: CSS.Transform.toString(transform), transition, opacity: isDragging ? 0.6 : 1 };
  return (
    <Card ref={setNodeRef} style={style} className="overflow-hidden">
      <CardHeader className="flex flex-row items-center gap-2 py-3">
        {isTeacher && (
          <button {...attributes} {...listeners} className="cursor-grab active:cursor-grabbing text-muted-foreground touch-none" aria-label="Drag to reorder module">
            <GripVertical className="h-4 w-4" />
          </button>
        )}
        <button type="button" onClick={onToggle} className="flex-1 flex items-center gap-2 text-left min-w-0">
          {isOpen ? <ChevronDown className="h-4 w-4 shrink-0" /> : <ChevronRight className="h-4 w-4 shrink-0" />}
          <div className="min-w-0">
            <CardTitle className="text-base truncate">{m.title}</CardTitle>
            {m.description && <p className="text-xs text-muted-foreground truncate">{m.description}</p>}
          </div>
        </button>
        {isTeacher && (
          <div className="flex items-center gap-1">
            <IconButton label="Edit module" onClick={onEdit}><Pencil className="h-4 w-4 text-muted-foreground" /></IconButton>
            <IconButton label="Delete module" onClick={onDelete}><Trash2 className="h-4 w-4 text-muted-foreground" /></IconButton>
          </div>
        )}
      </CardHeader>
      {isOpen && <CardContent className="pt-0">{children}</CardContent>}
    </Card>
  );
}

function ModuleItemsList({
  moduleId, items, completed, isTeacher, onAdd, onEdit, onDelete, onOpen, onDragEnd, sensors,
}: {
  moduleId: string;
  items: ItemRow[];
  completed: Set<string>;
  isTeacher: boolean;
  onAdd: () => void;
  onEdit: (it: ItemRow) => void;
  onDelete: (it: ItemRow) => void;
  onOpen: (it: ItemRow) => void;
  onDragEnd: (e: DragEndEvent) => void;
  sensors: ReturnType<typeof useSensors>;
}) {
  return (
    <div className="space-y-2">
      {items.length === 0 ? (
        <p className="text-sm text-muted-foreground py-2">No items yet.</p>
      ) : (
        <DndContext sensors={sensors} collisionDetection={closestCenter} onDragEnd={onDragEnd}>
          <SortableContext items={items.map((i) => i.id)} strategy={verticalListSortingStrategy}>
            <ul className="divide-y divide-border rounded-md border border-border">
              {items.map((it) => (
                <SortableItem
                  key={it.id}
                  item={it}
                  done={completed.has(it.id)}
                  isTeacher={isTeacher}
                  onEdit={() => onEdit(it)}
                  onDelete={() => onDelete(it)}
                  onOpen={() => onOpen(it)}
                />
              ))}
            </ul>
          </SortableContext>
        </DndContext>
      )}
      {isTeacher && (
        <Button size="sm" variant="outline" onClick={onAdd}>
          <Plus className="h-4 w-4 mr-1" />Add item
        </Button>
      )}
    </div>
  );
}

function SortableItem({
  item, done, isTeacher, onEdit, onDelete, onOpen,
}: {
  item: ItemRow;
  done: boolean;
  isTeacher: boolean;
  onEdit: () => void;
  onDelete: () => void;
  onOpen: () => void;
}) {
  const { attributes, listeners, setNodeRef, transform, transition, isDragging } = useSortable({ id: item.id });
  const style = { transform: CSS.Transform.toString(transform), transition, opacity: isDragging ? 0.6 : 1 };
  const meta = itemMeta(item.item_type);
  const Icon = meta.icon;

  if (isTeacher) {
    return (
      <li ref={setNodeRef} style={style} className="flex items-center gap-2 px-3 py-2">
        <button {...attributes} {...listeners} className="cursor-grab active:cursor-grabbing text-muted-foreground touch-none" aria-label="Drag to reorder item">
          <GripVertical className="h-4 w-4" />
        </button>
        <span className={cn("inline-flex h-7 w-7 items-center justify-center rounded-md", meta.tone)}>
          <Icon className="h-4 w-4" />
        </span>
        <div className="flex-1 min-w-0">
          <p className="text-sm font-medium truncate">{item.title}</p>
          <p className="text-xs text-muted-foreground capitalize">{meta.label}</p>
        </div>
        <IconButton label="Edit item" onClick={onEdit}><Pencil className="h-4 w-4 text-muted-foreground" /></IconButton>
        <IconButton label="Remove item" onClick={onDelete}><Trash2 className="h-4 w-4 text-muted-foreground" /></IconButton>
      </li>
    );
  }

  return null;
}

function StudentItemRow({ item, done, onOpen }: { item: ItemRow; done: boolean; onOpen: () => void }) {
  const meta = itemMeta(item.item_type);
  const Icon = meta.icon;

  // Assignment item links to the detail page
  if (item.item_type === "assignment" && item.assignment_id) {
    return (
      <Link
        to={`/student/assignments/${item.assignment_id}`}
        className="flex items-center gap-3 px-4 py-3 hover:bg-muted/40 transition-colors"
      >
        <span className={cn("inline-flex h-8 w-8 items-center justify-center rounded-md", meta.tone)}>
          <Icon className="h-4 w-4" />
        </span>
        <div className="flex-1 min-w-0">
          <p className="text-sm font-medium truncate">{item.title}</p>
          <p className="text-xs text-muted-foreground">{meta.label}</p>
        </div>
        {done && <CheckCircle2 className="h-5 w-5 text-success" aria-label="Completed" />}
      </Link>
    );
  }

  return (
    <button
      type="button"
      onClick={onOpen}
      className="w-full flex items-center gap-3 px-4 py-3 text-left hover:bg-muted/40 transition-colors"
    >
      <span className={cn("inline-flex h-8 w-8 items-center justify-center rounded-md", meta.tone)}>
        <Icon className="h-4 w-4" />
      </span>
      <div className="flex-1 min-w-0">
        <p className="text-sm font-medium truncate">{item.title}</p>
        <p className="text-xs text-muted-foreground">{meta.label}</p>
      </div>
      {item.item_type === "file" && <Download className="h-4 w-4 text-muted-foreground" />}
      {item.item_type === "link" && <ExternalLink className="h-4 w-4 text-muted-foreground" />}
      {done && <CheckCircle2 className="h-5 w-5 text-success ml-1" aria-label="Completed" />}
    </button>
  );
}