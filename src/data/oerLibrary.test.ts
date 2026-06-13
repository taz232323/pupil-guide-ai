import { describe, it, expect } from "vitest";
import {
  MATH_IM, SCIENCE_PHET, READING_CLASSICS,
  phetEmbedUrl, gutenbergReadUrl,
  MATH_ATTRIBUTION, SCIENCE_ATTRIBUTION, READING_ATTRIBUTION,
  GRADE_BANDS, inGradeBand,
} from "./oerLibrary";

describe("oerLibrary catalog integrity", () => {
  it("has content in every subject", () => {
    expect(MATH_IM.length).toBeGreaterThan(0);
    expect(SCIENCE_PHET.length).toBeGreaterThanOrEqual(8);
    expect(READING_CLASSICS.length).toBeGreaterThanOrEqual(8);
  });

  it("only links Illustrative Mathematics to https im.kendallhunt.com (commercial-safe First Edition)", () => {
    for (const m of MATH_IM) {
      expect(m.url).toMatch(/^https:\/\/im\.kendallhunt\.com\//);
      expect(m.title.trim()).not.toHaveLength(0);
      expect(m.grades.trim()).not.toHaveLength(0);
    }
  });

  it("builds correct PhET embed URLs and has unique slugs", () => {
    const slugs = SCIENCE_PHET.map((s) => s.slug);
    expect(new Set(slugs).size).toBe(slugs.length); // no duplicates
    for (const s of SCIENCE_PHET) {
      expect(s.slug).toMatch(/^[a-z0-9-]+$/);
      expect(phetEmbedUrl(s.slug)).toBe(
        `https://phet.colorado.edu/sims/html/${s.slug}/latest/${s.slug}_en.html`,
      );
    }
  });

  it("builds correct Project Gutenberg read URLs and has unique book ids", () => {
    const ids = READING_CLASSICS.map((c) => c.id);
    expect(new Set(ids).size).toBe(ids.length); // no duplicates
    for (const c of READING_CLASSICS) {
      expect(Number.isInteger(c.id)).toBe(true);
      expect(c.id).toBeGreaterThan(0);
      expect(gutenbergReadUrl(c.id)).toBe(`https://www.gutenberg.org/ebooks/${c.id}`);
      expect(c.title.trim()).not.toHaveLength(0);
    }
  });

  it("gives every Math and Science item a valid grade range (0–12, min ≤ max)", () => {
    for (const item of [...MATH_IM, ...SCIENCE_PHET]) {
      expect(item.gradeMin).toBeGreaterThanOrEqual(0);
      expect(item.gradeMax).toBeLessThanOrEqual(12);
      expect(item.gradeMin).toBeLessThanOrEqual(item.gradeMax);
    }
  });

  it("filters by grade band correctly via inGradeBand", () => {
    const k5 = MATH_IM.find((m) => m.title.includes("K–5"))!;
    const hs = MATH_IM.find((m) => m.title.includes("High School"))!;
    // "all" matches everything
    expect(inGradeBand(k5, "all")).toBe(true);
    expect(inGradeBand(hs, "all")).toBe(true);
    // K–5 overlaps K–2 and 3–5 but not 9–12
    expect(inGradeBand(k5, "k-2")).toBe(true);
    expect(inGradeBand(k5, "3-5")).toBe(true);
    expect(inGradeBand(k5, "9-12")).toBe(false);
    // High School overlaps 9–12 but not K–2
    expect(inGradeBand(hs, "9-12")).toBe(true);
    expect(inGradeBand(hs, "k-2")).toBe(false);
    // every grade band has at least one Math or Science lesson
    for (const band of GRADE_BANDS) {
      const any = [...MATH_IM, ...SCIENCE_PHET].some((i) => inGradeBand(i, band.key));
      expect(any).toBe(true);
    }
  });

  it("includes the required attributions for each CC-licensed / public-domain source", () => {
    expect(MATH_ATTRIBUTION).toMatch(/Illustrative Mathematics/);
    expect(MATH_ATTRIBUTION).toMatch(/CC BY 4\.0/);
    expect(SCIENCE_ATTRIBUTION).toMatch(/PhET/);
    expect(SCIENCE_ATTRIBUTION).toMatch(/CC BY 4\.0/);
    expect(READING_ATTRIBUTION).toMatch(/Project Gutenberg/);
  });
});
