import type { Json } from "@/integrations/supabase/types";
import {
  BookOpen,
  ClipboardCheck,
  ClipboardList,
  FileText,
  LinkIcon,
  MessageSquareText,
  PenLine,
  Presentation,
  Upload,
  Video,
  type LucideIcon,
} from "lucide-react";

export type AssignmentType =
  | "practice"
  | "written_response"
  | "quiz"
  | "project"
  | "discussion"
  | "upload"
  | "resource_review";

export type ResourceKind = "notes" | "slides" | "reading" | "video" | "link";

export type ResourceLink = {
  title: string;
  url: string;
  kind: ResourceKind;
};

export type AssignmentTypeMeta = {
  value: AssignmentType;
  label: string;
  description: string;
  icon: LucideIcon;
};

export const ASSIGNMENT_TYPES: AssignmentTypeMeta[] = [
  {
    value: "practice",
    label: "Practice",
    description: "Skill practice with optional in-app questions.",
    icon: ClipboardList,
  },
  {
    value: "written_response",
    label: "Written response",
    description: "Short or long-form writing with teacher review.",
    icon: PenLine,
  },
  {
    value: "quiz",
    label: "Quiz or check",
    description: "A scored check for understanding.",
    icon: ClipboardCheck,
  },
  {
    value: "project",
    label: "Project",
    description: "Multi-step work with links, uploads, or artifacts.",
    icon: BookOpen,
  },
  {
    value: "discussion",
    label: "Discussion",
    description: "A prompt for reflection or classroom conversation.",
    icon: MessageSquareText,
  },
  {
    value: "upload",
    label: "File or link upload",
    description: "Students submit outside work as a file or URL.",
    icon: Upload,
  },
  {
    value: "resource_review",
    label: "Resource review",
    description: "Students review notes, slides, readings, or videos.",
    icon: FileText,
  },
];

export const RESOURCE_KINDS: Array<{ value: ResourceKind; label: string; icon: LucideIcon }> = [
  { value: "notes", label: "Notes", icon: FileText },
  { value: "slides", label: "Slides", icon: Presentation },
  { value: "reading", label: "Reading", icon: BookOpen },
  { value: "video", label: "Video", icon: Video },
  { value: "link", label: "Link", icon: LinkIcon },
];

export const DEFAULT_ASSIGNMENT_TYPE: AssignmentType = "practice";
export const DEFAULT_RESOURCE_KIND: ResourceKind = "notes";

export const assignmentTypeValues = ASSIGNMENT_TYPES.map((type) => type.value);
export const resourceKindValues = RESOURCE_KINDS.map((kind) => kind.value);

export function getAssignmentTypeMeta(value?: string | null) {
  return ASSIGNMENT_TYPES.find((type) => type.value === value) ?? ASSIGNMENT_TYPES[0];
}

export function getResourceKindMeta(value?: string | null) {
  return RESOURCE_KINDS.find((kind) => kind.value === value) ?? RESOURCE_KINDS[0];
}

export function parseResourceLinks(value: Json | ResourceLink[] | null | undefined): ResourceLink[] {
  if (!Array.isArray(value)) return [];

  return value
    .map((item) => {
      if (!item || typeof item !== "object" || Array.isArray(item)) return null;
      const record = item as Record<string, unknown>;
      const title = typeof record.title === "string" ? record.title.trim() : "";
      const url = typeof record.url === "string" ? record.url.trim() : "";
      const kind = typeof record.kind === "string" && resourceKindValues.includes(record.kind as ResourceKind)
        ? record.kind as ResourceKind
        : DEFAULT_RESOURCE_KIND;
      if (!title || !url) return null;
      return { title, url, kind };
    })
    .filter((item): item is ResourceLink => item !== null);
}

export function normalizeResourceLinks(resources: ResourceLink[]) {
  return resources
    .map((resource) => ({
      title: resource.title.trim(),
      url: resource.url.trim(),
      kind: resource.kind,
    }))
    .filter((resource) => resource.title && resource.url);
}
