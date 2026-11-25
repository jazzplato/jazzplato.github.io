// Builds src/data/palettes.json, the palettes /palette/ offers: each palette of the design-taste-frontend
// library turned into the 16 --p-* colours the site runs on, the same way the skill's start.mjs does it
// (tokens() there), so a palette picked here looks as it would have if the site had been started with it.
//   node scripts/palettes.mjs [path/to/library/palettes.json]
// Default library: ~/.agents/skills/design-taste-frontend/library/palettes.json. The output is committed, so
// the build never needs the skill.
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { color } from '../public/assets/effects/fx.js';

const here = path.dirname(fileURLToPath(import.meta.url));
const src = process.argv[2] ?? path.join(os.homedir(), '.agents/skills/design-taste-frontend/library/palettes.json');
const out = path.join(here, '../src/data/palettes.json');

function readableMuted(muted, ink, grounds) {
  let m = muted;
  for (let i = 0; i < 40 && grounds.some((g) => color.contrast(m, g) < 4.6); i++) m = color.mix(m, ink, 0.08);
  return m;
}

// start.mjs tokens(), unchanged in substance
function tokens(p) {
  const bg = color.hex(p.bg), ink = color.hex(p.ink);
  const surface = color.hex(p.surface || color.mix(bg, ink, 0.05));
  const muted = readableMuted(color.hex(p.muted || color.mix(ink, bg, 0.45)), ink, [bg, surface]);
  const accent = color.hex(p.accent || ink);
  const accentInk = color.contrast(accent, p.accentInk || bg) >= 4.5 ? color.hex(p.accentInk || bg) : color.readable(accent, '#ffffff', '#111111', ink, bg);
  const dark = color.isDark(bg);
  const field = (p.fields || []).map((f) => f.bg).find((c) => (dark ? !color.isDark(c) : color.lab(c)[0] < 0.4));
  const invBg = color.hex(field || ink);
  const invInk = color.contrast(invBg, bg) >= 7 ? bg : color.readable(invBg, '#ffffff', '#111111');
  const invSurface = color.mix(invBg, invInk, 0.07);
  const invMuted = readableMuted(color.mix(invInk, invBg, 0.38), invInk, [invBg, invSurface]);
  const invAccent = color.contrast(accent, invBg) >= 3 && (color.chroma(invBg) < 0.03 || color.hueDistance(accent, invBg) > 20) ? accent : invInk;
  const invAccentInk = invAccent === accent ? accentInk : invBg;
  const action = color.contrast(accent, bg) >= 2.2 ? accent : ink;
  const actionInk = action === accent ? accentInk : bg;
  const invAction = color.contrast(invAccent, invBg) >= 2.2 ? invAccent : invInk;
  const invActionInk = invAction === invAccent ? invAccentInk : invBg;
  return { bg, surface, ink, muted, accent, accentInk, action, actionInk, invBg, invSurface, invInk, invMuted, invAccent, invAccentInk, invAction, invActionInk };
}

// accentInk -> --p-accent-ink, invBg -> --p-inv-bg
const cssName = (k) => `--p-${k.replace(/[A-Z]/g, (c) => `-${c.toLowerCase()}`)}`;
const firstSentence = (s = '') => (s.match(/^.*?[.!?](?=\s|$)/)?.[0] ?? s).trim();

const library = JSON.parse(fs.readFileSync(src, 'utf8'));
const palettes = library.map((p) => {
  const t = tokens(p);
  return {
    id: p.id,
    name: p.name,
    tags: p.tags ?? [],
    dark: color.isDark(t.bg),
    note: firstSentence(p.note),
    v: Object.fromEntries(Object.entries(t).map(([k, c]) => [cssName(k), color.hex(c)])),
  };
});
fs.writeFileSync(out, `${JSON.stringify({ source: 'design-taste-frontend library/palettes.json', palettes }, null, 1)}\n`);
console.log(`${palettes.length} palettes (${palettes.filter((p) => p.dark).length} dark) -> ${path.relative(process.cwd(), out)}`);
