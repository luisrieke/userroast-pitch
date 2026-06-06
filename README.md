# 🍖 userroast

Built at the [**founder hackathon: build fast & get funded**](https://luma.com/hmqh70k1?tk=HAIqlb) — a full-day founder hackathon by AI BEAVERS & Mollie at House of AI Hamburg, Sat Jun 6 2026.

The pitch: build something real in one day and turn it into a startup.

## What it is

**userroast** scores how a *real human* would actually experience a product — then roasts it in one honest line. We applied it to well-known open-source repos to rank them.

## Live

| Site | URL | What |
| --- | --- | --- |
| Tool | [userroast.com](https://userroast.com) | The product |
| Pitch | [pitch.userroast.com](https://pitch.userroast.com) | The hackathon pitch deck |
| Rankings | [rankings.userroast.com](https://rankings.userroast.com) | Best submitted repos, ranked + roasted |

## Repo layout

Three independent, self-contained deployables — they don't share code (see [`AGENTS.md`](AGENTS.md)):

```
pitch/      → pitch.userroast.com   standalone static pitch deck
rankings/   → rankings.userroast.com standalone static rankings page
frontend/ + backend/ → userroast.com  the product app
```

Static sites have no build step. Preview from the repo root:

```bash
python3 -m http.server 8000
# → http://localhost:8000/pitch/  or  http://localhost:8000/rankings/
```

Design system + voice: see [`STYLEGUIDE.md`](STYLEGUIDE.md).
