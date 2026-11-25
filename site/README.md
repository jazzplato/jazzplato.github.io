# site/ — the redesign (Astro)

A static Astro build of richthofen.io that keeps the Jekyll URLs (`/YYYY/MM/DD/slug/`,
`/feed.xml`, `/search.json`) and reads the same `../_posts` and `../img`. Jekyll ignores this
folder (`exclude` in `_config.yml`); production builds both with `npm run build:release` (Deploys).

```bash
cd site
npm ci
npm run dev     # http://localhost:4321
npm run build   # dist/, the current design only
npm run build:release   # dist/ as a host serves it: the current design plus every older one
```

`npm run sync` (run before dev and build) mirrors `../img` into `public/img`.
`public/assets/` is the design-taste-frontend kit, loaded as plain files; don't edit it.
The plan, the deal and the check waivers are in `.taste-skill/`.

## Versions

`src/data/versions.json` lists every design: `v1` Classic (the Jekyll site, 2021–2026) and `v2`
Palette (this build, in use), plus previews on their own hosts (`v3` Maian). `npm run build:release`
(`scripts/release.mjs`) builds the Astro site, then each older design whole under its own prefix:

| Address | What it serves |
|---|---|
| `/` | the current design |
| `/v1/…` | the classic site, every post and photograph (`../_config.v1.yml`: noindex, no comments) |
| `/classic/…`, `/prev/…` | redirects to `/v1/…`, query and hash kept (`prev` is always one design back) |
| `/v2/…` | redirects to `/…` while v2 is current |
| `/v3/…` | redirects to the same address on the preview's host (`previews` in `versions.json`) |
| `/versions/` | the timeline, one screenshot per design (`src/assets/versions/`) |

On any page `[` opens the same address one design back (or that design's home page), and in the
classic design `]` comes forward again; the footer and the classic corner chip link the same. A
404 offers the address in an older design when that design still has it. `RELEASE_ENV=staging`
adds `../_config.staging.yml` to the old designs and noindexes every page.

A new design: add it to `versions.json`, give the old one a `_config.<id>.yml` with its `baseurl`
(a non-Jekyll design needs its own step in `release.mjs`), and shoot its home page at 1440x900.

## Palettes

Each visit deals one house accent (`src/lib/accents.ts`) on the default ground. `/palette/` lets a
reader wear any of the 64 design-library palettes, or pin a house accent; the choice lives in their
browser's `localStorage` (`jzp-palette`) and the head script in `Base.astro` applies it before
paint. `/palette/#<id>` shares one. `npm run palettes [path/to/palettes.json]` regenerates
`src/data/palettes.json` from the design-taste-frontend skill's library.

## Deploys

Production is GitHub Pages with the source set to GitHub Actions: every push to `master` runs
`../.github/workflows/pages.yml` (`build:release`, then `check:urls`) and deploys `dist/`. To roll back
to the classic Jekyll build of `master`, run the `gh api … build_type=legacy` command at the top of that
file. The previews are DigitalOcean App Platform free static sites; they clone the public repo, so
after a push run `doctl apps create-deployment <app id>`:

| Host | Branch | Spec | Build |
|---|---|---|---|
| https://richthofen.io | `master` | `../.github/workflows/pages.yml` | production, `build:release` |
| https://staging.richthofen.io | `staging` | `../.do/app.yaml` | the release candidate, `build:release` |
| https://next.richthofen.io | `next` | `../.do/next.yaml` | work in progress, `build:release` |
| https://maian.richthofen.io | `next` | `../.do/v3.yaml` | design v3 Maian preview, `SITE_THEME=v3` |

## Design v3, Maian (microsoft.ai style)

Its own page tree, `src-maian/`, chosen by `SITE_THEME=v3` in `astro.config.mjs`: layout, pages, post
templates, styles (`styles/maian.css`) and scripts are separate from v2; only the posts, `src/lib/`,
`src/data/` and `public/` are shared. Heroes, the closing band and post tiles without photographs are
painted live by a WebGL brush shader (`src-maian/scripts/paint.ts`, colours in `src-maian/lib/paint.ts`);
the lane marks are SVG watercolours (`components/Mark.astro`). Preview: https://maian.richthofen.io
(`../.do/v3.yaml`, noindex).

```bash
SITE_THEME=v3 npx astro build --outDir dist-v3   # after npm run sync
```

Optional painted art from MAI-Image-2.7 on Microsoft Foundry (about $0.035 an image, 9 images). A file in
`src-maian/assets/art/` replaces the shader (`hero-*`, `band-home`) or the SVG mark (`mark-*`) it is named for:

```bash
node scripts/mai-image.mjs --dry-run        # the plan and the cost
export MAI_ENDPOINT=https://<resource>.services.ai.azure.com MAI_API_KEY=...
node scripts/mai-image.mjs                  # writes src-maian/assets/art/<id>.webp and art.json; commit them
```

Prompts are in `scripts/mai-art.json` (abstract paint only; real photographs are never altered). Run
the script without the variables for the Azure setup steps.
