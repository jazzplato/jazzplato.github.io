// Mirrors the repo's ../img into public/img so raw images keep their /img/... URLs in dev and
// in dist (inline markdown images in feeds, og:image fallbacks and old absolute links rely on them).
import { cpSync, existsSync, readdirSync, rmSync, statSync } from 'node:fs';
import { dirname, join, relative } from 'node:path';
import { fileURLToPath } from 'node:url';

const siteRoot = join(dirname(fileURLToPath(import.meta.url)), '..');
const from = join(siteRoot, '..', 'img');
const to = join(siteRoot, 'public', 'img');

if (!existsSync(from)) {
  console.error(`sync-public: ${from} not found`);
  process.exit(1);
}

/** Files under `root`, as paths relative to it. */
const walk = (root, dir = root) =>
  readdirSync(dir, { withFileTypes: true }).flatMap((d) =>
    d.isDirectory() ? walk(root, join(dir, d.name)) : [relative(root, join(dir, d.name))],
  );

const wanted = new Set(walk(from).filter((f) => !f.endsWith('.DS_Store')));
let copied = 0;
let removed = 0;
if (existsSync(to)) {
  for (const f of walk(to)) {
    if (!wanted.has(f)) {
      rmSync(join(to, f));
      removed++;
    }
  }
}
for (const f of wanted) {
  const src = join(from, f);
  const dest = join(to, f);
  if (existsSync(dest)) {
    const a = statSync(src);
    const b = statSync(dest);
    if (a.size === b.size && Math.abs(a.mtimeMs - b.mtimeMs) < 1000) continue;
  }
  cpSync(src, dest, { preserveTimestamps: true });
  copied++;
}
console.log(`sync-public: ${wanted.size} files in public/img (${copied} copied, ${removed} removed)`);
