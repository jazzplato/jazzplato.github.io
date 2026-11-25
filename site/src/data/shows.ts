// The production pages' own words and picture picks, per post slug. Every fact comes from the post
// itself (its details list, concept or plot); the photographs' alts and crops are in show-photos.json.
import photos from './show-photos.json';

export interface ShowPhoto {
  n: number;
  alt: string;
}
export interface HeroPhoto extends ShowPhoto {
  calm: 'left' | 'right' | 'none';
  pos: string;
  posPhone: string;
}
interface Picks {
  hero: HeroPhoto;
  frame: ShowPhoto;
  grid: ShowPhoto[];
}

export interface Show {
  /** The folder under /img/theatre/productions; none for the two shows without photographs. */
  dir?: string;
  /** The show's name as the h1 sets it (the post title carries a format, "Staged Reading"). */
  name: string;
  hero: 'photo' | 'split' | 'statement';
  lead: string;
  /** The #show heading, over the story of the show. */
  h2: string;
  notes?: { h2: string; line: string };
  videos?: { h2: string; line: string; labels: string[] };
  picks?: Picks;
}

const nus = 'the King Edward VII Hall Chinese Drama at NUS, Singapore';

const text: Record<string, Omit<Show, 'picks'>> = {
  'menage-a-13': {
    dir: '2014-menage-a-13',
    name: 'Ménage à 13',
    hero: 'photo',
    lead: `I was assistant director and led the ensemble, with ${nus}, in February 2014.`,
    h2: 'A Stan Lai tragicomedy about love',
  },
  'the-pillars-of-society': {
    dir: '2015-the-pillars-of-society',
    name: 'The Pillars of Society',
    hero: 'photo',
    lead: `I directed it, adapted the script and designed the stage for ${nus}, in February 2015.`,
    h2: "Ibsen's play about positions and choices",
  },
  'mumble-jumble': {
    dir: '2016-mumble-jumble',
    name: 'Mumble Jumble',
    hero: 'photo',
    lead: `I was assistant director for ${nus}, in February 2016.`,
    h2: 'An allegorical crowd for a modern society',
  },
  'romulus-the-great': {
    dir: '2017-romulus-the-great',
    name: 'Romulus the Great',
    hero: 'photo',
    lead: `I was in the lead cast and assistant director, with ${nus}, in February 2017.`,
    h2: "Dürrenmatt's last emperor, feeding chickens",
  },
  'secret-love-in-peach-blossom-land': {
    dir: '2018-secret-love-in-peach-blossom-land',
    name: 'Secret Love in Peach Blossom Land',
    hero: 'photo',
    lead: `I was artistic advisor to ${nus}, in February 2018.`,
    h2: 'A contemporary classic, thirty years on',
  },
  'me2-vs-he2': {
    dir: '2019-me2-vs-he2',
    name: 'Me² VS He²',
    hero: 'photo',
    lead: `I was artistic advisor to ${nus}, in February 2019.`,
    h2: 'A couple back at one table after nine years',
  },
  'good-enemy': {
    name: 'Good Enemy',
    hero: 'statement',
    lead: 'I read Officer Hao in a staged reading by Pork Filled Productions at Theatre Off Jackson, Seattle, on June 12, 2023.',
    h2: 'A father, a daughter and a closed door',
  },
  'in-between': {
    dir: '2023-in-between',
    name: 'In Between',
    hero: 'photo',
    lead: 'I played Peter, Chea and Olive the Black Rhino in three of its seven short plays, with Yun Theatre at Seattle Center in August 2023.',
    h2: 'An evening about living between cultures',
    notes: { h2: 'The seven short plays', line: 'Seven playwrights, one evening. I played in three of them.' },
    videos: {
      h2: 'Four videos from In Between',
      line: "Highlights, two trailers and the playwrights' interview, on Yun Theatre's YouTube channel.",
      labels: ['Highlights', 'Film trailer', 'Trailer', 'Playwrights interview'],
    },
  },
  'young-people-social-death-archive': {
    dir: '2024-young-people-social-death-archive',
    name: 'Young People Social Death Archive',
    hero: 'split',
    lead: 'I designed the lighting for Yun Theatre at Theatre Off Jackson, Seattle: four shows in February 2024.',
    h2: 'Lighting design for a play about growing up',
    videos: {
      h2: 'Four videos from the run',
      line: "Rehearsal footage, the director's interview and two scenes, on Yun Theatre's YouTube channel.",
      labels: ['Rehearsal footage', 'Interview with the director', 'Say Goodbye', 'Dance Party'],
    },
  },
  'yuns-lab': {
    dir: '2025-yuns-lab',
    name: "Yun's Lab",
    hero: 'photo',
    lead: "I co-produced Yun Theatre's first 12-week program and played the Playwright in its showcase, at Cherry Street Village, Seattle, in May 2025.",
    h2: 'A 12-week program, not a show',
    notes: {
      h2: 'The program, from the first class to the showcase',
      line: 'Why we started it, what the 12 weeks covered and the four plays of the showcase.',
    },
  },
  'instant-noodles-ii': {
    name: 'Instant Noodles II',
    hero: 'statement',
    lead: 'I was in the cast of a 24-hour festival by Pork Filled Productions and SIS Productions at Theatre Off Jackson, Seattle, in February 2026.',
    h2: 'Seven plays written and staged in 24 hours',
  },
  'america-250': {
    dir: '2026-america-250',
    name: 'America “250”',
    hero: 'photo',
    lead: 'I devised and performed it in the ensemble, with Yun Theatre at BASE in Georgetown, Seattle, on July 4, 2026.',
    h2: 'A devised piece for the 250th anniversary',
  },
  home: {
    dir: '2026-home',
    name: 'Home',
    hero: 'photo',
    lead: "I was in the cast of Yun Theatre's staged reading at BASE, Seattle, on October 25, 2026.",
    h2: 'A staged reading of three short scripts',
    notes: { h2: 'Three short plays and a cast of eight', line: 'Each script came out of the devising workshop.' },
  },
};

const picks = photos as Record<string, Picks>;

export const shows: Record<string, Show> = Object.fromEntries(
  Object.entries(text).map(([slug, s]) => [slug, { ...s, picks: s.dir ? picks[s.dir] : undefined }]),
);

export function showOf(slug: string): Show {
  const s = shows[slug];
  if (!s) throw new Error(`shows: no entry for ${slug}`);
  if (s.dir && !s.picks) throw new Error(`shows: no photo picks for ${s.dir}`);
  return s;
}
