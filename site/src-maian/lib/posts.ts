// What a card or a post head shows for a post: its name, its kind and its picture. A production shows its
// hero photograph (data/show-photos.json); a review or film note its still (data/writing.ts); anything else
// its cover from the Jekyll post; a post with none gets a painted tile.
import type { ImageMetadata } from 'astro';
import { img, type Post } from '../../src/lib/content';
import { shows } from '../../src/data/shows';
import { writingHeroes } from '../../src/data/writing';

export const slugOf = (p: Post) => p.url.split('/').at(-2) ?? '';

export interface Picture {
  src: ImageMetadata;
  alt: string;
  pos: string;
}

export function pictureOf(p: Post): Picture | undefined {
  const slug = slugOf(p);
  if (p.kind === 'production') {
    const s = shows[slug];
    if (s?.dir && s.picks) {
      const src = img(`/img/theatre/productions/${s.dir}/${s.picks.hero.n}.webp`);
      if (src) return { src, alt: s.picks.hero.alt, pos: s.picks.hero.pos };
    }
  } else {
    const h = writingHeroes[slug];
    const src = h && img(h.src);
    if (h && src) return { src, alt: h.alt, pos: h.pos };
  }
  if (p.cover) return { src: p.cover, alt: '', pos: '50% 50%' };
}

/** The show's own name for a production (the post title carries a format), else the title. */
export const nameOf = (p: Post) => (p.kind === 'production' ? (shows[slugOf(p)]?.name ?? p.title) : p.title);

export const kindLabel: Record<Post['kind'], string> = {
  production: 'Production',
  essay: 'Essay',
  review: 'Review',
  movie: 'Film note',
};
export const kindLabelZh: Record<Post['kind'], string> = {
  production: '演出',
  essay: '随笔',
  review: '剧评',
  movie: '影评',
};

/** The widths of a srcset that never ask for more pixels than the file has. */
export const widths = (src: ImageMetadata, ws: number[]) => {
  const out = ws.filter((w) => w <= src.width);
  return out.length && out.at(-1)! >= src.width * 0.9 ? out : [...out, src.width];
};

const han = (t: string) => /[\u3400-\u9fff]/.test(t);
/** The language a title is set in (a Chinese piece may carry an English title). */
export const titleLang = (p: Post) => (han(p.title) ? 'zh-Hans' : 'en');
