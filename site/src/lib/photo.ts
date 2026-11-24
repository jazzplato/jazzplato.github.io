import type { ImageMetadata } from 'astro';
import { getImage } from 'astro:assets';
import { img, type Post } from './content';

/** An image under /img that must exist: a missing file fails the build instead of rendering empty. */
export function photo(path: string): ImageMetadata {
  const meta = img(path);
  if (!meta) throw new Error(`photo: ${path} not found`);
  return meta;
}

/** A built webp URL, for moments that take a picture by URL (giant-type-pass) and plain <img>s. */
export async function photoUrl(path: string, width = 1600): Promise<string> {
  return (await getImage({ src: photo(path), width, format: 'webp' })).src;
}

/** The post whose URL ends in /<slug>/. */
export function bySlug(posts: Post[], slug: string): Post {
  const p = posts.find((q) => q.url.endsWith(`/${slug}/`));
  if (!p) throw new Error(`bySlug: ${slug} not found`);
  return p;
}
