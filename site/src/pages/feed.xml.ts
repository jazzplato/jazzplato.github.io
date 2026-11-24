import rss from '@astrojs/rss';
import type { APIContext } from 'astro';
import { getPosts, renderPost } from '../lib/content';

export async function GET(context: APIContext) {
  const posts = await getPosts();
  const items = await Promise.all(
    posts.map(async (post) => ({
      title: post.title,
      link: post.url,
      pubDate: post.date,
      description: post.excerpt,
      content: (await renderPost(post, { feed: true })).html,
      categories: post.tags,
    })),
  );
  return rss({
    title: 'Richthofen',
    description: 'Code | Theatre',
    site: context.site ?? 'https://richthofen.io',
    items,
    customData: '<language>en</language>',
  });
}
