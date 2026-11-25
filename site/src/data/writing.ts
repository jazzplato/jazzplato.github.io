// The writing pages' hero pictures, per post slug, each with an alt written for it (the posts' own alts
// are file names). A post not listed here opens on a statement hero: its title set large.
export interface WritingHero {
  src: string;
  alt: string;
  pos: string;
}

export const writingHeroes: Record<string, WritingHero> = {
  babylon: {
    src: '/img/movie/2023-01-18-babylon/the-party.webp',
    alt: 'The party in Babylon, dancers in red and gold under paper streamers, a woman in red carried over the crowd',
    pos: '50% 50%',
  },
  'last-year-at-marienbad': {
    src: '/img/movie/2023-12-07-last-year-at-marienbad/all-self.webp',
    alt: 'A woman with her eyes closed in a black-and-white hotel room in Last Year at Marienbad, a man and another woman behind her',
    pos: '30% 50%',
  },
  'uncle-vanya': {
    src: '/img/theatre/reviews/2024-05-10-uncle-vanya/2nd-half-stage.webp',
    alt: 'The Uncle Vanya stage seen from the top of the house, a square wooden floor of tables and chairs ringed by the audience',
    pos: '50% 50%',
  },
  'an-enemy-of-the-people': {
    src: '/img/theatre/reviews/2024-05-11-an-enemy-of-the-people/stage-1.webp',
    alt: 'A long, pale stage running between red seats for An Enemy of the People, the audience taking their places',
    pos: '58% 50%',
  },
  'mary-jane': {
    src: '/img/theatre/reviews/2024-05-12-mary-jane/stage.webp',
    alt: 'The Mary Jane set before the show, a white kitchen and a red sofa against blue walls',
    pos: '36% 50%',
  },
};
