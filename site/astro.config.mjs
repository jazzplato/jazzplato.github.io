// @ts-check
import { defineConfig } from 'astro/config';
import { fileURLToPath } from 'node:url';
import { remarkJekyll } from './src/lib/remark-jekyll.ts';

// Posts (../_posts), images (../img) and the about/theatre texts (../_includes) live in the
// Jekyll repo one level up; the dev server must be allowed to read them.
const repoRoot = fileURLToPath(new URL('..', import.meta.url));

export default defineConfig({
  site: 'https://richthofen.io',
  trailingSlash: 'always',
  build: { format: 'directory' },
  markdown: { remarkPlugins: [remarkJekyll] },
  vite: { server: { fs: { allow: [repoRoot] } } },
});
