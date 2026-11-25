import { getPosts } from '../lib/content';
import { isoDate } from '../lib/format';

export async function GET() {
  const posts = await getPosts();
  const index = posts.map((p) => ({
    title: p.title,
    subtitle: p.subtitle ?? '',
    tags: p.tags,
    url: p.url,
    date: isoDate(p.date),
    kind: p.kind,
    lang: p.lang,
  }));
  return new Response(JSON.stringify(index), {
    headers: { 'Content-Type': 'application/json; charset=utf-8' },
  });
}
