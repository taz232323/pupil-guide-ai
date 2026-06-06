export type SketchTemplate = "process" | "cause_effect" | "system" | "compare" | "timeline";

export type SketchPayload = {
  title: string;
  template: SketchTemplate;
  explanation: string;
  visual_metaphor: string;
  composition?: string;
  image_prompt: string;
  labels: string[];
  steps: string[];
  check_question: string;
};

export type StudyBuddyMessage = {
  role: "user" | "assistant";
  content: string;
  kind?: "chat" | "sketch" | "error";
  sketch?: SketchPayload;
};
