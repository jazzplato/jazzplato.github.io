// Turns the Astro build (dist/) into the whole release: the current design at /, every old design at
// /<id>/ and the aliases /classic/ and /prev/ (src/data/versions.json). Run after `astro build`:
//   npm run build:release                      production: analytics on, no noindex beyond the archive's own
//   RELEASE_ENV=staging npm run build:release  a staging or preview host: adds ../_config.staging.yml
// Needs Ruby and Bundler for the classic Jekyll build (bundle install in the repo root).
import { spawnSync } from 'node:child_process';
import { copyFileSync, existsSync, mkdirSync, readdirSync, readFileSync, writeFileSync } from 'node:fs';
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
const old = manifest.versions.slice(0, at);
const aliases = { ...manifest.aliases, ...(at > 0 ? { prev: ids[at - 1] } : {}) };

/** HTML files under `root`, relative to it, skipping the folders named in `skip`. */
const pages = (root, skip = new Set(), dir = root) =>
  readdirSync(dir, { withFileTypes: true }).flatMap((d) => {
    const full = join(dir, d.name);
    if (d.isDirectory()) return dir === root && skip.has(d.name) ? [] : pages(root, skip, full);
    return d.name.endsWith('.html') && d.name !== '404.html' ? [relative(root, full).split(sep).join('/')] : [];
  });
const urlOf = (file) => '/' + file.replace(/(^|\/)index\.html$/, '$1');

// 1. Each old design, built from this repo's own sources. v1 is the Jekyll site with its own config.
for (const v of old) {
  const config = join(repoRoot, `_config.${v.id}.yml`);
  if (!existsSync(config)) fail(`_config.${v.id}.yml not found for ${v.id}`);
  const configs = ['_config.yml', `_config.${v.id}.yml`, ...(env === 'production' ? [] : ['_config.staging.yml'])];
  const out = join(dist, v.id);
  console.log(`release: building ${v.id} (${v.name}) with ${configs.join(', ')}`);
  const run = spawnSync('bundle', ['exec', 'jekyll', 'build', '--quiet', '--config', configs.join(','), '-d', out], {
    cwd: repoRoot,
    stdio: 'inherit',
    env: { ...process.env, JEKYLL_ENV: env === 'production' ? 'production' : 'development' },
  });
  if (run.status !== 0) fail(`jekyll build for ${v.id} failed`);
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
const reserved = new Set([...ids, ...Object.keys(aliases)]);
for (const [alias, id] of Object.entries(aliases)) {
  const v = manifest.versions.find((x) => x.id === id);
  if (!v) fail(`alias ${alias} names unknown version ${id}`);
  writeStubs(alias, pages(join(dist, v.path === '/' ? '' : id), v.path === '/' ? reserved : new Set()), v.path);
}
writeStubs(manifest.current, pages(dist, reserved), '/');

// 3. The retired service worker of the classic site, so old registrations on this origin remove themselves.
copyFileSync(join(repoRoot, 'sw.js'), join(dist, 'sw.js'));
console.log(`release: done (${env}); versions ${ids.join(', ')}, current ${manifest.current}`);
