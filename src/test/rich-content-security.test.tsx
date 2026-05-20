import { render, screen } from "@testing-library/react";
import { describe, expect, it } from "vitest";
import { RichContent } from "@/components/RichEditor";

describe("RichContent sanitization", () => {
  it("removes active HTML before rendering stored module content", () => {
    const { container } = render(
      <RichContent html={'<p>Safe</p><script>alert(1)</script><img src=x onerror=alert(1)><a href="javascript:alert(1)">bad link</a>'} />,
    );

    expect(container.querySelector("script")).toBeNull();
    expect(container.querySelector("img")).toBeNull();
    expect(screen.getByText("Safe")).toBeInTheDocument();
    expect(screen.getByText("bad link").closest("a")?.getAttribute("href") ?? "").not.toMatch(/^javascript:/i);
  });
});
