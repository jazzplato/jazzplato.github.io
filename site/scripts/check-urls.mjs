// Verifies that the Astro build (dist/) serves every Jekyll post at exactly the same URL as the
// Jekyll build (../_site), that the site-level routes exist, and that every internal src/srcset/
// href in the built HTML points at a file in dist. Exits 1 on any problem.
//   node scripts/check-urls.mjs [--jekyll ../_site] [--dist dist]
import { existsSync, readdirSync, readFileSync, statSync } from 'node:fs';
import { dirname, join, relative, sep } from 'node:path';
import { fileURLToPath } from 'node:url';

const siteRoot = join(dirname(fileURLToPath(import.meta.url)), '..');
const arg = (name, fallback) => {
  const i = process.argv.indexOf(name);
  return i > 0 ? process.argv[i + 1] : fallback;
};
const jekyll = join(siteRoot, arg('--jekyll', '../_site'));
const dist = join(siteRoot, arg('--dist', 'dist'));

for (const [name, dir] of [['Jekyll build', jekyll], ['Astro build', dist]]) {
  if (!existsSync(dir)) {
    console.error(`check-urls: ${name} not found at ${dir}`);
    process.exit(1);
  }
}

const walk = (dir) =>
  readdirSync(dir, { withFileTypes: true }).flatMap((d) =>
    d.isDirectory() ? walk(join(dir, d.name)) : [join(dir, d.name)],
  );
const toUrl = (root, file) => `/${relative(root, file).split(sep).join('/')}`.replace(/index\.html$/, '');
const POST = /^\/\d{4}\/\d{2}\/\d{2}\/[^/]+\/$/;
const pagesIn = (root) =>
  new Set(walk(root).filter((f) => f.endsWith('.html')).map((f) => toUrl(root, f)));

const jekyllPages = pagesIn(jekyll);
const astroPages = pagesIn(dist);
const jekyllPosts = [...jekyllPages].filter((u) => POST.test(u)).sort();
const astroPosts = [...astroPages].filter((u) => POST.test(u)).sort();

const errors = [];
for (const u of jekyllPosts) if (!astroPages.has(u)) errors.push(`missing in dist: ${u}`);
for (const u of astroPosts) if (!jekyllPages.has(u)) errors.push(`not in Jekyll _site: ${u}`);

const required = ['/', '/writing/', '/theatre/', '/code/', '/about/', '/404.html', '/feed.xml', '/search.json'];
for (const u of required) {
  const file = join(dist, u.endsWith('/') ? `${u}index.html` : u);
  if (!existsSync(file)) errors.push(`missing route: ${u}`);
}

// Internal references in the built HTML must resolve to files in dist.
const resolves = (path) => {
  let p;
  try {
    p = decodeURI(path.replace(/[?#].*$/, ''));
  } catch {
    p = path;
  }
  const file = join(dist, p);
  if (!file.startsWith(dist)) return false;
  if (existsSync(file) && statSync(file).isFile()) return true;
  return existsSync(join(file, 'index.html'));
};
const REF = /\s(src|href|srcset)="([^"]*)"/g;
let refs = 0;
for (const file of walk(dist).filter((f) => f.endsWith('.html'))) {
  const html = readFileSync(file, 'utf8');
  if (/\{%|%\}/.test(html)) errors.push(`Liquid left in ${toUrl(dist, file)}`);
  for (const [, attr, value] of html.matchAll(REF)) {
    const urls = attr === 'srcset' ? value.split(',').map((c) => c.trim().split(/\s+/)[0]) : [value.trim()]; // browsers strip the spaces round a URL
    for (const raw of urls) {
      const url = raw.replace(/&amp;/g, '&').replace(/^https:\/\/richthofen\.io(?=\/)/, '');
      if (!url.startsWith('/') || url.startsWith('//')) continue;
      refs++;
      if (!resolves(url)) errors.push(`broken ${attr} in ${toUrl(dist, file)}: ${url}`);
    }
  }
}

const jekyllOnly = [...jekyllPages].filter((u) => !POST.test(u) && !astroPages.has(u)).sort();
console.log(`check-urls: ${jekyllPosts.length} Jekyll posts, ${astroPosts.length} Astro posts, ${refs} internal refs checked`);
if (jekyllOnly.length) console.log(`info: Jekyll-only pages (not ported): ${jekyllOnly.join(' ')}`);
if (errors.length) {
  for (const e of errors) console.error(`error: ${e}`);
  console.error(`check-urls: ${errors.length} problem(s)`);
  process.exit(1);
}
console.log('check-urls: OK');
