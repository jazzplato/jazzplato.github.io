// @ts-check
import { defineConfig } from 'astro/config';
import { fileURLToPath } from 'node:url';
import { remarkJekyll } from './src/lib/remark-jekyll.ts';

// Posts (../_posts), images (../img) and the about/theatre texts (../_includes) live in the
// Jekyll repo one level up; the dev server must be allowed to read them.
const repoRoot = fileURLToPath(new URL('..', import.meta.url));

// Design v3, Maian (/v3/ and maian.richthofen.io), is its own page tree in src-maian/: it shares the
// content, data and libs of src/ and public/, but none of v2's pages, layout or styles.
// scripts/release.mjs builds it with SITE_BASE=/v3/ to serve it under that prefix.
const maian = process.env.SITE_THEME === 'v3';

export default defineConfig({
  site: 'https://richthofen.io',
  base: process.env.SITE_BASE || '/',
  srcDir: maian ? './src-maian' : './src',
  trailingSlash: 'always',
  build: { format: 'directory' },
  markdown: { remarkPlugins: [remarkJekyll] },
  vite: { server: { fs: { allow: [repoRoot] } } },
});
