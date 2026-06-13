/**
 * Curated, commercial-safe Open Educational Resources for the Lesson Library.
 * Licensing verified via deep research (June 2026):
 *  - Illustrative Mathematics First Edition → CC BY 4.0 (commercial OK, attribution required)
 *  - PhET "Historical" HTML5 sims (pre 2026-03-29) → CC BY 4.0 (commercial OK, attribution required)
 *  - Project Gutenberg → US public domain
 * We LINK/EMBED external content (never copy), with required attribution shown in the UI.
 */

// gradeMin/gradeMax use K=0 .. 12, inclusive, for client-side grade filtering.
export type MathEntry = { title: string; grades: string; url: string; gradeMin: number; gradeMax: number };
export type PhetSim = { slug: string; name: string; subject: string; grades: string; gradeMin: number; gradeMax: number };
export type Classic = { id: number; title: string; author: string; emoji: string };

export type GradeBand = { key: string; label: string; min: number; max: number };

export const GRADE_BANDS: GradeBand[] = [
  { key: "all", label: "All grades", min: 0, max: 12 },
  { key: "k-2", label: "K–2", min: 0, max: 2 },
  { key: "3-5", label: "Grades 3–5", min: 3, max: 5 },
  { key: "6-8", label: "Grades 6–8", min: 6, max: 8 },
  { key: "9-12", label: "Grades 9–12", min: 9, max: 12 },
];

/** True if an item's grade range overlaps the selected band ("all" matches everything). */
export function inGradeBand(item: { gradeMin: number; gradeMax: number }, bandKey: string): boolean {
  if (bandKey === "all") return true;
  const b = GRADE_BANDS.find((x) => x.key === bandKey);
  if (!b) return true;
  return item.gradeMax >= b.min && item.gradeMin <= b.max;
}

/** Illustrative Mathematics First Edition (CC BY 4.0) — hosted at im.kendallhunt.com. Verified HTTP 200. */
export const MATH_IM: MathEntry[] = [
  { title: "IM K–5 Math", grades: "Grades K–5", url: "https://im.kendallhunt.com/k5/curriculum.html", gradeMin: 0, gradeMax: 5 },
  { title: "IM 6–8 Math", grades: "Grades 6–8", url: "https://im.kendallhunt.com/MS/index.html", gradeMin: 6, gradeMax: 8 },
  { title: "IM High School Math", grades: "Algebra 1 · Geometry · Algebra 2", url: "https://im.kendallhunt.com/HS/index.html", gradeMin: 9, gradeMax: 12 },
];

export const MATH_ATTRIBUTION =
  "Math lessons are based on IM® K–12 Math (First Edition) authored by Illustrative Mathematics, licensed under CC BY 4.0. Grapheion is not affiliated with or endorsed by Illustrative Mathematics.";

/** PhET Interactive Simulations (CC BY 4.0 historical sims). All slugs verified HTTP 200. */
export const SCIENCE_PHET: PhetSim[] = [
  { slug: "balancing-act", name: "Balancing Act", subject: "Physics", grades: "3–8", gradeMin: 3, gradeMax: 8 },
  { slug: "forces-and-motion-basics", name: "Forces and Motion: Basics", subject: "Physics", grades: "3–8", gradeMin: 3, gradeMax: 8 },
  { slug: "gravity-and-orbits", name: "Gravity and Orbits", subject: "Space & Physics", grades: "6–12", gradeMin: 6, gradeMax: 12 },
  { slug: "projectile-motion", name: "Projectile Motion", subject: "Physics", grades: "9–12", gradeMin: 9, gradeMax: 12 },
  { slug: "wave-on-a-string", name: "Wave on a String", subject: "Physics", grades: "6–12", gradeMin: 6, gradeMax: 12 },
  { slug: "circuit-construction-kit-dc", name: "Circuit Construction Kit: DC", subject: "Physics", grades: "6–12", gradeMin: 6, gradeMax: 12 },
  { slug: "build-an-atom", name: "Build an Atom", subject: "Chemistry", grades: "6–12", gradeMin: 6, gradeMax: 12 },
  { slug: "ph-scale-basics", name: "pH Scale: Basics", subject: "Chemistry", grades: "6–12", gradeMin: 6, gradeMax: 12 },
  { slug: "natural-selection", name: "Natural Selection", subject: "Biology", grades: "9–12", gradeMin: 9, gradeMax: 12 },
  { slug: "graphing-lines", name: "Graphing Lines", subject: "Math", grades: "8–12", gradeMin: 8, gradeMax: 12 },
];

export const phetEmbedUrl = (slug: string) =>
  `https://phet.colorado.edu/sims/html/${slug}/latest/${slug}_en.html`;

export const SCIENCE_ATTRIBUTION =
  "Simulations by PhET Interactive Simulations, University of Colorado Boulder, licensed under CC BY 4.0 (https://phet.colorado.edu).";

/** Project Gutenberg featured classics (US public domain). Read links go to gutenberg.org/ebooks/<id>. */
export const READING_CLASSICS: Classic[] = [
  { id: 74, title: "The Adventures of Tom Sawyer", author: "Mark Twain", emoji: "🏕️" },
  { id: 1342, title: "Pride and Prejudice", author: "Jane Austen", emoji: "💍" },
  { id: 11, title: "Alice's Adventures in Wonderland", author: "Lewis Carroll", emoji: "🐇" },
  { id: 84, title: "Frankenstein", author: "Mary Shelley", emoji: "⚡" },
  { id: 1661, title: "The Adventures of Sherlock Holmes", author: "Arthur Conan Doyle", emoji: "🔍" },
  { id: 2701, title: "Moby Dick", author: "Herman Melville", emoji: "🐋" },
  { id: 1260, title: "Jane Eyre", author: "Charlotte Brontë", emoji: "🔥" },
  { id: 98, title: "A Tale of Two Cities", author: "Charles Dickens", emoji: "⚔️" },
  { id: 345, title: "Dracula", author: "Bram Stoker", emoji: "🦇" },
  { id: 174, title: "The Picture of Dorian Gray", author: "Oscar Wilde", emoji: "🖼️" },
];

export const gutenbergReadUrl = (id: number) => `https://www.gutenberg.org/ebooks/${id}`;

export const READING_ATTRIBUTION =
  "Texts are in the US public domain, provided by Project Gutenberg (gutenberg.org). Search powered by the Gutendex API.";
