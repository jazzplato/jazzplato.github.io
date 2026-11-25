// Which design the build produces. v2 is the default (next.richthofen.io); SITE_THEME=v3 builds the
// microsoft.ai-style daylight variant of the same pages (see public/theme/v3.css and .do/v3.yaml).
export type Theme = 'v2' | 'v3';

export const THEME: Theme = process.env.SITE_THEME === 'v3' ? 'v3' : 'v2';
