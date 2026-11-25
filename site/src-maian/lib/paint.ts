// Maian's painted light: the colour sets the hero shader (scripts/paint.ts) blends, and the CSS tiles that
// stand in for a picture on the cards of posts without one. Every colour is a pigment of the same set, so a
// page of tiles reads as one series, like the painted cards on microsoft.ai.

export type Scene = 'home' | 'writing' | 'theatre' | 'code' | 'about' | 'lost';

const butter = '#ecd08c';
const apricot = '#e3aa78';
const rose = '#dc9a98';
const clay = '#c4836c';
const slate = '#8a9bb0';
const dusk = '#5a6c84';
const mist = '#d6dbe0';
const stone = '#a9a397';
const cream = '#f7efe0';

/** Five stops, from the lit corner to the deep one. The shader settles its text area on the deep end. */
export const scenes: Record<Scene, string[]> = {
  home: [butter, apricot, stone, slate, dusk],
  writing: [cream, butter, rose, slate, dusk],
  theatre: [apricot, rose, clay, dusk, '#3f4d70'],
  code: [mist, butter, slate, dusk, '#3c4a6b'],
  about: [butter, apricot, mist, slate, dusk],
  lost: [cream, mist, butter, slate, dusk],
};

const tilePigments = [
  [butter, apricot, slate],
  [rose, butter, dusk],
  [mist, slate, apricot],
  [apricot, rose, slate],
  [butter, mist, dusk],
  [cream, rose, slate],
];

function hash(s: string): number {
  let h = 2166136261;
  for (const c of s) h = Math.imul(h ^ c.charCodeAt(0), 16777619);
  return h >>> 0;
}

/** A painted tile for a card without a picture: three soft fields of pigment over a diagonal wash,
    the same for the same key on every build. */
export function tile(key: string): string {
  let h = hash(key);
  const r = () => ((h = Math.imul(h ^ (h >>> 15), 2246822507) >>> 0), (h % 1000) / 1000);
  const [a, b, c] = tilePigments[hash(key) % tilePigments.length];
  const pt = () => `${Math.round(10 + r() * 80)}% ${Math.round(10 + r() * 80)}%`;
  const angle = Math.round(120 + r() * 60);
  return [
    `radial-gradient(ellipse 70% 60% at ${pt()}, ${a} 0%, transparent 70%)`,
    `radial-gradient(ellipse 60% 70% at ${pt()}, ${b} 0%, transparent 72%)`,
    `radial-gradient(ellipse 80% 50% at ${pt()}, ${c}cc 0%, transparent 75%)`,
    `linear-gradient(${angle}deg, ${a}, ${c})`,
  ].join(', ');
}

/** The shader's colours and seed for a tile, picked from the scenes by the post's key. */
export function tilePaint(key: string): { colours: string[]; seed: number } {
  const all = Object.values(scenes);
  const h = hash(key);
  return { colours: all[h % all.length], seed: Math.round(((h >>> 8) % 1000) / 10) / 10 };
}
