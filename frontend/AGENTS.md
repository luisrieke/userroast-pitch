This is a hackathon project. Sacrifice security for speed.p


# userroast — Style Guide

The visual language behind userroast. Editorial, print-inspired, a little playful.
Clean paper background, confident black ink, one acid-yellow highlight, and a
handwritten roast voice. This guide documents the tokens, type, and components
used in `rankings/index.html` so future pages stay consistent.

---

## Brand voice

- **Tone:** sharp, witty, honest. We "roast" products, but constructively.
- **Casing:** lowercase for UI labels, eyebrows, and microcopy (`public repo rankings`, `now in beta`).
- **Copy length:** short. One-line roasts. Punchy summaries.

---

## Color

Defined as CSS custom properties on `:root`.

| Token           | Value     | Role                                          |
| --------------- | --------- | --------------------------------------------- |
| `--bg`          | `#faf9f5` | Page background (warm paper)                  |
| `--paper`       | `#ffffff` | Card / surface background                     |
| `--ink`         | `#16150f` | Primary text, strong borders, fills           |
| `--line`        | `#e3e1d8` | Hairline borders, dividers, inactive bar      |
| `--line-strong` | `#16150f` | Emphasized borders (e.g. CTA button)          |
| `--muted`       | `#8a877a` | Secondary text, labels, metadata              |
| `--yellow`      | `#fef251` | Highlight / marker, roast accent border       |
| `--meat`        | `#e0573c` | "Roast" hot accent (used sparingly)           |

Supporting text shade used inline: `#3a3830` (body copy on cards/lede),
`#2a281f` (roast body).

```css
:root {
  --bg: #faf9f5;
  --paper: #ffffff;
  --ink: #16150f;
  --line: #e3e1d8;
  --line-strong: #16150f;
  --muted: #8a877a;
  --yellow: #fef251;
  --meat: #e0573c;
}
```

### Usage rules
- Yellow is a **highlighter**, not a fill for large areas. Use behind a word (`.mark`) or as a thin accent border.
- Meat orange is reserved for the "roast" label only. Don't dilute it.
- Inverted elements (active chips, CTA hover) use `--ink` background with `#fff` text.

---

## Typography

Three families, each with a distinct job.

| Family               | Use case                                          | Class    |
| -------------------- | ------------------------------------------------- | -------- |
| **Suisse Intl**      | Primary UI + headings + body                      | default  |
| **Space Mono**       | Labels, eyebrows, metadata, scores, chips, CTA    | `.mono`  |
| **Gloria Hallelujah**| Handwritten roast voice                           | `.hand`  |

- Suisse Intl is self-hosted (`rankings/fonts/`), weights 400/500/600/700 with italics.
- Space Mono + Gloria Hallelujah load from Google Fonts.
- Base `body`: `line-height: 1.5`, antialiased.

### Type scale

| Element     | Size                          | Weight | Notes                                  |
| ----------- | ----------------------------- | ------ | -------------------------------------- |
| `h1`        | `clamp(40px, 7.5vw, 84px)`    | 600    | `line-height: .98`, `letter-spacing: -.025em` |
| `.name`     | `21px`                        | 600    | Card title, `letter-spacing: -.01em`   |
| `.score`    | `26px`                        | 700    | Mono                                   |
| `.lede`     | `17px`                        | 400    | Max width `540px`, color `#3a3830`     |
| `.summary`  | `15px`                        | 400    | Card body                              |
| `.roast`    | `14px`                        | 400    | Handwritten, `line-height: 1.55`       |
| `.fb p`     | `13px`                        | 400    | Feedback body                          |
| `.eyebrow`  | `12px`                        | 400    | Mono, uppercase, `letter-spacing: .26em` |
| labels/chips| `12–13px`                     | 400    | Mono, uppercase, wide tracking         |

### Eyebrow pattern
Small mono, uppercase, wide letter-spacing, muted. Sits above headings.

```css
.eyebrow {
  font-family: "Space Mono", monospace;
  font-size: 12px;
  letter-spacing: .26em;
  text-transform: uppercase;
  color: var(--muted);
}
```

### Highlight mark
Wraps a word in the headline with the yellow marker.

```html
<h1>user <span class="mark">roast</span></h1>
```

```css
h1 .mark {
  background: var(--yellow);
  padding: 0 .06em;
}
```

---

## Layout

- **Container** `.wrap`: `max-width: 1080px`, centered, `padding: 0 24px`.
- **Grid** `.grid`: `repeat(auto-fill, minmax(320px, 1fr))`, `gap: 18px`.
- **Sections:** generous vertical rhythm — header `64px` top, footer `44px` top, divided by `1px solid var(--line)`.

### Spacing
Common values: `6, 8, 12, 16, 18, 20, 22, 24, 40, 44, 64, 72 px`.
Stick to this set rather than introducing arbitrary numbers.

### Radii
- Cards / surfaces: `10px`
- Buttons (CTA): `8px`
- Pills (chips, bars): `999px`

---

## Components

### Card
Paper surface, hairline border that darkens on hover.

```css
.card {
  background: var(--paper);
  border: 1px solid var(--line);
  border-radius: 10px;
  padding: 20px 20px 22px;
  display: flex;
  flex-direction: column;
  transition: border-color .15s ease;
}
.card:hover { border-color: var(--ink); }
```

Anatomy: `.top` (rank · name/repo · score) → `.summary` → `.roast` → `.feedback` (two columns).

### Chip (filter / toggle)
Mono pill, muted by default, inverts when `.active`.

```css
.chip {
  font-family: "Space Mono", monospace;
  font-size: 13px;
  border: 1px solid var(--line);
  background: transparent;
  color: var(--muted);
  padding: 7px 13px;
  border-radius: 999px;
  cursor: pointer;
  transition: color .15s ease, border-color .15s ease, background .15s ease;
}
.chip:hover  { color: var(--ink); border-color: var(--ink); }
.chip.active { background: var(--ink); border-color: var(--ink); color: #fff; }
```

### Score + bar
Mono number with `/100`, plus a thin progress bar filled in ink.

```css
.score { font-family: "Space Mono", monospace; font-weight: 700; font-size: 26px; }
.bar   { width: 72px; height: 4px; border-radius: 999px; background: var(--line); overflow: hidden; }
.bar > i { display: block; height: 100%; background: var(--ink); }
```

### Roast block
Handwritten quote with a yellow left border and a mono/meat label.

```css
.roast {
  font-family: "Gloria Hallelujah", cursive;
  font-size: 14px;
  padding-left: 14px;
  border-left: 2px solid var(--yellow);
}
.roast b {
  display: block;
  font-family: "Space Mono", monospace;
  font-size: 10px;
  letter-spacing: .12em;
  text-transform: uppercase;
  color: var(--meat);
}
```

### CTA button
Outlined, inverts to solid ink on hover. SVG stroke flips to white.

```css
.cta {
  font-family: "Space Mono", monospace;
  font-size: 14px;
  border: 1px solid var(--line-strong);
  background: transparent;
  border-radius: 8px;
  padding: 12px 16px;
  color: var(--ink);
  transition: background .15s ease, color .15s ease;
}
.cta:hover { background: var(--ink); color: #fff; }
.cta:hover svg { stroke: #fff; }
```

### Ticker
Looping mono marquee at the very top, muted, divided by `·`. Decorative
(`aria-hidden="true"`), `34s` linear infinite scroll.

---

## Motion

- Hover/state transitions: `.15s ease` (color, border, background).
- Ticker scroll: `34s linear infinite`, `translateX(0 → -50%)`.
- `html { scroll-behavior: smooth; }`.
- Keep motion subtle and functional; no bounces or large movements.

---

## Iconography

- Inline SVG, `stroke-width: 2`, `stroke-linecap: round`, `stroke-linejoin: round`.
- GitHub mark uses `fill="#8a877a"` (muted) to match metadata.
- Emoji used intentionally: 🍖 for "roast", ✓ for confirmation states.

---

## Accessibility

- Decorative elements get `aria-hidden="true"` (e.g. the ticker).
- External links use `target="_blank"` with `rel="noopener"`.
- Maintain ink-on-paper contrast for body text; reserve `--muted` for secondary info only.
- Respect the `clamp()`-based responsive type — don't hardcode huge fixed sizes.

---

## Responsive

- Single breakpoint in use: `@media (max-width: 560px)` collapses `.feedback` to one column.
- Grid auto-fills, so cards reflow naturally between `320px` and `1fr`.

---

## Quick reference

```text
Paper bg ........ #faf9f5
Ink ............. #16150f
Hairline ........ #e3e1d8
Muted text ...... #8a877a
Highlight ....... #fef251
Roast accent .... #e0573c

Headings/body ... Suisse Intl
Labels/numbers .. Space Mono (.mono)
Roast voice ..... Gloria Hallelujah (.hand)

Card radius ..... 10px   ·   Button ... 8px   ·   Pill ... 999px
Transitions ..... .15s ease
Container ....... max-width 1080px, 24px gutter
```
