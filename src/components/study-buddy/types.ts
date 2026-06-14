export type SketchTemplate =
  | "process"
  | "cause_effect"
  | "system"
  | "compare"
  | "timeline"
  | "science_flow"
  | "science_cycle"
  | "math_number_line"
  | "math_balance"
  | "civics_power_map"
  | "story_arc";

export type SketchVisualObject = {
  type: string;
  label: string;
  role?: string;
};

export type SketchPayload = {
  title: string;
  template: SketchTemplate;
  subject?: string;
  explanation: string;
  visual_metaphor: string;
  composition?: string;
  image_prompt: string;
  labels: string[];
  objects?: SketchVisualObject[];
  steps: string[];
  check_question: string;
};

export type StudyBuddyMessage = {
  role: "user" | "assistant";
  content: string;
  kind?: "chat" | "sketch" | "error";
  sketch?: SketchPayload;
};
