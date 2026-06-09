import {
  ArrowRight,
  Atom,
  BookOpen,
  CheckCircle2,
  Clock3,
  GitCompare,
  Landmark,
  Leaf,
  Lightbulb,
  Network,
  Paintbrush,
  Scale,
  Sigma,
  Workflow,
} from "lucide-react";
import { Badge } from "@/components/ui/badge";
import type { SketchPayload, SketchTemplate, SketchVisualObject } from "./types";

const TEMPLATE_LABELS: Record<SketchTemplate, string> = {
  process: "Process",
  cause_effect: "Cause and effect",
  system: "System",
  compare: "Compare",
  timeline: "Timeline",
  science_flow: "Science flow",
  science_cycle: "Science cycle",
  math_number_line: "Number line",
  math_balance: "Equation balance",
  civics_power_map: "Power map",
  story_arc: "Story arc",
};

export function SketchCard({ sketch }: { sketch: SketchPayload }) {
  const labels = cleanList(sketch.labels, 5, 24);
  const objects = cleanObjects(sketch.objects, labels);
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
          {sketch.subject && (
            <Badge variant="secondary" className="text-[11px] capitalize">
              {sketch.subject}
            </Badge>
          )}
        </div>
        <h3 className="text-sm font-semibold leading-snug">{sketch.title || "Visual explanation"}</h3>
        <p className="text-sm leading-relaxed text-muted-foreground">{sketch.explanation}</p>
      </div>

      <div className="overflow-hidden rounded-xl border bg-white text-slate-950 shadow-sm">
        <div className="border-b bg-slate-50 px-3 py-2 text-[11px] font-semibold uppercase tracking-wide text-slate-500">
          Working sketch
        </div>
        <div className="relative aspect-video bg-white">
          <SketchScene template={sketch.template} title={sketch.title} labels={labels} objects={objects} />
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
  objects,
}: {
  template: SketchTemplate;
  title: string;
  labels: string[];
  objects: SketchVisualObject[];
}) {
  const safeLabels = labels.length ? labels : ["idea", "change", "result"];
  if (template === "science_flow") return <ScienceFlowScene title={title} labels={safeLabels} objects={objects} />;
  if (template === "science_cycle") return <ScienceCycleScene title={title} labels={safeLabels} objects={objects} />;
  if (template === "math_number_line") return <MathNumberLineScene title={title} labels={safeLabels} objects={objects} />;
  if (template === "math_balance") return <MathBalanceScene title={title} labels={safeLabels} objects={objects} />;
  if (template === "civics_power_map") return <CivicsPowerMapScene title={title} labels={safeLabels} objects={objects} />;
  if (template === "story_arc") return <StoryArcScene title={title} labels={safeLabels} objects={objects} />;
  if (template === "system") return <SystemScene title={title} labels={safeLabels} />;
  if (template === "compare") return <CompareScene title={title} labels={safeLabels} />;
  if (template === "timeline") return <TimelineScene title={title} labels={safeLabels} />;
  if (template === "cause_effect") return <CauseEffectScene title={title} labels={safeLabels} />;
  return <ProcessScene title={title} labels={safeLabels} />;
}

function ScienceFlowScene({ title, labels, objects }: { title: string; labels: string[]; objects: SketchVisualObject[] }) {
  const items = ensureObjects(objects, labels, ["sun", "leaf", "water", "oxygen", "sugar"]);
  const center = findObject(items, ["leaf", "plant", "cell", "atom", "generic"]) ?? items[1];
  const inputs = pickObjects(items, ["input", "cause", "left"], 2, [items[0], items[2]]);
  const outputs = pickObjects(items, ["output", "effect", "right"], 2, [items[3], items[4]]);

  return (
    <BaseSvg title={title}>
      <path className="animate-sketch-flow" d="M126 120 C190 98, 230 116, 274 150" fill="none" stroke="#f97316" strokeWidth="4" strokeLinecap="round" strokeDasharray="8 8" markerEnd="url(#sketch-arrow)" />
      <path className="animate-sketch-flow" d="M126 228 C190 250, 230 226, 274 194" fill="none" stroke="#3b82f6" strokeWidth="4" strokeLinecap="round" strokeDasharray="8 8" markerEnd="url(#sketch-arrow)" />
      <path className="animate-sketch-flow" d="M366 152 C414 116, 458 100, 520 120" fill="none" stroke="#f97316" strokeWidth="4" strokeLinecap="round" strokeDasharray="8 8" markerEnd="url(#sketch-arrow)" />
      <path className="animate-sketch-flow" d="M366 194 C416 232, 458 250, 520 228" fill="none" stroke="#ef4444" strokeWidth="4" strokeLinecap="round" strokeDasharray="8 8" markerEnd="url(#sketch-arrow)" />

      {inputs.map((item, index) => (
        <ObjectNode key={`input-${item.label}-${index}`} object={item} x={108} y={index === 0 ? 112 : 230} delay={index * 120} />
      ))}

      <g className="animate-sketch-pop" style={{ animationDelay: "220ms" }}>
        <ellipse cx="320" cy="174" rx="68" ry="54" fill="#ecfdf5" stroke="#111827" strokeWidth="4" />
        <ObjectGlyph object={center} x={320} y={164} size={70} />
        <LabelText x={320} y={242} text={center?.label || title} max={18} />
      </g>

      {outputs.map((item, index) => (
        <ObjectNode key={`output-${item.label}-${index}`} object={item} x={532} y={index === 0 ? 112 : 230} delay={420 + index * 120} />
      ))}
      <HelperFigure x={72} y={306} />
    </BaseSvg>
  );
}

function ScienceCycleScene({ title, labels, objects }: { title: string; labels: string[]; objects: SketchVisualObject[] }) {
  const items = ensureObjects(objects, labels, ["stage one", "stage two", "stage three", "stage four"]).slice(0, 4);
  const nodes = [
    { x: 320, y: 82 },
    { x: 504, y: 176 },
    { x: 320, y: 270 },
    { x: 136, y: 176 },
  ];

  return (
    <BaseSvg title={title}>
      <path className="animate-sketch-flow" d="M368 94 C444 104, 498 126, 516 158" fill="none" stroke="#f97316" strokeWidth="4" strokeLinecap="round" strokeDasharray="9 10" markerEnd="url(#sketch-arrow)" />
      <path className="animate-sketch-flow" d="M500 216 C464 252, 412 276, 356 278" fill="none" stroke="#f97316" strokeWidth="4" strokeLinecap="round" strokeDasharray="9 10" markerEnd="url(#sketch-arrow)" />
      <path className="animate-sketch-flow" d="M272 268 C208 252, 152 224, 132 194" fill="none" stroke="#f97316" strokeWidth="4" strokeLinecap="round" strokeDasharray="9 10" markerEnd="url(#sketch-arrow)" />
      <path className="animate-sketch-flow" d="M140 138 C180 100, 234 78, 286 78" fill="none" stroke="#f97316" strokeWidth="4" strokeLinecap="round" strokeDasharray="9 10" markerEnd="url(#sketch-arrow)" />
      <circle cx="320" cy="176" r="58" fill="#ffffff" stroke="#111827" strokeWidth="4" />
      <text x="320" y="171" textAnchor="middle" className="fill-slate-900 text-[14px] font-bold">{truncate(title, 16)}</text>
      <text x="320" y="190" textAnchor="middle" className="fill-slate-500 text-[11px] font-semibold">cycle</text>
      {nodes.map((node, index) => (
        <ObjectNode key={`cycle-${items[index]?.label}-${index}`} object={items[index]} x={node.x} y={node.y} delay={index * 150} compact />
      ))}
    </BaseSvg>
  );
}

function MathNumberLineScene({ title, labels, objects }: { title: string; labels: string[]; objects: SketchVisualObject[] }) {
  const items = ensureObjects(objects, labels, ["0", "1/2", "1"]).slice(0, 3);
  const points = [160, 320, 480];

  return (
    <BaseSvg title={title}>
      <text x="320" y="74" textAnchor="middle" className="fill-slate-900 text-[16px] font-bold">{truncate(title, 26)}</text>
      <path d="M78 186 L562 186" stroke="#111827" strokeWidth="4" strokeLinecap="round" />
      <path d="M548 174 L566 186 L548 198" fill="none" stroke="#111827" strokeWidth="4" strokeLinecap="round" strokeLinejoin="round" />
      {[96, 176, 256, 336, 416, 496].map((x, index) => (
        <g key={`tick-${x}`}>
          <path d={`M${x} 172 L${x} 200`} stroke="#111827" strokeWidth="3" strokeLinecap="round" />
          <text x={x} y="222" textAnchor="middle" className="fill-slate-500 text-[10px] font-semibold">{index - 2}</text>
        </g>
      ))}
      {items.map((item, index) => (
        <g key={`${item.label}-${index}`} className="animate-sketch-pop" style={{ animationDelay: `${index * 170}ms` }}>
          <circle cx={points[index]} cy="186" r="16" fill="#fff7ed" stroke="#111827" strokeWidth="4" />
          <path className="animate-sketch-flow" d={`M${points[index]} 148 L${points[index]} 170`} stroke="#f97316" strokeWidth="4" strokeLinecap="round" markerEnd="url(#sketch-arrow)" />
          <rect x={points[index] - 54} y="100" width="108" height="38" rx="14" fill="#ffffff" stroke="#111827" strokeWidth="3" />
          <LabelText x={points[index]} y={124} text={item.label} max={14} />
        </g>
      ))}
      <HelperFigure x={78} y={304} />
    </BaseSvg>
  );
}

function MathBalanceScene({ title, labels, objects }: { title: string; labels: string[]; objects: SketchVisualObject[] }) {
  const items = ensureObjects(objects, labels, ["left side", "equals", "right side", "variable"]);
  const left = pickObjects(items, ["left", "input"], 2, [items[0], items[3]]);
  const right = pickObjects(items, ["right", "output"], 2, [items[2], items[1]]);

  return (
    <BaseSvg title={title}>
      <text x="320" y="66" textAnchor="middle" className="fill-slate-900 text-[16px] font-bold">{truncate(title, 28)}</text>
      <path d="M320 112 L320 268" stroke="#111827" strokeWidth="5" strokeLinecap="round" />
      <path d="M164 142 L476 142" stroke="#111827" strokeWidth="5" strokeLinecap="round" />
      <path d="M176 142 L132 232 L236 232 Z" fill="#eff6ff" stroke="#111827" strokeWidth="3" />
      <path d="M464 142 L404 232 L508 232 Z" fill="#fff7ed" stroke="#111827" strokeWidth="3" />
      <path className="animate-sketch-flow" d="M250 92 C292 78, 348 78, 390 92" fill="none" stroke="#f97316" strokeWidth="4" strokeDasharray="8 8" strokeLinecap="round" />
      <text x="320" y="103" textAnchor="middle" className="fill-orange-600 text-[14px] font-bold">keep equal</text>
      {left.map((item, index) => (
        <ObjectNode key={`left-${item.label}-${index}`} object={item} x={158 + index * 52} y={210} delay={index * 120} compact />
      ))}
      {right.map((item, index) => (
        <ObjectNode key={`right-${item.label}-${index}`} object={item} x={428 + index * 52} y={210} delay={260 + index * 120} compact />
      ))}
      <HelperFigure x={302} y={306} />
    </BaseSvg>
  );
}

function CivicsPowerMapScene({ title, labels, objects }: { title: string; labels: string[]; objects: SketchVisualObject[] }) {
  const items = ensureObjects(objects, labels, ["people", "vote", "representatives", "law", "court"]);
  const nodes = [
    { x: 98, y: 178, fallbackType: "people" },
    { x: 226, y: 112, fallbackType: "voter" },
    { x: 354, y: 178, fallbackType: "branch" },
    { x: 482, y: 112, fallbackType: "law" },
    { x: 544, y: 238, fallbackType: "court" },
  ];

  return (
    <BaseSvg title={title}>
      <text x="320" y="62" textAnchor="middle" className="fill-slate-900 text-[16px] font-bold">{truncate(title, 28)}</text>
      <path className="animate-sketch-flow" d="M134 170 C166 130, 188 118, 206 114" fill="none" stroke="#f97316" strokeWidth="4" strokeLinecap="round" strokeDasharray="8 8" markerEnd="url(#sketch-arrow)" />
      <path className="animate-sketch-flow" d="M256 124 C292 142, 318 158, 332 168" fill="none" stroke="#f97316" strokeWidth="4" strokeLinecap="round" strokeDasharray="8 8" markerEnd="url(#sketch-arrow)" />
      <path className="animate-sketch-flow" d="M390 166 C428 132, 454 116, 466 112" fill="none" stroke="#f97316" strokeWidth="4" strokeLinecap="round" strokeDasharray="8 8" markerEnd="url(#sketch-arrow)" />
      <path className="animate-sketch-flow" d="M492 150 C520 176, 536 202, 540 214" fill="none" stroke="#3b82f6" strokeWidth="4" strokeLinecap="round" strokeDasharray="8 8" markerEnd="url(#sketch-arrow)" />
      {nodes.map((node, index) => {
        const item = items[index] ?? { type: node.fallbackType, label: node.fallbackType };
        return <ObjectNode key={`civics-${item.label}-${index}`} object={item} x={node.x} y={node.y} delay={index * 130} compact />;
      })}
      <rect x="248" y="232" width="144" height="46" rx="18" fill="#f8fafc" stroke="#111827" strokeWidth="3" />
      <text x="320" y="260" textAnchor="middle" className="fill-slate-900 text-[13px] font-bold">checks power</text>
    </BaseSvg>
  );
}

function StoryArcScene({ title, labels, objects }: { title: string; labels: string[]; objects: SketchVisualObject[] }) {
  const items = ensureObjects(objects, labels, ["setup", "conflict", "climax", "resolution"]).slice(0, 4);
  const nodes = [
    { x: 112, y: 232 },
    { x: 246, y: 164 },
    { x: 360, y: 94 },
    { x: 506, y: 224 },
  ];

  return (
    <BaseSvg title={title}>
      <text x="320" y="62" textAnchor="middle" className="fill-slate-900 text-[16px] font-bold">{truncate(title, 28)}</text>
      <path d="M82 256 C174 226, 220 178, 278 120 C318 80, 356 76, 386 112 C430 166, 470 214, 548 236" fill="none" stroke="#111827" strokeWidth="4" strokeLinecap="round" />
      <path className="animate-sketch-flow" d="M86 256 C176 226, 224 176, 278 120 C318 80, 356 76, 386 112 C430 166, 470 214, 548 236" fill="none" stroke="#f97316" strokeWidth="4" strokeDasharray="10 12" strokeLinecap="round" markerEnd="url(#sketch-arrow)" />
      {nodes.map((node, index) => (
        <g key={`story-${items[index]?.label}-${index}`} className="animate-sketch-pop" style={{ animationDelay: `${index * 150}ms` }}>
          <circle cx={node.x} cy={node.y} r="15" fill={index === 2 ? "#fef2f2" : "#ffffff"} stroke="#111827" strokeWidth="3" />
          <rect x={node.x - 56} y={node.y + 26} width="112" height="38" rx="14" fill="#ffffff" stroke="#111827" strokeWidth="3" />
          <LabelText x={node.x} y={node.y + 50} text={items[index]?.label ?? ""} max={15} />
        </g>
      ))}
      <HelperFigure x={72} y={304} />
    </BaseSvg>
  );
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

function ObjectNode({
  object,
  x,
  y,
  delay = 0,
  compact = false,
}: {
  object?: SketchVisualObject;
  x: number;
  y: number;
  delay?: number;
  compact?: boolean;
}) {
  const item = object ?? { type: "generic", label: "idea" };
  const boxWidth = compact ? 104 : 118;
  const boxHeight = compact ? 74 : 86;
  const glyphSize = compact ? 38 : 46;

  return (
    <g className="animate-sketch-pop" style={{ animationDelay: `${delay}ms` }}>
      <rect
        x={x - boxWidth / 2}
        y={y - boxHeight / 2}
        width={boxWidth}
        height={boxHeight}
        rx="18"
        fill="#ffffff"
        stroke="#111827"
        strokeWidth="3"
      />
      <ObjectGlyph object={item} x={x} y={y - 12} size={glyphSize} />
      <LabelText x={x} y={y + boxHeight / 2 - 13} text={item.label} max={compact ? 13 : 15} />
    </g>
  );
}

function ObjectGlyph({ object, x, y, size = 44 }: { object?: SketchVisualObject; x: number; y: number; size?: number }) {
  const type = inferObjectType(object);
  const s = size / 44;

  if (type === "sun" || type === "light") {
    return (
      <g transform={`translate(${x} ${y}) scale(${s})`}>
        <circle cx="0" cy="0" r="13" fill="#fbbf24" stroke="#111827" strokeWidth="3" />
        {Array.from({ length: 8 }).map((_, index) => {
          const angle = (Math.PI * 2 * index) / 8;
          const x1 = Math.cos(angle) * 19;
          const y1 = Math.sin(angle) * 19;
          const x2 = Math.cos(angle) * 26;
          const y2 = Math.sin(angle) * 26;
          return <path key={index} d={`M${x1} ${y1} L${x2} ${y2}`} stroke="#111827" strokeWidth="3" strokeLinecap="round" />;
        })}
      </g>
    );
  }

  if (type === "leaf" || type === "plant" || type === "chloroplast") {
    return (
      <g transform={`translate(${x} ${y}) scale(${s})`}>
        <path d="M-20 6 C-12 -22, 16 -24, 24 -2 C10 18, -10 20, -20 6 Z" fill="#bbf7d0" stroke="#111827" strokeWidth="3" />
        <path d="M-14 8 C-4 2, 8 -4, 20 -12" fill="none" stroke="#16a34a" strokeWidth="3" strokeLinecap="round" />
      </g>
    );
  }

  if (type === "water") {
    return (
      <g transform={`translate(${x} ${y}) scale(${s})`}>
        <path d="M0 -24 C12 -8, 18 2, 18 12 C18 25, 8 32, 0 32 C-8 32, -18 25, -18 12 C-18 2, -12 -8, 0 -24 Z" fill="#bfdbfe" stroke="#111827" strokeWidth="3" />
      </g>
    );
  }

  if (type === "gas" || type === "oxygen" || type === "carbon_dioxide" || type === "co2") {
    return (
      <g transform={`translate(${x} ${y}) scale(${s})`}>
        <circle cx="-12" cy="4" r="12" fill="#e0f2fe" stroke="#111827" strokeWidth="3" />
        <circle cx="6" cy="-4" r="13" fill="#e0f2fe" stroke="#111827" strokeWidth="3" />
        <circle cx="18" cy="9" r="10" fill="#e0f2fe" stroke="#111827" strokeWidth="3" />
      </g>
    );
  }

  if (type === "sugar" || type === "glucose" || type === "atom" || type === "molecule") {
    return (
      <g transform={`translate(${x} ${y}) scale(${s})`}>
        <path d="M0 -24 L22 -12 L22 12 L0 24 L-22 12 L-22 -12 Z" fill="#fff7ed" stroke="#111827" strokeWidth="3" />
        <circle cx="0" cy="0" r="5" fill="#f97316" />
      </g>
    );
  }

  if (type === "cell") {
    return (
      <g transform={`translate(${x} ${y}) scale(${s})`}>
        <ellipse cx="0" cy="0" rx="28" ry="20" fill="#f0fdf4" stroke="#111827" strokeWidth="3" />
        <circle cx="-2" cy="0" r="8" fill="#bbf7d0" stroke="#111827" strokeWidth="2" />
      </g>
    );
  }

  if (type === "force") {
    return (
      <g transform={`translate(${x} ${y}) scale(${s})`}>
        <path d="M-26 6 L14 6" stroke="#f97316" strokeWidth="7" strokeLinecap="round" />
        <path d="M10 -10 L28 6 L10 22" fill="none" stroke="#111827" strokeWidth="4" strokeLinecap="round" strokeLinejoin="round" />
      </g>
    );
  }

  if (type === "number" || type === "variable" || type === "fraction" || type === "point" || type === "equation") {
    const symbol = type === "variable" ? "x" : type === "fraction" ? "1/2" : type === "equation" ? "=" : "#";
    return (
      <g transform={`translate(${x} ${y}) scale(${s})`}>
        <rect x="-26" y="-22" width="52" height="44" rx="14" fill="#eff6ff" stroke="#111827" strokeWidth="3" />
        <text x="0" y="8" textAnchor="middle" className="fill-slate-900 text-[22px] font-bold">{symbol}</text>
      </g>
    );
  }

  if (type === "voter" || type === "people" || type === "person") {
    return (
      <g transform={`translate(${x} ${y}) scale(${s})`}>
        <circle cx="-10" cy="-10" r="9" fill="#111827" />
        <circle cx="12" cy="-10" r="9" fill="#111827" />
        <path d="M-24 20 C-18 4, -4 4, 2 20" fill="none" stroke="#111827" strokeWidth="5" strokeLinecap="round" />
        <path d="M0 20 C6 4, 20 4, 26 20" fill="none" stroke="#111827" strokeWidth="5" strokeLinecap="round" />
      </g>
    );
  }

  if (type === "branch" || type === "government" || type === "court") {
    return (
      <g transform={`translate(${x} ${y}) scale(${s})`}>
        <path d="M-26 -8 L0 -24 L26 -8 Z" fill="#f8fafc" stroke="#111827" strokeWidth="3" />
        <path d="M-22 18 L22 18" stroke="#111827" strokeWidth="4" strokeLinecap="round" />
        {[-14, 0, 14].map((col) => (
          <path key={col} d={`M${col} -4 L${col} 18`} stroke="#111827" strokeWidth="4" strokeLinecap="round" />
        ))}
      </g>
    );
  }

  if (type === "law" || type === "rights" || type === "evidence" || type === "claim") {
    return (
      <g transform={`translate(${x} ${y}) scale(${s})`}>
        <path d="M-20 -24 H12 L24 -12 V26 H-20 Z" fill="#ffffff" stroke="#111827" strokeWidth="3" strokeLinejoin="round" />
        <path d="M12 -24 V-12 H24" fill="none" stroke="#111827" strokeWidth="3" strokeLinejoin="round" />
        <path d="M-10 -4 H12 M-10 8 H14" stroke="#3b82f6" strokeWidth="3" strokeLinecap="round" />
      </g>
    );
  }

  if (type === "book" || type === "story" || type === "conflict" || type === "theme") {
    return (
      <g transform={`translate(${x} ${y}) scale(${s})`}>
        <path d="M-28 -20 H-2 C8 -20, 14 -16, 14 -8 V24 C8 18, 0 16, -10 16 H-28 Z" fill="#eff6ff" stroke="#111827" strokeWidth="3" />
        <path d="M28 -20 H2 C-8 -20, -14 -16, -14 -8 V24 C-8 18, 0 16, 10 16 H28 Z" fill="#fff7ed" stroke="#111827" strokeWidth="3" />
      </g>
    );
  }

  return (
    <g transform={`translate(${x} ${y}) scale(${s})`}>
      <circle cx="0" cy="0" r="22" fill="#ffffff" stroke="#111827" strokeWidth="3" />
      <path d="M-10 0 H10 M0 -10 V10" stroke="#f97316" strokeWidth="4" strokeLinecap="round" />
    </g>
  );
}

function LabelText({ x, y, text, max }: { x: number; y: number; text: string; max: number }) {
  return (
    <text x={x} y={y} textAnchor="middle" className="fill-slate-900 text-[12px] font-bold">
      {truncate(text, max)}
    </text>
  );
}

function templateIcon(template: SketchTemplate) {
  if (template === "science_flow" || template === "science_cycle") return template === "science_flow" ? <Leaf className="h-3 w-3" /> : <Atom className="h-3 w-3" />;
  if (template === "math_number_line") return <Sigma className="h-3 w-3" />;
  if (template === "math_balance") return <Scale className="h-3 w-3" />;
  if (template === "civics_power_map") return <Landmark className="h-3 w-3" />;
  if (template === "story_arc") return <BookOpen className="h-3 w-3" />;
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

function cleanObjects(items: SketchVisualObject[] | undefined, fallbackLabels: string[]) {
  const seen = new Set<string>();
  const objects = (items ?? [])
    .map((item) => ({
      type: normalizeObjectType(item.type),
      label: truncate(String(item.label ?? "").replace(/\s+/g, " ").trim(), 30),
      role: item.role ? normalizeObjectType(item.role) : undefined,
    }))
    .filter((item) => {
      const key = `${item.type}:${item.label}`.toLowerCase();
      if (!item.label || seen.has(key)) return false;
      seen.add(key);
      return true;
    })
    .slice(0, 6);

  if (objects.length) return objects;
  return fallbackLabels.slice(0, 5).map((label) => ({
    type: inferTypeFromLabel(label),
    label,
  }));
}

function ensureObjects(objects: SketchVisualObject[], labels: string[], fallbackLabels: string[]) {
  const items = objects.length
    ? [...objects]
    : labels.map((label) => ({ type: inferTypeFromLabel(label), label }));
  fallbackLabels.forEach((label) => {
    if (items.length < fallbackLabels.length) {
      items.push({ type: inferTypeFromLabel(label), label });
    }
  });
  return items;
}

function pickObjects(
  objects: SketchVisualObject[],
  roles: string[],
  count: number,
  fallback: Array<SketchVisualObject | undefined>,
) {
  const byRole = objects.filter((object) => object.role && roles.includes(normalizeObjectType(object.role)));
  const result = byRole.length ? byRole : fallback.filter(Boolean) as SketchVisualObject[];
  return result.slice(0, count);
}

function findObject(objects: SketchVisualObject[], types: string[]) {
  return objects.find((object) => types.includes(inferObjectType(object)));
}

function inferObjectType(object?: SketchVisualObject): string {
  const raw = normalizeObjectType(`${object?.type ?? ""} ${object?.label ?? ""}`);
  if (/\bsun|sunlight|light|solar\b/.test(raw)) return "sun";
  if (/\bleaf|plant|chloroplast|tree\b/.test(raw)) return "leaf";
  if (/\bwater|h2o|rain|drop\b/.test(raw)) return "water";
  if (/\boxygen|o2\b/.test(raw)) return "oxygen";
  if (/\bcarbon|co2|gas|air\b/.test(raw)) return "gas";
  if (/\bglucose|sugar|molecule\b/.test(raw)) return "sugar";
  if (/\bcell|nucleus|membrane\b/.test(raw)) return "cell";
  if (/\bforce|push|pull|gravity|friction\b/.test(raw)) return "force";
  if (/\batom|electron|proton|neutron\b/.test(raw)) return "atom";
  if (/\bvariable|unknown|x\b/.test(raw)) return "variable";
  if (/\bfraction|ratio|half|third\b/.test(raw)) return "fraction";
  if (/\bequation|equals|equal\b/.test(raw)) return "equation";
  if (/\bnumber|point|coordinate|integer\b/.test(raw)) return "number";
  if (/\bvoter|vote|ballot\b/.test(raw)) return "voter";
  if (/\bpeople|citizen|person|public\b/.test(raw)) return "people";
  if (/\bbranch|government|congress|executive|legislative\b/.test(raw)) return "branch";
  if (/\bcourt|judicial|judge\b/.test(raw)) return "court";
  if (/\blaw|rule|rights|amendment|constitution\b/.test(raw)) return "law";
  if (/\bclaim|evidence|reason|document|quote\b/.test(raw)) return "evidence";
  if (/\bbook|story|plot|theme|character|conflict|climax\b/.test(raw)) return "book";
  return "generic";
}

function inferTypeFromLabel(label: string) {
  return inferObjectType({ type: "generic", label });
}

function normalizeObjectType(value: string | undefined): string {
  return String(value ?? "")
    .toLowerCase()
    .replace(/[^a-z0-9_ -]/g, "")
    .replace(/[-\s]+/g, "_")
    .trim();
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
