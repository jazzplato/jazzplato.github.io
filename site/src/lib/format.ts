import type { Lang } from './content';

/** "February 19, 2017" or "2017年2月19日" (dates are stored as UTC noon). */
export function formatDate(date: Date, lang: Lang | string = 'en'): string {
  return date.toLocaleDateString(lang.startsWith('zh') ? 'zh-Hans' : 'en-US', {
    year: 'numeric',
    month: 'long',
    day: 'numeric',
    timeZone: 'UTC',
  });
}

/** YYYY-MM-DD for <time datetime>. */
export const isoDate = (date: Date): string => date.toISOString().slice(0, 10);
