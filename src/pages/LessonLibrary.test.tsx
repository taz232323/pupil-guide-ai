import { describe, it, expect, vi, afterEach } from "vitest";
import { render, screen, fireEvent, act } from "@testing-library/react";

// The page is wrapped in DashboardShell (heavy auth/supabase/router deps). Stub it.
vi.mock("@/components/DashboardShell", () => ({
  DashboardShell: ({ children }: { children: React.ReactNode }) => <div>{children}</div>,
}));

import LessonLibrary from "./LessonLibrary";
import { MATH_IM, SCIENCE_PHET, READING_CLASSICS } from "@/data/oerLibrary";

afterEach(() => {
  vi.unstubAllGlobals();
  vi.restoreAllMocks();
});

// Radix Tabs use automatic activation on focus; .focus() dispatches focusin → onFocus.
function selectTab(name: RegExp) {
  const tab = screen.getByRole("tab", { name });
  act(() => {
    tab.focus();
  });
}

describe("LessonLibrary", () => {
  it("renders the header and three subject tabs", () => {
    render(<LessonLibrary />);
    expect(screen.getByRole("heading", { name: /Lesson Library/i })).toBeInTheDocument();
    expect(screen.getByRole("tab", { name: /Math/i })).toBeInTheDocument();
    expect(screen.getByRole("tab", { name: /Science/i })).toBeInTheDocument();
    expect(screen.getByRole("tab", { name: /Reading/i })).toBeInTheDocument();
  });

  it("shows Illustrative Mathematics curricula linking to im.kendallhunt.com with attribution", () => {
    render(<LessonLibrary />);
    expect(screen.getByText(MATH_IM[0].title)).toBeInTheDocument();
    expect(screen.getByText(/licensed under CC BY 4\.0/i)).toBeInTheDocument();
    const imLink = screen
      .getAllByRole("link")
      .find((a) => a.getAttribute("href")?.includes("im.kendallhunt.com"));
    expect(imLink).toBeTruthy();
  });

  it("switches to the Science tab and lists PhET simulations", async () => {
    render(<LessonLibrary />);
    selectTab(/Science/i);
    expect(await screen.findByText(SCIENCE_PHET[0].name)).toBeInTheDocument();
  });

  it("shows featured Project Gutenberg classics on the Reading tab", async () => {
    render(<LessonLibrary />);
    selectTab(/Reading/i);
    expect(await screen.findByText(READING_CLASSICS[0].title)).toBeInTheDocument();
    expect(await screen.findByText(/Project Gutenberg/i)).toBeInTheDocument();
  });

  it("renders live Gutendex search results on success", async () => {
    const fetchMock = vi.fn().mockResolvedValue({
      ok: true,
      json: async () => ({
        count: 1,
        results: [
          { id: 1661, title: "The Adventures of Sherlock Holmes", authors: [{ name: "Doyle, Arthur Conan" }], formats: {} },
        ],
      }),
    });
    vi.stubGlobal("fetch", fetchMock);

    render(<LessonLibrary />);
    selectTab(/Reading/i);
    const input = await screen.findByPlaceholderText(/public-domain books/i);
    fireEvent.change(input, { target: { value: "sherlock" } });
    fireEvent.submit(input.closest("form")!);

    expect(await screen.findByText(/Doyle, Arthur Conan/i)).toBeInTheDocument();
    expect(fetchMock).toHaveBeenCalledWith(expect.stringContaining("gutendex.com/books?search=sherlock"));
  });

  it("degrades gracefully to the featured shelf when Gutendex is unreachable", async () => {
    vi.stubGlobal("fetch", vi.fn().mockRejectedValue(new Error("Failed to fetch")));

    render(<LessonLibrary />);
    selectTab(/Reading/i);
    const input = await screen.findByPlaceholderText(/public-domain books/i);
    fireEvent.change(input, { target: { value: "sherlock" } });
    fireEvent.submit(input.closest("form")!);

    expect(await screen.findByText(/Search is unavailable/i)).toBeInTheDocument();
    // the curated classics are still available as a fallback
    expect(screen.getByText(READING_CLASSICS[0].title)).toBeInTheDocument();
  });
});
