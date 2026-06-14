import { describe, it, expect, vi, beforeEach } from "vitest";
import { render, screen, fireEvent, waitFor } from "@testing-library/react";

const h = vi.hoisted(() => ({ invoke: (..._args: any[]) => Promise.resolve({ data: null, error: null }) as any }));
vi.mock("@/integrations/supabase/client", () => ({
  supabase: { functions: { invoke: (...args: any[]) => h.invoke(...args) } },
}));

import { AiPracticeQuestionDialog } from "./AiPracticeQuestionDialog";

const SAMPLE = {
  questions: [
    { prompt: "What is 2 + 3?", options: ["4", "5", "6", "7"], correctIndex: 1 },
    { prompt: "Solve x: x + 4 = 10", options: ["4", "5", "6", "14"], correctIndex: 2 },
  ],
};

beforeEach(() => {
  h.invoke = vi.fn().mockResolvedValue({ data: SAMPLE, error: null });
});

function open(onAdd = vi.fn()) {
  render(<AiPracticeQuestionDialog open onClose={vi.fn()} classId="c1" onAdd={onAdd} />);
  return onAdd;
}

describe("AiPracticeQuestionDialog", () => {
  it("generates questions and renders them as selectable candidates", async () => {
    open();
    fireEvent.change(screen.getByPlaceholderText(/Topic/i), { target: { value: "addition" } });
    fireEvent.click(screen.getByRole("button", { name: /Generate/i }));

    expect(await screen.findByText("What is 2 + 3?")).toBeInTheDocument();
    expect(screen.getByText("Solve x: x + 4 = 10")).toBeInTheDocument();
    // invoked the edge function with the class id + topic
    expect(h.invoke).toHaveBeenCalledWith(
      "generate-practice-questions",
      expect.objectContaining({ body: expect.objectContaining({ classId: "c1", topic: "addition" }) }),
    );
  });

  it("adds the selected questions via onAdd (all selected by default)", async () => {
    const onAdd = open();
    fireEvent.change(screen.getByPlaceholderText(/Topic/i), { target: { value: "addition" } });
    fireEvent.click(screen.getByRole("button", { name: /Generate/i }));
    await screen.findByText("What is 2 + 3?");

    fireEvent.click(screen.getByRole("button", { name: /Add 2 to bank/i }));

    await waitFor(() => expect(onAdd).toHaveBeenCalledTimes(1));
    const passed = onAdd.mock.calls[0][0];
    expect(passed).toHaveLength(2);
    expect(passed[0]).toMatchObject({ prompt: "What is 2 + 3?", correctIndex: 1 });
  });

  it("does not surface candidates or call onAdd when generation fails (e.g. function not deployed)", async () => {
    h.invoke = vi.fn().mockResolvedValue({ data: { error: "not deployed" }, error: null });
    const onAdd = open();
    fireEvent.change(screen.getByPlaceholderText(/Topic/i), { target: { value: "addition" } });
    fireEvent.click(screen.getByRole("button", { name: /Generate/i }));

    await waitFor(() => expect(h.invoke).toHaveBeenCalled());
    expect(screen.queryByText("What is 2 + 3?")).not.toBeInTheDocument();
    expect(screen.queryByRole("button", { name: /Add .* to bank/i })).not.toBeInTheDocument();
    expect(onAdd).not.toHaveBeenCalled();
  });
});
