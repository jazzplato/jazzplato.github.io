// Remark plugin that replaces the Jekyll Liquid includes used in post bodies with plain HTML and
// fixes Jekyll-era link quirks. Runs inside Astro's markdown pipeline (content layer), so it
// only sees the raw front matter; images are optimized later by renderPost() in content.ts.
import type { Html, Link, Paragraph, Root } from 'mdast';
import { SKIP, visit } from 'unist-util-visit';

interface MarkdownFile {
  value: unknown;
  path?: string;
  data: { astro?: { frontmatter?: Record<string, unknown> } };
}

const INCLUDE = /^\{%-?\s*include\s+([\w./-]+)((?:\s+[\w-]+\s*=\s*(?:"[^"]*"|'[^']*'|[^\s%]+))*)\s*-?%\}$/;
const ATTR = /([\w-]+)\s*=\s*(?:"([^"]*)"|'([^']*)'|([^\s%]+))/g;
const LIQUID = /\{%|%\}|\{\{|\}\}/;

export interface LiquidInclude {
  name: string;
  params: Record<string, string>;
}

/** Parses `{% include name.html a="b" c=1 %}`; returns undefined for anything else. */
export function parseInclude(source: string): LiquidInclude | undefined {
  const m = INCLUDE.exec(source.trim());
  if (!m) return undefined;
  const params: Record<string, string> = {};
  for (const a of m[2].matchAll(ATTR)) params[a[1]] = a[2] ?? a[3] ?? a[4] ?? '';
  return { name: m[1], params };
}

const escapeHtml = (s: string) =>
  s.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');

export function youtubeHtml(id: string, title: string): string {
  if (!/^[\w-]{6,20}$/.test(id)) throw new Error(`Invalid YouTube id "${id}"`);
  const t = escapeHtml(title || 'YouTube video');
  return (
    `<div data-video="youtube" style="position:relative;padding-bottom:56.25%;height:0;overflow:hidden">` +
    `<iframe src="https://www.youtube-nocookie.com/embed/${id}" title="${t}" loading="lazy" ` +
    `allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture; web-share" ` +
    `referrerpolicy="strict-origin-when-cross-origin" allowfullscreen ` +
    `style="position:absolute;inset:0;width:100%;height:100%;border:0"></iframe></div>`
  );
}

export function carouselImages(frontmatter: Record<string, unknown>): string[] {
  const list = Array.isArray(frontmatter.carousel) ? frontmatter.carousel : [];
  return list
    .map((item) => (typeof item === 'string' ? item : (item as { image?: unknown })?.image))
    .filter((src): src is string => typeof src === 'string' && src.length > 0);
}

export function galleryHtml(images: string[], title: string, height?: string): string {
  const h = height ? ` data-height="${escapeHtml(height)}"` : '';
  const imgs = images
    .map((src, i) => `<img src="${escapeHtml(src)}" alt="${escapeHtml(`${title}, photo ${i + 1} of ${images.length}`)}">`)
    .join('');
  return `<div data-gallery${h}>${imgs}</div>`;
}

const DATE_LINK = /^\/\d{4}\/\d{2}\/\d{2}\/[^/?#]+$/;

export function remarkJekyll() {
  return (tree: Root, file: MarkdownFile) => {
    const source = String(file.value ?? '');
    const frontmatter = file.data.astro?.frontmatter ?? {};
    const title = typeof frontmatter.title === 'string' ? frontmatter.title : '';

    visit(tree, (node, index, parent) => {
      if (node.type === 'link') {
        // Jekyll served /2024/02/16/foo and /2024/02/16/foo/ alike; Astro with trailingSlash
        // 'always' does not, so add the slash to internal post links.
        const link = node as Link;
        const [path, rest = ''] = link.url.split(/(?=[?#])/);
        if (DATE_LINK.test(path)) link.url = `${path}/${rest}`;
        return;
      }
      if (node.type !== 'paragraph' || !parent || index === undefined) return;
      const p = node as Paragraph;
      const start = p.position?.start.offset;
      const end = p.position?.end.offset;
      if (start === undefined || end === undefined) return;
      const raw = source.slice(start, end).trim();
      if (!raw.startsWith('{%')) return;
      const include = parseInclude(raw);
      if (!include) throw new Error(`Unsupported Liquid in ${file.path}: ${raw}`);

      let value: string;
      if (include.name === 'carousel.html') {
        const images = carouselImages(frontmatter);
        if (!images.length) throw new Error(`carousel include without carousel images in ${file.path}`);
        const { height, unit = '' } = include.params;
        value = galleryHtml(images, title, height ? `${height}${unit}` : undefined);
      } else if (include.name === 'youtube.html') {
        value = youtubeHtml(include.params.id ?? '', include.params.title ?? '');
      } else {
        throw new Error(`Unsupported include "${include.name}" in ${file.path}`);
      }
      const html: Html = { type: 'html', value, position: p.position };
      parent.children.splice(index, 1, html);
      return SKIP;
    });

    visit(tree, 'text', (node) => {
      if (LIQUID.test(node.value)) throw new Error(`Leftover Liquid in ${file.path}: ${node.value.slice(0, 80)}`);
    });
  };
}
