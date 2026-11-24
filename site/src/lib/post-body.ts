// Splits a rendered post body into the parts the post templates lay out in their own sections.

export interface Chunk {
  id: string;
  title: string;
  html: string;
}

export interface ProductionBody {
  /** The story of the show: the lead plus its plot, concept or play chunk, images and galleries removed. */
  narrative: string;
  /** Longer notes (short plays, a program's write-up, a cast list), headings set under the section's h2. */
  notes: Chunk[];
}

const tags = (s: string) => s.replace(/<[^>]+>/g, '');
export const words = (html: string) => tags(html).split(/\s+/).filter(Boolean).length;

const GALLERY = /<div data-gallery[^>]*>[\s\S]*?<\/div>/g;
const VIDEO = /(?:<p><strong>[^<]*<\/strong><\/p>\s*)?<div data-video[^>]*>[\s\S]*?<\/iframe><\/div>/g;
const LONE_IMG = /<p>\s*<img\b[^>]*>\s*<\/p>/g;
const CREDIT = /<p>Photos from the [\s\S]*?<\/p>/g;
const EMPTY_P = /<p>\s*<\/p>/g;

export const stripMedia = (html: string) =>
  html.replace(GALLERY, '').replace(VIDEO, '').replace(CREDIT, '').replace(EMPTY_P, '').trim();
export const stripImages = (html: string) => stripMedia(html).replace(LONE_IMG, '').trim();

/** The lead (before the first h1) and one chunk per h1. */
export function splitBody(html: string): { lead: string; chunks: Chunk[] } {
  let lead = '';
  const chunks: Chunk[] = [];
  for (const part of html.split(/(?=<h1 id=")/)) {
    const m = /^<h1 id="([^"]*)">([\s\S]*?)<\/h1>/.exec(part);
    if (m) chunks.push({ id: m[1], title: tags(m[2]).trim(), html: part.slice(m[0].length) });
    else lead += part;
  }
  return { lead, chunks };
}

const DETAILS = /^(production|program)-details?$/;
const STORY = ['plot', 'concept', 'the-play', 'process'];
const DROP = ['videos', 'photos'];

/** Shifts the headings of a chunk so its highest one becomes `top` (an h3 under the section's h2, an
    h4 under a chunk title), so the levels go down one at a time whatever the post wrote. */
export function demote(html: string, top: number): string {
  const levels = [...html.matchAll(/<h([1-6])\b/g)].map((m) => +m[1]);
  if (!levels.length) return html;
  const by = top - Math.min(...levels);
  return html.replace(/<(\/?)h([1-6])\b/g, (_, slash: string, n: string) => `<${slash}h${Math.min(6, +n + by)}`);
}

export function productionBody(html: string): ProductionBody {
  const { lead, chunks } = splitBody(html);
  const story = chunks.filter((c) => STORY.includes(c.id));
  const narrative = [lead, ...story.map((c) => c.html)].map(stripImages).filter(Boolean).join('\n');
  const notes = chunks
    .filter((c) => !DETAILS.test(c.id) && !STORY.includes(c.id) && !DROP.includes(c.id))
    // A role list says what the spec rows already say; a role written up stays.
    .filter((c) => c.id !== 'my-role' || words(c.html) > 60)
    .map((c) => ({ ...c, html: stripMedia(c.html) }))
    .filter((c) => words(c.html) > 0 || /<img\b/.test(c.html));
  // One chunk: the section's h2 is its title. Several: each title is an h3 and its own headings go under it.
  for (const c of notes) c.html = demote(c.html, notes.length === 1 ? 3 : 4);
  return { narrative, notes };
}
