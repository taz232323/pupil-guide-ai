export type SketchTemplate = "process" | "cause_effect" | "system" | "compare" | "timeline";

export type SketchPayload = {
  title: string;
  template: SketchTemplate;
  explanation: string;
  visual_metaphor: string;
  composition: string;
  image_prompt: string;
  labels: string[];
  steps: string[];
  check_question: string;
};

export const SKETCH_TEMPLATES = ["process", "cause_effect", "system", "compare", "timeline"] as const;

export const GRAPHEION_SKETCH_JSON_SCHEMA = `{
  "title": "short concept title",
  "template": "one of: process, cause_effect, system, compare, timeline",
  "explanation": "3-5 sentence student-friendly explanation",
  "visual_metaphor": "plain-language description of the sketch metaphor",
  "composition": "specific canvas plan: main objects, label placement, and information flow",
  "image_prompt": "future image-generation prompt for a simple hand-drawn educational sketch",
  "labels": ["3-5 short concrete labels from the concept"],
  "steps": ["3-4 short animation beats using concrete concept words"],
  "check_question": "one quick question to test understanding"
}`;

export const GRAPHEION_SKETCH_STYLE_GUIDE = `
Create one structured visual explanation for Sketch It mode.

Pick exactly one template:
- process: a sequence, cycle, workflow, or transformation
- cause_effect: one thing creates a change or result
- system: parts interact inside a local system
- compare: before/after, misconception/correction, or two sides
- timeline: events or stages ordered across time

Rules:
- Make the sketch directly about the user's question. Use concrete nouns/actions from the prompt.
- Keep labels short: 3-5 labels, each 1-3 words.
- Keep steps short: 3-4 visible animation beats.
- Avoid generic labels like "idea", "result", "main idea", "question", "start", or repeated title words unless paired with concept-specific words.
- Use a fresh physical metaphor, but keep it understandable for a middle/high school student.
- The image_prompt must describe a 16:9 pure white hand-drawn educational sketch with sparse black linework, orange for main flow, red for warning/result, blue for secondary notes.
- Do not copy, name, or imply the Xiaohei IP. Use an original Grapheion learner/helper if a character is needed.
- Return only valid JSON. No markdown fences. No commentary outside JSON.
`;

export const SKETCH_STYLE_SOURCE_NOTE = `
The sketch style is adapted from the vendored Ian Xiaohei illustration skill notes kept under supabase/functions/_shared/sketch-style for attribution and style reference. Grapheion uses an original learner/helper character and does not copy the Xiaohei IP.
`;

export function buildSketchModePrompt(systemPrompt: string) {
  return `${systemPrompt}

${SKETCH_STYLE_SOURCE_NOTE}

${GRAPHEION_SKETCH_STYLE_GUIDE}

Return ONLY valid JSON matching this schema:
${GRAPHEION_SKETCH_JSON_SCHEMA}`;
}

export function normalizeSketchTemplate(value: unknown): SketchTemplate {
  const raw = String(value ?? "").toLowerCase().trim().replace(/[-\s]+/g, "_");
  if (raw === "cause_effect" || raw === "cause_and_effect") return "cause_effect";
  if (raw === "system" || raw === "local_system") return "system";
  if (raw === "compare" || raw === "contrast" || raw === "before_after") return "compare";
  if (raw === "timeline" || raw === "map_route") return "timeline";
  return "process";
}

export function sanitizeSketchPayload(raw: unknown): SketchPayload | null {
  if (!raw || typeof raw !== "object") return null;
  const data = raw as Record<string, unknown>;
  const title = cleanText(data.title, 80);
  const explanation = cleanText(data.explanation, 700);
  const visualMetaphor = cleanText(data.visual_metaphor, 500);
  const composition = cleanText(data.composition, 700);
  const imagePrompt = cleanText(data.image_prompt ?? data.sketch_prompt, 900);
  const labels = cleanList(data.labels, 5, 36);
  const steps = cleanList(data.steps ?? data.animation_steps, 4, 90);
  const checkQuestion = cleanText(data.check_question, 240);

  if (!title || !explanation || labels.length < 3 || steps.length < 3 || !checkQuestion) {
    return null;
  }

  return {
    title,
    template: normalizeSketchTemplate(data.template ?? data.structure_type),
    explanation,
    visual_metaphor: visualMetaphor || `A simple visual model for ${title}.`,
    composition,
    image_prompt: imagePrompt || `16:9 pure white hand-drawn educational sketch explaining ${title}.`,
    labels,
    steps,
    check_question: checkQuestion,
  };
}

function cleanText(value: unknown, maxLength: number) {
  return String(value ?? "").replace(/\s+/g, " ").trim().slice(0, maxLength);
}

function cleanList(value: unknown, maxItems: number, maxLength: number) {
  if (!Array.isArray(value)) return [];
  const seen = new Set<string>();
  return value
    .map((item) => cleanText(item, maxLength))
    .filter((item) => {
      const key = item.toLowerCase();
      if (!item || seen.has(key)) return false;
      seen.add(key);
      return true;
    })
    .slice(0, maxItems);
}
