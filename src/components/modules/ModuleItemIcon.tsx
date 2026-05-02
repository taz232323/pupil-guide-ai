import { FileText, Megaphone, Paperclip, LinkIcon, ClipboardList, LucideIcon } from "lucide-react";

export type ItemType = "lesson" | "announcement" | "file" | "link" | "assignment";

const map: Record<ItemType, { icon: LucideIcon; label: string; tone: string }> = {
  lesson: { icon: FileText, label: "Lesson", tone: "text-primary bg-primary-soft" },
  announcement: { icon: Megaphone, label: "Announcement", tone: "text-warning bg-warning-soft" },
  file: { icon: Paperclip, label: "File", tone: "text-foreground bg-secondary" },
  link: { icon: LinkIcon, label: "Link", tone: "text-foreground bg-secondary" },
  assignment: { icon: ClipboardList, label: "Assignment", tone: "text-primary bg-primary-soft" },
};

export function ModuleItemIcon({ type, className = "h-4 w-4" }: { type: ItemType; className?: string }) {
  const Icon = map[type].icon;
  return <Icon className={className} />;
}

export function itemMeta(type: ItemType) {
  return map[type];
}