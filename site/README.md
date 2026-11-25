# site/ — the redesign (Astro)

A static Astro build of richthofen.io that keeps the Jekyll URLs (`/YYYY/MM/DD/slug/`,
`/feed.xml`, `/search.json`) and reads the same `../_posts` and `../img`. Jekyll ignores this
folder (`exclude` in `_config.yml`), so GitHub Pages keeps serving the classic site.

```bash
cd site
npm ci
npm run dev     # http://localhost:4321
npm run build   # dist/, 28 pages
```

`npm run sync` (run before dev and build) mirrors `../img` into `public/img`.
`public/assets/` is the design-taste-frontend kit, loaded as plain files; don't edit it.
The plan, the deal and the check waivers are in `.taste-skill/`.

Deploys: the `next` branch builds to https://next.richthofen.io (`../.do/next.yaml`);
https://staging.richthofen.io is the classic Jekyll site (`../.do/app.yaml`).

## Design v3 (microsoft.ai style)

The same pages in a daylight look: `SITE_THEME=v3 npm run build`. It switches tokens and fonts in
`src/layouts/Base.astro`, loads `public/theme/v3.css` and `v3.js`, and puts `src/components/site/Aura.astro`
(a grainy gradient that follows the pointer and the scroll) under every non-photo hero. Without
`SITE_THEME` the build is v2, unchanged. Preview: https://maian.richthofen.io (`../.do/v3.yaml`, noindex).

Optional hero art from MAI-Image-2.7 on Microsoft Foundry (about $0.04 an image, 7 images):

```bash
node scripts/mai-image.mjs --dry-run        # the plan and the cost
export MAI_ENDPOINT=https://<resource>.services.ai.azure.com MAI_API_KEY=...
node scripts/mai-image.mjs                  # writes src/assets/v3/<id>.webp and art.json; commit them
```

Prompts are in `scripts/mai-art.json` (abstract light only; real photographs are never altered). Run
the script without the variables for the Azure setup steps.
