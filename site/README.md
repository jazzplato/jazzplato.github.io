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
