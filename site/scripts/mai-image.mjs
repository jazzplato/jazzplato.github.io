#!/usr/bin/env node
// Makes the painted art for design v3 "Maian" with MAI-Image-2.7 on Microsoft Foundry (scripts/mai-art.json),
// saved as src-maian/assets/art/<id>.webp, where components/Paint.astro (hero-*, band-*) and Mark.astro
// (mark-*) pick it up on the next build. Without art v3 keeps its WebGL brush shader and SVG marks, so this
// is optional and run by hand, never in CI.
//
//   MAI_ENDPOINT=https://<resource>.services.ai.azure.com MAI_API_KEY=... node scripts/mai-image.mjs
//   node scripts/mai-image.mjs --dry-run            # print the plan and the cost, call nothing
//   node scripts/mai-image.mjs --only home,404      # some ids only
//   node scripts/mai-image.mjs --force              # replace files that exist
//
// MAI_DEPLOYMENT names the Foundry deployment (default MAI-Image-2.7). Keys stay in the environment.
import { mkdir, readFile, writeFile, access } from 'node:fs/promises';
import { fileURLToPath } from 'node:url';
import { basename, extname } from 'node:path';
import sharp from 'sharp';

const PRICE = 0.035; // USD per image, MAI-Image-2.7 on Foundry (check your region's pricing)

const args = process.argv.slice(2);
const has = (f) => args.includes(f);
const val = (f) => {
  const i = args.indexOf(f);
  return i >= 0 ? args[i + 1] : undefined;
};
if (has('--help') || has('-h')) {
  console.log(readHeader());
  process.exit(0);
}

const dry = has('--dry-run');
const force = has('--force');
const only = val('--only')?.split(',').map((s) => s.trim()).filter(Boolean);

const endpoint = process.env.MAI_ENDPOINT?.replace(/\/+$/, '');
const key = process.env.MAI_API_KEY;
const model = process.env.MAI_DEPLOYMENT || 'MAI-Image-2.7';

const spec = JSON.parse(await readFile(new URL('./mai-art.json', import.meta.url), 'utf8'));
const outDir = fileURLToPath(new URL('../src-maian/assets/art/', import.meta.url));
const manifestPath = outDir + 'art.json';

const unknown = only?.filter((id) => !spec.art.some((a) => a.id === id)) ?? [];
if (unknown.length) {
  console.error(`Unknown id: ${unknown.join(', ')}. Known: ${spec.art.map((a) => a.id).join(', ')}`);
  process.exit(2);
}

const exists = (p) => access(p).then(() => true, () => false);
const jobs = [];
for (const a of spec.art.filter((a) => !only || only.includes(a.id))) {
  const out = `${outDir}${a.id}.webp`;
  if (!force && (await exists(out))) {
    console.log(`skip  ${a.id} (exists; --force to replace)`);
    continue;
  }
  const width = a.width ?? spec.width;
  const height = a.height ?? spec.height;
  if (Math.min(width, height) < 768) throw new Error(`${a.id}: each side must be at least 768px`);
  jobs.push({ ...a, out, width, height, fullPrompt: `${a.style ?? spec.style} ${a.prompt}`.trim() });
}

console.log(`${jobs.length} image(s) with ${model}, about $${(jobs.length * PRICE).toFixed(2)}`);
for (const j of jobs) console.log(`  ${j.from ? 'edit ' : 'make '} ${j.id}  ${j.width}x${j.height}${j.from ? `  from ${j.from}` : ''}`);
if (dry || jobs.length === 0) process.exit(0);

if (!endpoint || !key) {
  console.error(`
MAI_ENDPOINT and MAI_API_KEY are not set. One-time setup (Azure CLI):
  az login
  az group create -n richthofen-ai -l eastus2
  az cognitiveservices account create -n <resource> -g richthofen-ai -l eastus2 --kind AIServices --sku S0 --custom-domain <resource>
  az cognitiveservices account deployment create -n <resource> -g richthofen-ai --deployment-name MAI-Image-2.7 \\
    --model-name MAI-Image-2.7 --model-format Microsoft --model-version <version> --sku-name GlobalStandard --sku-capacity 1
  export MAI_ENDPOINT=https://<resource>.services.ai.azure.com
  export MAI_API_KEY=$(az cognitiveservices account keys list -n <resource> -g richthofen-ai --query key1 -o tsv)
Then run this again. (Or deploy MAI-Image-2.7 from the model catalog at https://ai.azure.com and copy the endpoint and key.)`);
  process.exit(1);
}

await mkdir(outDir, { recursive: true });
const manifest = (await exists(manifestPath)) ? JSON.parse(await readFile(manifestPath, 'utf8')) : {};

for (const j of jobs) {
  process.stdout.write(`${j.from ? 'edit ' : 'make '} ${j.id} … `);
  const t0 = Date.now();
  let res;
  if (j.from) {
    // Edit: multipart with the source image (up to 5 images per call).
    const src = await readFile(new URL(`../${j.from}`, import.meta.url));
    const form = new FormData();
    form.set('model', model);
    form.set('prompt', j.fullPrompt);
    form.set('width', String(j.width));
    form.set('height', String(j.height));
    form.set('image', new Blob([src], { type: mime(j.from) }), basename(j.from));
    res = await fetch(`${endpoint}/mai/v1/images/edits`, { method: 'POST', headers: { 'api-key': key }, body: form });
  } else {
    res = await fetch(`${endpoint}/mai/v1/images/generations`, {
      method: 'POST',
      headers: { 'api-key': key, 'content-type': 'application/json' },
      body: JSON.stringify({ model, prompt: j.fullPrompt, width: j.width, height: j.height }),
    });
  }
  const body = await res.text();
  if (!res.ok) {
    console.log('failed');
    throw new Error(`${res.status} ${res.statusText}: ${body.slice(0, 600)}`);
  }
  const b64 = JSON.parse(body).data?.[0]?.b64_json;
  if (!b64) throw new Error(`No image in the response: ${body.slice(0, 300)}`);
  const png = Buffer.from(b64, 'base64');
  const info = await sharp(png).webp({ quality: 88 }).toFile(j.out);
  manifest[j.id] = {
    file: `${j.id}.webp`,
    model,
    width: info.width,
    height: info.height,
    prompt: j.fullPrompt,
    ...(j.from ? { from: j.from } : {}),
    created: new Date().toISOString(),
  };
  await writeFile(manifestPath, JSON.stringify(manifest, null, 2) + '\n');
  console.log(`${info.width}x${info.height}, ${Math.round(info.size / 1024)} KB, ${((Date.now() - t0) / 1000).toFixed(1)}s`);
}
console.log('Done. Rebuild v3 (SITE_THEME=v3 npx astro build --outDir dist-v3) to use the new art.');

function mime(p) {
  const e = extname(p).toLowerCase();
  return e === '.png' ? 'image/png' : e === '.webp' ? 'image/webp' : 'image/jpeg';
}
function readHeader() {
  return `Usage: node scripts/mai-image.mjs [--dry-run] [--only id,id] [--force]
Env: MAI_ENDPOINT, MAI_API_KEY, MAI_DEPLOYMENT (default MAI-Image-2.7). Art list: scripts/mai-art.json.`;
}
