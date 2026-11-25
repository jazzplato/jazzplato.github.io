// Turns the Astro build (dist/) into the whole release: the current design at /, every other design at
// /<id>/, the aliases /classic/ and /prev/, and /<id>/ of each preview forwarding to its own host
// (src/data/versions.json). Run after `astro build`:
//   npm run build:release                      production: analytics on, no noindex beyond the archive's own
//   RELEASE_ENV=staging npm run build:release  a staging or preview host: adds ../_config.staging.yml
// Needs Ruby and Bundler for the classic Jekyll build (bundle install in the repo root).
import { spawnSync } from 'node:child_process';
import {
  copyFileSync,
  cpSync,
  existsSync,
  mkdirSync,
  readdirSync,
  readFileSync,
  rmSync,
  writeFileSync,
} from 'node:fs';
import { dirname, join, relative, sep } from 'node:path';
import { fileURLToPath } from 'node:url';

const siteRoot = join(dirname(fileURLToPath(import.meta.url)), '..');
const repoRoot = join(siteRoot, '..');
const dist = join(siteRoot, 'dist');
const manifest = JSON.parse(readFileSync(join(siteRoot, 'src/data/versions.json'), 'utf8'));
const env = process.env.RELEASE_ENV || 'production';

const fail = (msg) => {
  console.error(`release: ${msg}`);
  process.exit(1);
};
if (!existsSync(join(dist, 'index.html'))) fail('dist/index.html not found; run astro build first');

const ids = manifest.versions.map((v) => v.id);
const at = ids.indexOf(manifest.current);
if (at < 0) fail(`current version ${manifest.current} is not in versions`);
const others = manifest.versions.filter((v) => v.id !== manifest.current);
const aliases = { ...manifest.aliases, ...(at > 0 ? { prev: ids[at - 1] } : {}) };

/** HTML files under `root`, relative to it, skipping the folders named in `skip` (and 404.html unless `all`). */
const pages = (root, skip = new Set(), all = false, dir = root) =>
  readdirSync(dir, { withFileTypes: true }).flatMap((d) => {
    const full = join(dir, d.name);
    if (d.isDirectory()) return dir === root && skip.has(d.name) ? [] : pages(root, skip, all, full);
    return d.name.endsWith('.html') && (all || d.name !== '404.html') ? [relative(root, full).split(sep).join('/')] : [];
  });
const urlOf = (file) => '/' + file.replace(/(^|\/)index\.html$/, '$1');

// 1. Every other design, built whole under its path from this repo's own sources.
/** A Jekyll design (v1, the classic site) with its own _config.<id>.yml. */
const jekyll = (v, out) => {
  const configs = ['_config.yml', `_config.${v.id}.yml`, ...(env === 'production' ? [] : ['_config.staging.yml'])];
  console.log(`release: building ${v.id} (${v.name}) with ${configs.join(', ')}`);
  const run = spawnSync('bundle', ['exec', 'jekyll', 'build', '--quiet', '--config', configs.join(','), '-d', out], {
    cwd: repoRoot,
    stdio: 'inherit',
    env: { ...process.env, JEKYLL_ENV: env === 'production' ? 'production' : 'development' },
  });
  if (run.status !== 0) fail(`jekyll build for ${v.id} failed`);
};
/** An Astro design (v3, Maian): its SITE_THEME page tree (astro.config.mjs) built with its path as the base. */
const astro = (v, out) => {
  console.log(`release: building ${v.id} (${v.name}) with Astro, SITE_THEME=${v.id}, base ${v.path}`);
  // Inside the project: an outDir outside it also collects Astro's cache files (data-store.json, settings.json).
  const tmp = join(siteRoot, 'node_modules', `.release-${v.id}`);
  rmSync(tmp, { recursive: true, force: true });
  const run = spawnSync('npx', ['astro', 'build', '--silent', '--outDir', tmp], {
    cwd: siteRoot,
    stdio: 'inherit',
    env: { ...process.env, SITE_THEME: v.id, SITE_BASE: v.path },
  });
  if (run.status !== 0) fail(`astro build for ${v.id} failed`);
  // public/ (img/, assets/) is already at the root of dist; copy only what this design built itself.
  const shared = new Set(readdirSync(join(siteRoot, 'public')));
  for (const name of readdirSync(tmp)) if (!shared.has(name)) cpSync(join(tmp, name), join(out, name), { recursive: true });
  rmSync(tmp, { recursive: true, force: true });
  // Its pages link from the root (/writing/); send the links to pages it has to its own copy instead. Links
  // marked data-design (to the other designs) and to pages only the current design has (/palette/) stay.
  const own = new Set(pages(out).map(urlOf));
  const prefix = v.path.slice(0, -1);
  for (const f of pages(out, new Set(), true)) {
    const file = join(out, f);
    const html = readFileSync(file, 'utf8').replace(/<a\s[^>]*>/g, (tag) =>
      tag.includes('data-design')
        ? tag
        : tag.replace(/(\shref=")(\/(?!\/)[^"#?]*)/, (m, attr, path) => (own.has(path) ? attr + prefix + path : m)),
    );
    writeFileSync(file, html);
  }
};
for (const v of others) {
  if (v.path !== `/${v.id}/`) fail(`${v.id} must be served at /${v.id}/, not ${v.path}`);
  const out = join(dist, v.id);
  (existsSync(join(repoRoot, `_config.${v.id}.yml`)) ? jekyll : astro)(v, out);
  if (!existsSync(join(out, 'index.html'))) fail(`${v.id}/index.html missing after the build`);
}

// 2. Redirect stubs: /classic/... and /prev/... to the version they name, /<current>/... to /.
const stub = (to) =>
  `<!doctype html><html lang="en"><head><meta charset="utf-8"><title>Redirecting</title>` +
  `<meta name="robots" content="noindex"><link rel="canonical" href="${to}">` +
  `<meta http-equiv="refresh" content="0; url=${to}">` +
  `<script>location.replace(${JSON.stringify(to)}+location.search+location.hash)</script></head>` +
  `<body><a href="${to}">${to}</a></body></html>\n`;
const writeStubs = (alias, files, target) => {
  for (const f of files) {
    const file = join(dist, alias, f);
    mkdirSync(dirname(file), { recursive: true });
    writeFileSync(file, stub(target + urlOf(f).slice(1)));
  }
  console.log(`release: /${alias}/ -> ${target} (${files.length} pages)`);
};
const previews = manifest.previews ?? [];
const reserved = new Set([...ids, ...Object.keys(aliases), ...previews.map((p) => p.id)]);
for (const [alias, id] of Object.entries(aliases)) {
  const v = manifest.versions.find((x) => x.id === id);
  if (!v) fail(`alias ${alias} names unknown version ${id}`);
  writeStubs(alias, pages(join(dist, v.path === '/' ? '' : id), v.path === '/' ? reserved : new Set()), v.path);
}
writeStubs(manifest.current, pages(dist, reserved), '/');
// Previews live on their own hosts: /<id>/... hands over to the same address there.
for (const p of previews) writeStubs(p.id, pages(dist, reserved), p.url.replace(/\/?$/, '/'));

// 3. The retired service worker of the classic site, so old registrations on this origin remove themselves.
copyFileSync(join(repoRoot, 'sw.js'), join(dist, 'sw.js'));
console.log(`release: done (${env}); versions ${ids.join(', ')}, current ${manifest.current}`);
