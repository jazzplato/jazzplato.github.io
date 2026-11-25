import { defineCollection, z } from 'astro:content';
import { glob } from 'astro/loaders';

// Paths are resolved from the Astro project root (site/), so '../' points at the Jekyll repo.
const stem = (entry: string) => entry.replace(/^.*\//, '').replace(/\.md$/, '');

const carouselItem = z.union([
  z.object({ image: z.string() }).passthrough(),
  z.string().transform((image) => ({ image })),
]);

const posts = defineCollection({
  loader: glob({
    pattern: '**/[0-9][0-9][0-9][0-9]-[0-9][0-9]-[0-9][0-9]-*.md',
    base: '../_posts',
    // Jekyll identity: the file name without extension, e.g. 2017-02-19-romulus-the-great.
    generateId: ({ entry }) => stem(entry),
  }),
  schema: z
    .object({
      title: z.string(),
      subtitle: z.string().nullish(),
      description: z.string().nullish(),
      layout: z.string().nullish(),
      author: z.string().nullish(),
      'header-style': z.string().nullish(),
      'header-img': z.string().nullish(),
      'header-mask': z.union([z.number(), z.string()]).nullish(),
      tags: z
        .union([z.array(z.union([z.string(), z.number()])), z.string()])
        .nullish()
        .transform((t) => (typeof t === 'string' ? t.split(/\s+/) : (t ?? [])).map(String).filter(Boolean)),
      carousel: z.array(carouselItem).nullish().transform((c) => c ?? []),
      multilingual: z.boolean().nullish(),
      lang: z.string().nullish(),
      date: z.coerce.date().nullish(),
      published: z.boolean().nullish(),
    })
    .passthrough(),
});

// The About page and the theatre essay are plain markdown includes without front matter.
const pages = defineCollection({
  loader: glob({ pattern: '{about,theatre}/{en,zh}.md', base: '../_includes' }),
  schema: z.object({}).passthrough(),
});

export const collections = { posts, pages };
