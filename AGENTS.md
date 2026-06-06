# AGENTS.md

Guidance for AI agents (and humans) working in this repository.

## TL;DR

This repo holds **three independent projects** that ship to **three different
domains**. They do **not** import from, link to, or share code/assets with each
other. Treat each top-level directory as its own deployable unit.

| Directory             | Deploys to            | What it is                                  |
| --------------------- | --------------------- | ------------------------------------------- |
| `pitch/`              | `pitch.userroast.com` | Standalone static pitch deck (slide deck)   |
| `rankings/`           | `rankings.usermap.com`| Standalone static public-repo rankings page |
| `frontend/` + `backend/` | `userroast.com`    | The actual product app (frontend + backend) |

## Hard rules

1. **The sites do not know about each other.** `pitch/` and `rankings/` are
   separate websites on separate domains. They must never reference each other
   with relative paths (e.g. no `../rankings/...` from inside `pitch/`).
   - Cross-references between them, if ever needed, go through the **public
     domain URL** (e.g. `https://rankings.usermap.com`), never the filesystem.
2. **Each site is fully self-contained.** Every directory that is its own site
   carries its **own copy** of everything it needs — fonts, `styles.css`, etc.
   Do **not** factor shared assets up into the repo root to "DRY them up." The
   duplication is intentional so each site can be deployed in isolation.
3. **No root-level shared assets.** There is deliberately no `/fonts` or
   `/styles.css` at the repo root. Keep it that way.
4. **Keep changes scoped to one directory** unless a task explicitly spans
   multiple sites. A change in `pitch/` should not touch `rankings/`, and vice
   versa.

## The projects

### `pitch/` → `pitch.userroast.com`

A standalone, static **pitch deck** that presents the userroast product as a
horizontal slide deck (keyboard / arrows / dots / swipe navigation).

```
pitch/
├── index.html      # the deck markup + navigation JS (inline)
├── styles.css      # shared design-system tokens/type/components (own copy)
├── pitch.css       # deck-specific layout (slides, nav chrome, steps, values)
└── fonts/          # self-hosted Suisse Intl (own copy)
```

- Pure static site — no build step. Open `index.html` (or serve the folder).
- External links (brand, "view rankings") point at public `userroast.com` URLs,
  never at the sibling `rankings/` folder.

### `rankings/` → `rankings.usermap.com`

A standalone, static **public-repo rankings** page: cards scoring how real users
would experience well-known open-source projects, each with a one-line roast.

```
rankings/
├── index.html      # page markup + the repo data & render JS (inline)
├── styles.css      # shared design-system tokens/type/components (own copy)
├── rankings.css    # page-specific layout (controls, grid, cards, roast block)
└── fonts/          # self-hosted Suisse Intl (own copy)
```

- Pure static site — no build step. Open `index.html` (or serve the folder).

### `frontend/` + `backend/` → `userroast.com`

The actual **product application**.

- `frontend/` — the app UI.
- `backend/` — the app API / services.
- These two together make up the product at `userroast.com`.
- (Currently scaffolding — fill in with the app's own tooling, build, and run
  instructions as it grows.)

## Design system

Both static sites share the **same visual language** (see `STYLEGUIDE.md` at the
repo root): warm paper background, black ink, one acid-yellow highlight, a
handwritten "roast" voice, Suisse Intl + Space Mono + Gloria Hallelujah.

Because the sites don't share files, this consistency is maintained by **keeping
their `styles.css` copies in sync by hand** and following `STYLEGUIDE.md` — not
by importing a shared stylesheet. If you change a shared token in one site and
the change is meant to be global, mirror it into the other site's `styles.css`
deliberately.

## Local preview

Any static site can be previewed by serving its directory, e.g.:

```bash
# from the repo root
python3 -m http.server 8000
# then open http://localhost:8000/pitch/  or  http://localhost:8000/rankings/
```

Serve from the **repo root** (or the specific site folder) so each site's
relative `styles.css` and `fonts/` resolve correctly.
