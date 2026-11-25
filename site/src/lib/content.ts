// Data layer for the Astro site. Pages and components only talk to the Jekyll content through
// the exports of this module.
import type { ImageMetadata, MarkdownHeading } from 'astro';
import { getImage } from 'astro:assets';
import { getCollection, getEntry, type CollectionEntry } from 'astro:content';
import type { Heading, Link, List, ListItem, Nodes, Paragraph, PhrasingContent, Root, RootContent } from 'mdast';
import { fromMarkdown } from 'mdast-util-from-markdown';
import { gfmFromMarkdown } from 'mdast-util-gfm';
import { gfm } from 'micromark-extension-gfm';
import projectsData from '../data/projects.json';
import workData from '../data/work.json';
import { carouselImages, parseInclude } from './remark-jekyll';

export type Kind = 'production' | 'review' | 'movie' | 'essay'; // theatre/productions, theatre/reviews, movie, random
export type Lang = 'zh-Hans' | 'en';

export interface Production {
  roles: string[];
  company?: string;
  companyUrl?: string;
  director?: string;
  playwrights?: string;
  venue?: string;
  city?: string;
  performed?: string;
  link?: string;
  region: 'Singapore' | 'Seattle' | 'Pittsburgh' | 'New York' | string;
  /** Characters played ("I played **X**"), in order of appearance. */
  characters: string[];
  /** "Media coverage" links. */
  press: { title: string; url: string }[];
  /** Every row of the "Production Details" / "Program Details" list, as written. */
  credits: { label: string; text: string; url?: string }[];
  /** True when company/city were not in the post but inferred (the 2014–2019 NUS shows). */
  inferred: boolean;
}

export interface Post {
  id: string;
  url: string;
  title: string;
  subtitle?: string;
  date: Date;
  year: number;
  kind: Kind;
  lang: Lang;
  tags: string[];
  excerpt: string;
  minutes: number;
  cover?: ImageMetadata;
  gallery: ImageMetadata[];
  production?: Production;
  videos: { id: string; title: string }[];
}

export interface Project {
  name: string;
  description: string;
  language: string | null;
  url: string;
  kind: 'tool' | 'ai' | 'infra' | 'course' | 'app';
  created: number;
  updated: number;
}

export interface Work {
  org: string;
  role: string;
  what: string;
  place: string;
  from: number;
  /** null = ongoing. */
  to: number | null;
  url: string;
  /** Years are rough placeholders until confirmed. */
  assumed: boolean;
}

export const projects: Project[] = projectsData as Project[];
export const work: Work[] = workData as Work[];

// ---------------------------------------------------------------------------------------------
// Images: every file in the repo's img/ folder, keyed by its site path (/img/...).

// Favicons stay raw files under /img/icon/ (see scripts/sync-public.mjs).
const imageModules = import.meta.glob<ImageMetadata>(
  ['../../../img/**/*.{webp,jpg,jpeg,png}', '!../../../img/icon/**'],
  { eager: true, import: 'default' },
);
const images = new Map<string, ImageMetadata>(
  Object.entries(imageModules).map(([key, meta]) => [key.replace(/^(\.\.\/)+/, '/'), meta]),
);

/** `/img/theatre/productions/2026-home/1.webp` (or a full richthofen.io URL) → ImageMetadata. */
export function img(path: string): ImageMetadata | undefined {
  let p = path.trim().replace(/^https?:\/\/(www\.)?richthofen\.io/, '').replace(/[?#].*$/, '');
  try {
    p = decodeURI(p);
  } catch {
    // keep as is
  }
  if (!p.startsWith('/')) p = `/${p}`;
  return images.get(p);
}

function requireImg(path: string, where: string): ImageMetadata {
  const meta = img(path);
  if (!meta) throw new Error(`${where}: image ${path} not found in ../img`);
  return meta;
}

// ---------------------------------------------------------------------------------------------
// Text helpers

const CJK = /[\u2E80-\u2FDF\u3040-\u30FF\u3400-\u4DBF\u4E00-\u9FFF\uF900-\uFAFF]/g;
const LATIN_LETTER = /[A-Za-z\u00C0-\u024F]/g;
const LATIN_WORD = /[A-Za-z\u00C0-\u024F0-9]+(?:['’.-][A-Za-z\u00C0-\u024F0-9]+)*/g;
const count = (s: string, re: RegExp) => s.match(re)?.length ?? 0;

const parseMarkdown = (body: string): Root =>
  fromMarkdown(body, { extensions: [gfm()], mdastExtensions: [gfmFromMarkdown()] });

const SKIP_TEXT = new Set(['html', 'image', 'imageReference', 'code', 'definition', 'footnoteDefinition']);
// Nodes whose children are blocks (joined with a space); inline children are concatenated.
const BLOCK_CONTAINER = new Set(['root', 'list', 'listItem', 'blockquote', 'table', 'tableRow']);

/** Visible text of a markdown node (no raw HTML, image alts, code blocks or Liquid). */
function textOf(node: Nodes): string {
  if (SKIP_TEXT.has(node.type)) return '';
  if (node.type === 'text') return node.value.startsWith('{%') ? '' : node.value;
  if (node.type === 'inlineCode') return node.value;
  if (node.type === 'break') return ' ';
  if (!('children' in node)) return '';
  const parts = (node.children as Nodes[]).map(textOf);
  return BLOCK_CONTAINER.has(node.type) ? parts.join(' ') : parts.join('');
}

const clean = (s: string) => s.replace(/[\u200B-\u200D\uFEFF]/g, '').replace(/\s+/g, ' ').trim();

function detectLang(text: string): Lang {
  const cjk = count(text, CJK);
  const latin = count(text, LATIN_LETTER);
  return cjk / Math.max(1, cjk + latin) > 0.3 ? 'zh-Hans' : 'en';
}

function readingMinutes(text: string): number {
  const cjk = count(text, CJK);
  const words = count(text.replace(CJK, ' '), LATIN_WORD);
  return Math.max(1, Math.round(cjk / 400 + words / 230));
}

function truncate(text: string, max: number): string {
  const chars = [...text];
  if (chars.length <= max) return text;
  let cut = chars.slice(0, max).join('');
  const space = cut.lastIndexOf(' ');
  if (space > max * 0.6) cut = cut.slice(0, space);
  return `${cut.replace(/[\s,;:，、；：.。—-]+$/, '')}…`;
}

const isEmphasisOnly = (p: Paragraph) =>
  p.children.every(
    (c) => c.type === 'strong' || c.type === 'emphasis' || c.type === 'break' || (c.type === 'text' && !clean(c.value)),
  );

/** First real paragraphs (no headings, lists, quotes, tables, media or bold labels), ~160 chars. */
function excerptOf(tree: Root, max = 160): string {
  let out = '';
  for (const node of tree.children) {
    if (node.type !== 'paragraph' || isEmphasisOnly(node)) continue;
    const text = clean(textOf(node));
    if (!text || /^\{%/.test(text) || /^[^.。!?！？]{0,60}[:：]$/.test(text)) continue;
    const gap = /[\p{Script=Han}\u3000-\u303f\uff00-\uffef]$/u.test(out) ? '' : ' ';
    out = out ? `${out}${gap}${text}` : text;
    if ([...out].length >= max * 0.6) break;
  }
  return truncate(out, max);
}

// ---------------------------------------------------------------------------------------------
// Production details

const SINGAPORE_COMPANY = 'NUS King Edward VII Hall Chinese Drama';
const REGIONS: Record<string, string> = {
  singapore: 'Singapore',
  seattle: 'Seattle',
  pittsburgh: 'Pittsburgh',
  newyork: 'New York',
  'new york': 'New York',
};

function linksIn(node: Nodes): { title: string; url: string }[] {
  const out: { title: string; url: string }[] = [];
  const walk = (n: Nodes) => {
    if (n.type === 'link') out.push({ title: clean(textOf(n)), url: (n as Link).url });
    else if ('children' in n) (n.children as Nodes[]).forEach(walk);
  };
  walk(node);
  return out;
}

const stripAddress = (s: string) => clean(s.replace(/\s*\([^)]*\d[^)]*\)/g, ''));

function parsePlace(text: string): { venue?: string; city?: string } {
  const t = stripAddress(text).replace(/,\s*(USA|United States|US)$/i, '');
  const m = /^(.*?),\s*([^,]+),\s*[A-Z]{2}$/.exec(t);
  if (m) return { venue: m[1] || undefined, city: m[2] };
  return { venue: t || undefined };
}

/** Top-level blocks grouped by the H1 they follow. */
function sections(tree: Root): Map<string, RootContent[]> {
  const out = new Map<string, RootContent[]>();
  let current: RootContent[] | undefined;
  for (const node of tree.children) {
    if (node.type === 'heading' && node.depth === 1) {
      current = [];
      out.set(clean(textOf(node)).toLowerCase(), current);
    } else current?.push(node);
  }
  return out;
}

function parseProduction(tree: Root, body: string, subtitle: string | undefined, tags: string[]): Production {
  const secs = sections(tree);
  const details = [...secs].find(([h]) => /^(production|program) details?$/.test(h))?.[1] ?? [];
  const production: Production = {
    roles: [],
    region: '',
    characters: [],
    press: [],
    credits: [],
    inferred: false,
  };

  for (const list of details.filter((n): n is List => n.type === 'list')) {
    for (const item of list.children as ListItem[]) {
      const first = item.children.find((c): c is Paragraph => c.type === 'paragraph');
      if (!first) continue;
      const line = clean(textOf(first));
      const colon = line.indexOf(':');
      if (colon < 0) continue;
      const label = line.slice(0, colon).trim();
      const links = linksIn(item);
      // "Label:" followed by a nested list of links.
      const text = line.slice(colon + 1).trim() || links.map((l) => l.title).join(', ');
      production.credits.push({ label, text, url: links[0]?.url });
      const key = label.toLowerCase();
      if (/^(produced|presented|organi[sz]ed) by$/.test(key)) {
        production.company = clean(text.replace(/,?\s+in association with.*$/i, ''));
        production.companyUrl = links[0]?.url;
      } else if (/^(directed by|director( (&|and) conceiver)?)$/.test(key)) {
        production.director = clean(text.replace(/\s*\([^)]*\)/g, ''));
      } else if (/^(written by|playwrights?)$/.test(key)) {
        production.playwrights = text;
      } else if (/^(performed|held) at$/.test(key)) {
        Object.assign(production, parsePlace(text));
      } else if (/^(performed on|final showcase|dates?)$/.test(key)) {
        production.performed = text;
      } else if (/^official (web ?page|website)$/.test(key)) {
        production.link = links[0]?.url ?? (/^https?:\/\//.test(text) ? text : undefined);
      } else if (/^(media coverage|press)$/.test(key)) {
        production.press = links;
      }
    }
  }

  // Collections of short plays credit the writers in "## Title *by Name*" headings.
  if (!production.playwrights) {
    const names: string[] = [];
    for (const node of tree.children) {
      if (node.type !== 'heading' || node.depth !== 2) continue;
      for (const c of (node as Heading).children as PhrasingContent[]) {
        const m = c.type === 'emphasis' ? /^by\s+(.+)$/i.exec(clean(textOf(c))) : null;
        if (m && !names.includes(m[1])) names.push(m[1]);
      }
    }
    if (names.length) production.playwrights = names.join(', ');
  }

  for (const m of body.matchAll(/I played (?:the )?\*\*(.+?)\*\*/g)) {
    if (!production.characters.includes(m[1])) production.characters.push(m[1]);
  }

  production.roles = (subtitle ?? '').split(/\s*·\s*/).map(clean).filter(Boolean);
  if (!production.roles.length) {
    const role = [...secs].find(([h]) => /^my roles?$/.test(h))?.[1] ?? [];
    for (const list of role.filter((n): n is List => n.type === 'list')) {
      for (const item of list.children) {
        const strong = linksIn(item).length ? undefined : (item.children[0] as Paragraph | undefined);
        const label = strong ? clean(textOf(strong)).replace(/[:(].*$/, '').trim() : '';
        if (label) production.roles.push(label);
      }
    }
  }

  const regionTag = tags.find((t) => REGIONS[t.toLowerCase()]);
  production.region = regionTag ? REGIONS[regionTag.toLowerCase()] : (production.city ?? '');
  if (!production.city && production.region) production.city = production.region;
  if (!production.company && production.region === 'Singapore') {
    // Per the theatre essay, the Singapore productions were all with this hall's drama club.
    production.company = SINGAPORE_COMPANY;
    production.inferred = true;
  }
  return production;
}

// ---------------------------------------------------------------------------------------------
// Posts

type PostEntry = CollectionEntry<'posts'>;

function kindOf(filePath: string | undefined): Kind {
  const dir = /_posts\/(.*)\/[^/]+$/.exec((filePath ?? '').replace(/\\/g, '/'))?.[1] ?? '';
  if (dir.startsWith('theatre/productions')) return 'production';
  if (dir.startsWith('theatre/reviews')) return 'review';
  if (dir.startsWith('movie')) return 'movie';
  return 'essay';
}

const pad = (n: number) => String(n).padStart(2, '0');
const entries = new Map<string, PostEntry>();
let cache: Promise<Post[]> | undefined;

function toPost(entry: PostEntry): Post {
  const m = /^(\d{4})-(\d{2})-(\d{2})-(.+)$/.exec(entry.id);
  if (!m) throw new Error(`Post file name must be YYYY-MM-DD-slug.md: ${entry.filePath}`);
  const [, y, mo, d, slug] = m;
  // Jekyll: a front-matter date overrides the file name date; noon UTC keeps the day stable.
  const fm = entry.data.date;
  const date = fm
    ? new Date(Date.UTC(fm.getUTCFullYear(), fm.getUTCMonth(), fm.getUTCDate(), 12))
    : new Date(Date.UTC(+y, +mo - 1, +d, 12));
  const url = `/${date.getUTCFullYear()}/${pad(date.getUTCMonth() + 1)}/${pad(date.getUTCDate())}/${slug}/`;

  const body = entry.body ?? '';
  const tree = parseMarkdown(body);
  const text = clean(`${entry.data.title} ${entry.data.subtitle ?? ''} ${textOf(tree)}`);
  const kind = kindOf(entry.filePath);
  const where = entry.filePath ?? entry.id;

  const gallery = carouselImages(entry.data as Record<string, unknown>).map((p) => requireImg(p, where));
  const inline = /!\[[^\]]*\]\(\s*<?(\/img\/[^\s)>]+)/.exec(body)?.[1];
  const headerImg = entry.data['header-img'];
  const cover = headerImg ? requireImg(headerImg, where) : (gallery[0] ?? (inline ? requireImg(inline, where) : undefined));

  const videos: Post['videos'] = [];
  for (const line of body.match(/\{%-?\s*include\s+youtube\.html[^%]*%\}/g) ?? []) {
    const inc = parseInclude(line);
    if (inc?.params.id) videos.push({ id: inc.params.id, title: inc.params.title ?? '' });
  }

  const subtitle = entry.data.subtitle?.trim() || undefined;
  const tags = entry.data.tags;
  return {
    id: entry.id,
    url,
    title: entry.data.title,
    subtitle,
    date,
    year: date.getUTCFullYear(),
    kind,
    lang: detectLang(text),
    tags,
    excerpt: entry.data.description?.trim() || excerptOf(tree),
    minutes: readingMinutes(text),
    cover,
    gallery,
    production: kind === 'production' ? parseProduction(tree, body, subtitle, tags) : undefined,
    videos,
  };
}

const newestFirst = (a: Post, b: Post) => b.date.getTime() - a.date.getTime() || b.id.localeCompare(a.id);

/** All posts, newest first. */
export function getPosts(): Promise<Post[]> {
  cache ??= getCollection('posts', (e) => e.data.published !== false).then((list) => {
    for (const e of list) entries.set(e.id, e);
    return list.map(toPost).sort(newestFirst);
  });
  return cache;
}

/** Theatre productions, newest first. */
export async function getProductions(): Promise<Post[]> {
  return (await getPosts()).filter((p) => p.kind === 'production');
}

/** Reviews, movie notes and essays, newest first. */
export async function getWriting(): Promise<Post[]> {
  return (await getPosts()).filter((p) => p.kind !== 'production');
}

// ---------------------------------------------------------------------------------------------
// Rendering

const WIDTHS = [480, 800, 1200, 1600];
const DEFAULT_SIZES = '(min-width: 50rem) 50rem, 100vw';
const ATTRS = /([^\s"'=<>/]+)(?:\s*=\s*(?:"([^"]*)"|'([^']*)'|([^\s"'=<>`]+)))?/g;
const NAMED: Record<string, string> = { quot: '"', apos: "'", lt: '<', gt: '>', amp: '&', nbsp: '\u00A0' };
export const decode = (s: string) =>
  s.replace(/&(#x[0-9a-f]+|#\d+|[a-z]+);/gi, (m, e: string) => {
    if (e[0] !== '#') return NAMED[e.toLowerCase()] ?? m;
    const code = e[1] === 'x' || e[1] === 'X' ? parseInt(e.slice(2), 16) : parseInt(e.slice(1), 10);
    return Number.isFinite(code) ? String.fromCodePoint(code) : m;
  });
const encode = (s: string) => s.replace(/&/g, '&amp;').replace(/"/g, '&quot;').replace(/</g, '&lt;');

async function replaceAsync(s: string, re: RegExp, fn: (...m: string[]) => Promise<string>): Promise<string> {
  const jobs: Promise<string>[] = [];
  s.replace(re, (...m) => {
    jobs.push(fn(...(m.slice(0, -2) as string[])));
    return '';
  });
  const done = await Promise.all(jobs);
  let i = 0;
  return s.replace(re, () => done[i++]);
}

export interface RenderOptions {
  /** `sizes` attribute for body images. */
  sizes?: string;
  /** Raw HTML with absolute URLs and untouched images, for RSS. */
  feed?: boolean;
}

/** Rewrites every <img src="/img/..."> to an optimized, responsive astro:assets image. */
export async function optimizeImages(html: string, sizes = DEFAULT_SIZES): Promise<string> {
  return replaceAsync(html, /<img\b([^>]*?)\s*\/?>/g, async (_, rawAttrs) => {
    const attrs: Record<string, string> = {};
    for (const a of rawAttrs.matchAll(ATTRS)) attrs[a[1].toLowerCase()] = decode(a[2] ?? a[3] ?? a[4] ?? '');
    const meta = attrs.src ? img(attrs.src) : undefined;
    if (meta) {
      const out = await getImage({ src: meta, widths: WIDTHS, sizes, format: 'webp', alt: attrs.alt ?? '' });
      attrs.src = out.src;
      attrs.srcset = out.srcSet.attribute;
      attrs.sizes = sizes;
      attrs.width = String(out.attributes.width);
      attrs.height = String(out.attributes.height);
    }
    attrs.alt ??= '';
    attrs.loading ??= 'lazy';
    attrs.decoding ??= 'async';
    const order = ['src', 'srcset', 'sizes', 'alt', 'title', 'width', 'height', 'loading', 'decoding'];
    const keys = [...order.filter((k) => k in attrs), ...Object.keys(attrs).filter((k) => !order.includes(k))];
    return `<img ${keys.map((k) => `${k}="${encode(attrs[k])}"`).join(' ')}>`;
  });
}

const absolutize = (html: string, site: string) =>
  html.replace(/\b(href|src)="\/(?!\/)/g, `$1="${site.replace(/\/$/, '')}/`);

function renderedHtml(entry: { id: string; rendered?: { html: string } }, what: string): string {
  const html = entry.rendered?.html;
  if (html === undefined) throw new Error(`${what} ${entry.id} failed to render (see the markdown error above)`);
  if (/\{%|%\}/.test(html)) throw new Error(`${what} ${entry.id} still contains Liquid`);
  return html;
}

/** Body HTML of a post (galleries, videos and optimized images included) plus its headings. */
export async function renderPost(
  post: Post,
  options: RenderOptions = {},
): Promise<{ html: string; headings: MarkdownHeading[] }> {
  if (!entries.size) await getPosts();
  const entry = entries.get(post.id);
  if (!entry) throw new Error(`Unknown post ${post.id}`);
  const raw = renderedHtml(entry, 'Post');
  const headings = (entry.rendered?.metadata?.headings ?? []) as MarkdownHeading[];
  if (options.feed) return { html: absolutize(raw, import.meta.env.SITE), headings };
  return { html: await optimizeImages(raw, options.sizes), headings };
}

async function renderPage(id: string): Promise<string> {
  const entry = await getEntry('pages', id);
  if (!entry) throw new Error(`Missing ../_includes/${id}.md`);
  return optimizeImages(renderedHtml(entry, 'Page'));
}

/** The About text (../_includes/about/{en,zh}.md) as HTML. */
export const getAbout = (lang: 'en' | 'zh'): Promise<string> => renderPage(`about/${lang}`);

/** The theatre essay (../_includes/theatre/{en,zh}.md) as HTML. */
export const getTheatreEssay = (lang: 'en' | 'zh'): Promise<string> => renderPage(`theatre/${lang}`);
