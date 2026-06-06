import {
  ArrowRight,
  CheckCircle2,
  Clock3,
  GitCompare,
  Lightbulb,
  Network,
  Paintbrush,
  Workflow,
} from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { cn } from "@/lib/utils";
import type { SketchPayload, SketchTemplate } from "./types";

const TEMPLATE_LABELS: Record<SketchTemplate, string> = {
  process: "Process",
  cause_effect: "Cause and effect",
  system: "System",
  compare: "Compare",
  timeline: "Timeline",
};

export function SketchCard({ sketch }: { sketch: SketchPayload }) {
  const labels = cleanList(sketch.labels, 5, 24);
  const steps = cleanList(sketch.steps, 4, 90);

  return (
    <div className="space-y-3 whitespace-normal">
      <div className="space-y-1">
        <div className="flex flex-wrap items-center gap-2">
          <Badge className="gap-1 border-amber-300/40 bg-amber-100 text-amber-900 hover:bg-amber-100">
            <Paintbrush className="h-3 w-3" />
            Sketch It
          </Badge>
          <Badge variant="outline" className="gap-1 text-[11px]">
            {templateIcon(sketch.template)}
            {TEMPLATE_LABELS[sketch.template]}
          </Badge>
        </div>
        <h3 className="text-sm font-semibold leading-snug">{sketch.title || "Visual explanation"}</h3>
        <p className="text-sm leading-relaxed text-muted-foreground">{sketch.explanation}</p>
      </div>

      <div className="overflow-hidden rounded-xl border bg-white text-slate-950 shadow-sm">
        <div className="border-b bg-slate-50 px-3 py-2 text-[11px] font-semibold uppercase tracking-wide text-slate-500">
          Working sketch
        </div>
        <div className="relative aspect-video bg-white">
          <SketchScene template={sketch.template} title={sketch.title} labels={labels} />
        </div>
      </div>

      <div className="rounded-xl border-2 border-dashed border-foreground/20 bg-white p-3 text-slate-950">
        <div className="mb-2 flex items-center gap-2 text-xs font-semibold uppercase tracking-wide text-slate-500">
          <Lightbulb className="h-3.5 w-3.5 text-amber-500" />
          Visual metaphor
        </div>
        <p className="text-sm leading-relaxed">{sketch.visual_metaphor}</p>
        {sketch.composition && (
          <p className="mt-2 text-xs leading-relaxed text-slate-600">{sketch.composition}</p>
        )}
      </div>

      {steps.length > 0 && (
        <div className="space-y-1.5">
          {steps.map((step, index) => (
            <div key={`${step}-${index}`} className="rounded-lg border bg-card px-2.5 py-1.5 text-[11px] leading-snug">
              <span className="font-semibold text-orange-600">{index + 1}.</span>{" "}
              {step}
            </div>
          ))}
        </div>
      )}

      {sketch.check_question && (
        <div className="rounded-lg bg-primary/10 px-3 py-2 text-xs">
          <span className="font-semibold">Check yourself: </span>
          {sketch.check_question}
        </div>
      )}

      {sketch.image_prompt && (
        <details className="rounded-lg border bg-muted/40 px-3 py-2 text-xs">
          <summary className="cursor-pointer font-medium text-muted-foreground">Image generation prompt</summary>
          <p className="mt-2 whitespace-pre-wrap leading-relaxed text-muted-foreground">{sketch.image_prompt}</p>
        </details>
      )}
    </div>
  );
}

function SketchScene({
  template,
  title,
  labels,
}: {
  template: SketchTemplate;
  title: string;
  labels: string[];
}) {
  const safeLabels = labels.length ? labels : ["idea", "change", "result"];
  if (template === "system") return <SystemScene title={title} labels={safeLabels} />;
  if (template === "compare") return <CompareScene title={title} labels={safeLabels} />;
  if (template === "timeline") return <TimelineScene title={title} labels={safeLabels} />;
  if (template === "cause_effect") return <CauseEffectScene title={title} labels={safeLabels} />;
  return <ProcessScene title={title} labels={safeLabels} />;
}

function ProcessScene({ title, labels }: { title: string; labels: string[] }) {
  const items = fillLabels(labels, ["input", "change", "output", "feedback"], 4);
  const xs = [92, 246, 400, 554];

  return (
    <BaseSvg title={title}>
      <path className="animate-sketch-flow" d="M142 180 L196 180 M296 180 L350 180 M450 180 L504 180" stroke="#f97316" strokeWidth="4" strokeLinecap="round" strokeDasharray="8 8" markerEnd="url(#sketch-arrow)" />
      {items.map((label, index) => (
        <g key={`${label}-${index}`} className="animate-sketch-pop" style={{ animationDelay: `${index * 160}ms` }}>
          <rect x={xs[index] - 52} y="132" width="104" height="78" rx="16" fill={index === 1 ? "#fff7ed" : "#ffffff"} stroke="#111827" strokeWidth="3" />
          <text x={xs[index]} y="174" textAnchor="middle" className="fill-slate-900 text-[13px] font-bold">
            {truncate(label, 16)}
          </text>
        </g>
      ))}
      <HelperFigure x={80} y={264} />
    </BaseSvg>
  );
}

function CauseEffectScene({ title, labels }: { title: string; labels: string[] }) {
  const items = fillLabels(labels, ["cause", "action", "effect"], 3);

  return (
    <BaseSvg title={title}>
      <rect x="52" y="124" width="148" height="92" rx="18" fill="#fff7ed" stroke="#111827" strokeWidth="3" />
      <rect x="440" y="124" width="148" height="92" rx="18" fill="#eff6ff" stroke="#111827" strokeWidth="3" />
      <circle cx="320" cy="170" r="52" fill="#ffffff" stroke="#111827" strokeWidth="3" />
      <path className="animate-sketch-flow" d="M204 170 C244 126, 278 126, 304 154" fill="none" stroke="#f97316" strokeWidth="4" strokeLinecap="round" strokeDasharray="8 8" markerEnd="url(#sketch-arrow)" />
      <path className="animate-sketch-flow" d="M336 154 C370 126, 404 126, 436 168" fill="none" stroke="#f97316" strokeWidth="4" strokeLinecap="round" strokeDasharray="8 8" markerEnd="url(#sketch-arrow)" />
      <text x="126" y="164" textAnchor="middle" className="fill-slate-900 text-[14px] font-bold">{truncate(items[0], 18)}</text>
      <text x="320" y="164" textAnchor="middle" className="fill-orange-600 text-[14px] font-bold">{truncate(items[1], 18)}</text>
      <text x="514" y="164" textAnchor="middle" className="fill-slate-900 text-[14px] font-bold">{truncate(items[2], 18)}</text>
      <text x="320" y="186" textAnchor="middle" className="fill-slate-500 text-[11px] font-semibold">change</text>
      <HelperFigure x={308} y={284} />
    </BaseSvg>
  );
}

function SystemScene({ title, labels }: { title: string; labels: string[] }) {
  const items = fillLabels(labels, ["part", "signal", "resource", "result"], 4);
  const nodes = [
    { x: 320, y: 78, color: "#fff7ed" },
    { x: 504, y: 176, color: "#eff6ff" },
    { x: 320, y: 272, color: "#fef2f2" },
    { x: 136, y: 176, color: "#f8fafc" },
  ];

  return (
    <BaseSvg title={title}>
      <circle cx="320" cy="176" r="58" fill="#ffffff" stroke="#111827" strokeWidth="4" />
      <text x="320" y="171" textAnchor="middle" className="fill-slate-900 text-[14px] font-bold">{truncate(title, 18)}</text>
      <text x="320" y="190" textAnchor="middle" className="fill-slate-500 text-[11px] font-semibold">system</text>
      {nodes.map((node, index) => (
        <g key={items[index]} className="animate-sketch-pop" style={{ animationDelay: `${index * 160}ms` }}>
          <path d={`M320 176 L${node.x} ${node.y}`} stroke="#f97316" strokeWidth="3" strokeLinecap="round" strokeDasharray="6 8" />
          <rect x={node.x - 56} y={node.y - 22} width="112" height="44" rx="18" fill={node.color} stroke="#111827" strokeWidth="3" />
          <text x={node.x} y={node.y + 5} textAnchor="middle" className="fill-slate-900 text-[12px] font-bold">{truncate(items[index], 16)}</text>
        </g>
      ))}
      <HelperFigure x={76} y={292} />
    </BaseSvg>
  );
}

function CompareScene({ title, labels }: { title: string; labels: string[] }) {
  const items = fillLabels(labels, ["before", "after", "problem", "improvement"], 4);

  return (
    <BaseSvg title={title}>
      <rect x="60" y="96" width="220" height="154" rx="22" fill="#fef2f2" stroke="#111827" strokeWidth="3" />
      <rect x="360" y="96" width="220" height="154" rx="22" fill="#eff6ff" stroke="#111827" strokeWidth="3" />
      <path className="animate-sketch-flow" d="M288 174 L352 174" stroke="#f97316" strokeWidth="5" strokeLinecap="round" strokeDasharray="8 8" markerEnd="url(#sketch-arrow)" />
      <text x="170" y="130" textAnchor="middle" className="fill-red-600 text-[13px] font-bold">{truncate(items[0], 18)}</text>
      <text x="470" y="130" textAnchor="middle" className="fill-blue-600 text-[13px] font-bold">{truncate(items[1], 18)}</text>
      <text x="170" y="184" textAnchor="middle" className="fill-slate-900 text-[14px] font-bold">{truncate(items[2], 18)}</text>
      <text x="470" y="184" textAnchor="middle" className="fill-slate-900 text-[14px] font-bold">{truncate(items[3], 18)}</text>
      <HelperFigure x={304} y={296} />
    </BaseSvg>
  );
}

function TimelineScene({ title, labels }: { title: string; labels: string[] }) {
  const items = fillLabels(labels, ["start", "middle", "turn", "finish"], 4);
  const xs = [116, 244, 372, 500];

  return (
    <BaseSvg title={title}>
      <path d="M82 178 L548 178" stroke="#111827" strokeWidth="4" strokeLinecap="round" />
      <path className="animate-sketch-flow" d="M84 178 L548 178" stroke="#f97316" strokeWidth="3" strokeLinecap="round" strokeDasharray="12 14" markerEnd="url(#sketch-arrow)" />
      {items.map((label, index) => (
        <g key={`${label}-${index}`} className="animate-sketch-pop" style={{ animationDelay: `${index * 160}ms` }}>
          <circle cx={xs[index]} cy="178" r="18" fill={index === 0 ? "#fff7ed" : "#ffffff"} stroke="#111827" strokeWidth="3" />
          <rect x={xs[index] - 54} y={index % 2 === 0 ? 104 : 220} width="108" height="40" rx="16" fill="#ffffff" stroke="#111827" strokeWidth="3" />
          <text x={xs[index]} y={index % 2 === 0 ? 129 : 245} textAnchor="middle" className="fill-slate-900 text-[12px] font-bold">
            {truncate(label, 15)}
          </text>
        </g>
      ))}
      <HelperFigure x={70} y={292} />
    </BaseSvg>
  );
}

function BaseSvg({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <svg className="absolute inset-0 h-full w-full" viewBox="0 0 640 360" role="img" aria-label={`Animated sketch for ${title}`}>
      <defs>
        <marker id="sketch-arrow" markerWidth="10" markerHeight="10" refX="8" refY="3" orient="auto" markerUnits="strokeWidth">
          <path d="M0,0 L0,6 L9,3 z" fill="#f97316" />
        </marker>
      </defs>
      <path d="M44 306 C190 292, 416 292, 596 306" fill="none" stroke="#111827" strokeWidth="3" strokeLinecap="round" />
      {children}
    </svg>
  );
}

function HelperFigure({ x, y }: { x: number; y: number }) {
  return (
    <g className="animate-sketch-helper" transform={`translate(${x} ${y})`}>
      <circle cx="0" cy="-32" r="14" fill="#111827" />
      <circle cx="5" cy="-35" r="2" fill="#ffffff" />
      <path d="M-12 -10 C-4 -20, 6 -20, 16 -10" fill="none" stroke="#111827" strokeWidth="5" strokeLinecap="round" />
      <path d="M10 -34 L54 -62" fill="none" stroke="#111827" strokeWidth="4" strokeLinecap="round" />
      <path d="M48 -62 L60 -66 L56 -54" fill="none" stroke="#111827" strokeWidth="4" strokeLinecap="round" strokeLinejoin="round" />
    </g>
  );
}

function templateIcon(template: SketchTemplate) {
  if (template === "system") return <Network className="h-3 w-3" />;
  if (template === "compare") return <GitCompare className="h-3 w-3" />;
  if (template === "timeline") return <Clock3 className="h-3 w-3" />;
  if (template === "cause_effect") return <ArrowRight className="h-3 w-3" />;
  return <Workflow className="h-3 w-3" />;
}

function cleanList(items: string[] | undefined, max: number, textMax: number) {
  const seen = new Set<string>();
  return (items ?? [])
    .map((item) => truncate(String(item ?? "").replace(/\s+/g, " ").trim(), textMax))
    .filter((item) => {
      const key = item.toLowerCase();
      if (!item || seen.has(key)) return false;
      seen.add(key);
      return true;
    })
    .slice(0, max);
}

function fillLabels(labels: string[], fallback: string[], count: number) {
  const filled = [...labels];
  fallback.forEach((item) => {
    if (filled.length < count) filled.push(item);
  });
  return filled.slice(0, count);
}

function truncate(text: string, maxLength: number) {
  const clean = text.replace(/\s+/g, " ").trim();
  return clean.length > maxLength ? `${clean.slice(0, maxLength - 3).trim()}...` : clean;
}
