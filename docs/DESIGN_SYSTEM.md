# Fusiey Design System

> AI-assisted perler-bead craft studio.
> Visual language: **pixel-art kawaii** — a single plum outline on every surface, pastel fills, hard offset sticker shadows, chunky pixel typography.

This document is written for AI coding tools. Every color, size, and component referenced here exists as a token in `client/src/styles/tokens.json`, a CSS variable in `client/src/styles/tokens.css`, and as a Tailwind 4 utility via `client/src/styles/index.css` `@theme`. **When generating code, use token names (Tailwind classes or CSS vars), never raw hex values.**

---

## 0. Quick start

```html
<!-- Option A: CSS variables (from tokens.css, auto-imported by index.css) -->
<button style="
  background: var(--accent);
  color: var(--fsy-ink);
  border: var(--bw-2) solid var(--fsy-ink);
  border-radius: var(--r-pill);
  box-shadow: var(--shadow-sticker);
  padding: 10px 20px;
  font-family: var(--font-cute);
">Make a pattern</button>
```

```jsx
// Option B: Tailwind 4 utilities
<button className="bg-cotton text-ink border-[3px] border-ink rounded-pill shadow-sticker px-5 py-2 font-cute hover:bg-accent-hover">
  Make a pattern
</button>

// Option C: Prebuilt composite classes (recommended)
<button className="fsy-btn bg-cotton">Make a pattern</button>
<div className="fsy-card">...</div>
<input className="fsy-input" placeholder="Your name" />
<span className="fsy-tag">A4</span>
```

---

## 1. Color

Fusiey uses **two** color systems. Do not mix them.

### 1.1 Brand colors — for UI chrome

| Token | Hex | Role |
|---|---|---|
| `ink` | `#572C5F` | Every outline. Every piece of body text. **Never pure black.** |
| `ink-soft` | `#653366` | Secondary text |
| `ink-hint` | `#8F6A93` | Tertiary / placeholder |
| `blush` | `#FCDFE5` | Default page background |
| `paper-warm` | `#FDF7F6` | Default card surface |
| `paper` | `#FFFFFF` | Inner well (inputs, designer canvas) |
| `cotton` | `#F7A5B8` | **Primary action** (button fill) |
| `peach-candy` | `#FDC6A9` | Warning |
| `butter` | `#FFF4C0` | Highlight / focus fill / selection |
| `mint` | `#B8DFCA` | Success |
| `sky-candy` | `#AFDCEB` | Info |
| `lilac` | `#E1B8DF` | Decorative secondary |

> **Naming note**: `peach-candy` and `sky-candy` are suffixed to avoid colliding with legacy v1 tokens `brand-peach` and `brand-sky`. The underlying CSS vars are `--color-peach-candy`, `--color-sky-candy`.

**Rules**

- Every card, button, input, tag has a **plum outline** (`border-ink`). Never a grey border.
- Buttons carry a **hard offset shadow** (`shadow-sticker`). Never a blurred shadow.
- On hover, combine `translate(-1px,-1px)` + `shadow-sticker-hover` to lift the sticker. `fsy-btn` does this automatically.
- On active, combine `translate(2px,2px)` + `shadow-press` to press down.
- Selection highlight and `:focus` input background are **always** butter (`#FFF4C0`).

### 1.2 MARD-221 bead palette — for physical products

The MARD-221 palette represents the **actual** perler-bead color codes customers own. Use these on product pages, BOM tables, pattern cells, and anywhere a physical bead is referenced.

Two kits exist:

- **PALETTE_24** — starter kit, 24 colors, ~3 steps per family.
- **PALETTE_48** — extended kit, 48 colors (24 starters + 24 additions) for fine portrait/illustration work.

Codes follow the pattern `{family}{index}`:

| Family | Theme | Tokens |
|---|---|---|
| **A** | Yellow / Orange | `A4 A6 A7` · +`A10 A11 A13` |
| **B** | Green | `B3 B5 B8` · +`B12` |
| **C** | Cyan / Blue | `C3 C5 C8` · +`C2 C6 C7 C10 C11 C13` |
| **D** | Purple | `D6 D7 D9` · +`D3 D13 D15 D18 D19 D21` |
| **E** | Pink | `E2 E4` · +`E3 E7 E8` |
| **F** | Red | `F5` · +`F8 F13` |
| **G** | Cream / Brown | `G1 G5 G7` · +`G8 G9 G13` |
| **H** | Grayscale | `H1 H2 H3 H4 H5 H7` |

Access:

- CSS: `var(--bead-A4)`, `var(--bead-E2)`, `var(--bead-H1)` …
- Tailwind: `bg-bead-A4`, `text-bead-H7`, `border-bead-E2` …
- JSON: `color.bead.A_yellow_orange.A4.$value`

> ⚠️  **Hex mismatch with `client/src/constants/palettes.ts`** — the hex values exposed here (from `tokens.json`) currently diverge from `palettes.ts`, which is the source of truth for pattern generation and physical ordering. The `--bead-*` vars are safe for UI preview styling, but **do not render a pattern from them**. A reconciliation decision is tracked in `PROJECT_PLAN.md`.

**Rules**

- Always show the code alongside the color swatch on product UI: `A4 · yellow · #FFDC3A`.
- When rendering a bead as a perler in UI, use the `.fsy-bead` utility (border-radius + plastic highlight) and apply `bg-bead-{code}`.
- Empty pattern cells should use `.fsy-peg-empty` to mimic the peg grid.

---

## 2. Typography

Five families. **Do not substitute.** Each has a job; misusing them breaks the kawaii feel.

| Family | Token | Use for |
|---|---|---|
| Press Start 2P | `font-display` | Hero wordmark, hero headline. Sparingly — heavy texture. |
| Pixelify Sans | `font-pixel` | Subheads that need a pixel feel but must stay readable. |
| Nunito | `font-body` | **Default** body, paragraphs, forms, most UI. |
| Fredoka | `font-cute` | Button labels, H2/H3, playful UI labels. |
| VT323 | `font-pixel-mono` | SKU codes, tags, timestamps, pixel readouts. Bumped to `18px`. |

> **Naming note**: the canonical spec calls this `font-mono`, but `font-mono` is reserved for the legacy v1 mono (JetBrains Mono) to avoid breaking existing code. Use `font-pixel-mono` for VT323 in new work.

### Scale

| Token | px | Line-height | Letter-spacing |
|---|---|---|---|
| `display` | 40 | 1.15 | 0.02em |
| `h1` | 32 | 1.15 | 0.02em |
| `h2` | 24 | 1.3 | 0 |
| `h3` | 20 | 1.3 | 0 |
| `h4` | 16 | 1.3 | 0.08em (uppercase) |
| `body` | 16 | 1.5 | 0 |
| `small` | 14 | 1.5 | 0 |
| `tiny` | 12 | 1.3 | 0 |
| `pixel-mono` | 18 | 1 | 0 |

### Default tag → style mapping

```css
h1 { font-family: var(--font-display); font-size: 32px; }
h2 { font-family: var(--font-cute);    font-size: 24px; font-weight: 700; }
h3 { font-family: var(--font-cute);    font-size: 20px; font-weight: 600; }
h4 { font-family: var(--font-body);    font-size: 16px; font-weight: 800;
     text-transform: uppercase; letter-spacing: 0.08em; }
p, body { font-family: var(--font-body); font-size: 16px; line-height: 1.5; }
code, .mono { font-family: var(--font-pixel-mono); font-size: 18px;
              background: var(--fsy-butter);
              border: 2px solid var(--fsy-ink); border-radius: 6px;
              padding: 1px 6px; }
```

---

## 3. Spacing, radii, borders, shadows

### Spacing — 8pt grid (with 4pt half-step)

```
s-0 0   s-1 4   s-2 8   s-3 12  s-4 16
s-5 24  s-6 32  s-7 48  s-8 64  s-9 96
```

### Radii

| Token | px | When |
|---|---|---|
| `rounded-pixel` | 0 | Pixel art, bead cells, anything meant to feel physical |
| `rounded-sm` | 6 | Tags, code pills |
| `rounded-md` | 10 | Inputs |
| `rounded-lg` | 16 | **Cards (default)** |
| `rounded-xl` | 24 | Hero surfaces |
| `rounded-pill` | 999 | **Buttons (default)** |

### Border widths

`2px` · **`3px` (canonical)** · `4px` · `6px`

### Shadows — sticker system

All shadows are **hard, offset, plum, zero blur**. Think: vinyl sticker peeled off the page.

| Token | Value | When |
|---|---|---|
| `shadow-sticker` | `3px 3px 0 0 #572C5F` | Resting state, cards + buttons |
| `shadow-sticker-hover` | `4px 4px 0 0 #572C5F` | Paired with `translate(-1px,-1px)` on `:hover` |
| `shadow-sticker-lg` | `6px 6px 0 0 #572C5F` | Hero surfaces |
| `shadow-press` | `1px 1px 0 0 #572C5F` | Paired with `translate(2px,2px)` on `:active` |
| `shadow-inset-ink` | `inset 0 0 0 3px #572C5F` | "Sunken" state |
| `shadow-glow-pink` | `0 0 0 6px rgba(247,165,184,0.25)` | Rare dreamy moments only |

**Never** use Tailwind's default blurred shadows (`shadow-md`, `shadow-lg`, `shadow-xl`) in new v2 work.

---

## 4. Motion

| Token | Value | When |
|---|---|---|
| `duration-fast` | 120ms | Hover micro-feedback |
| `duration-base` | 200ms | Default |
| `duration-slow` | 360ms | Mode switches, sheet slides |
| `ease-bounce` | `cubic-bezier(.34, 1.56, .64, 1)` | Button press, mascot wiggle, sticker lift |
| `ease-out` | `cubic-bezier(.22, 1, .36, 1)` | Everything else |

Prefer `ease-bounce` for anything touched by the user; it reinforces the "toy" feel.

---

## 5. Components (resolved tokens)

### Button (`.fsy-btn`)

```
height       : 44px  (sm 32, lg 52)
padding-x    : 20px
radius       : pill (999)
border       : 3px solid ink
shadow       : shadow-sticker (rest) → sticker-hover (hover) → press (active)
font         : cute, 16px, weight 600
color        : ink
background   : cotton (primary) | mint | sky-candy | butter | peach-candy | lilac | paper (ghost)
```

Hover: `transform: translate(-1px,-1px)` + `shadow-sticker-hover`.
Active: `transform: translate(2px,2px)` + `shadow-press`.

### Card (`.fsy-card`)

```
background : paper-warm
border     : 3px solid ink
radius     : 16 (rounded-lg)
padding    : 24 (space 5)
shadow     : sticker
```

### Input (`.fsy-input`)

```
height       : 44px
padding-x    : 14px
radius       : 10 (rounded-md)
border       : 3px solid ink
background   : paper (rest) → butter (:focus)
shadow       : sticker
font         : body, 16px
placeholder  : ink-hint
```

### Tag / SKU pill (`.fsy-tag`)

```
background : butter
border     : 2px solid ink
radius     : 6 (rounded-sm)
padding    : 3px 8px 1px
font       : pixel-mono (VT323), 18px
color      : ink
```

---

## 6. Brand assets

| Asset | Path | Status |
|---|---|---|
| Wordmark SVG | `/fusiey-wordmark.svg` | ⚠️ not yet created — existing logos are `/logo-main.svg`, `/logo-hero.svg` |
| Mascot (full) | `/fusiey-mascot-full.svg` | ⚠️ not yet created |
| Mascot scene | `/fusiey-mascot-scene.svg` | ⚠️ not yet created |
| Legacy logo (main) | `/logo-main.svg` | ✅ exists |
| Legacy logo (hero) | `/logo-hero.svg` | ✅ exists |

**Rules**

- Never recolor the mascot. The plum outline (`#572C5F`) and blush body are identity.
- Wordmark must sit on blush, cream, or paper — never on a candy pastel directly.
- Minimum wordmark width: 96px.

---

## 7. Do / Don't

✅ **Do**
- Use the plum outline on every card, button, input, badge.
- Pair every hover with a hard-shadow lift + 1–2px translate (or use `.fsy-btn` / `.fsy-sticker`).
- Show bead codes (`A4`, `E2`, `H1`…) in `font-pixel-mono` alongside color swatches.
- Use `.fsy-peg-empty` to mark empty pattern cells.
- Use `butter` for every focused / selected state.

❌ **Don't**
- Don't use pure black (`#000`) anywhere. Ink is `#572C5F`.
- Don't use blurred shadows (`shadow-md`, `shadow-lg`, etc.) in v2 components.
- Don't mix brand pastels into the bead palette, or vice versa.
- Don't swap `font-cute` for `font-body` on button labels — buttons feel flat without Fredoka.
- Don't render beads as squares — they are round, with a plastic highlight (use `.fsy-bead`).

---

## 8. File index

| File | Purpose |
|---|---|
| `client/src/styles/tokens.json` | W3C design-tokens source of truth |
| `client/src/styles/tokens.css` | CSS custom properties (auto-imported by index.css) |
| `client/src/styles/index.css` | Tailwind 4 `@theme` exposing tokens as utilities + composite classes |
| `docs/DESIGN_SYSTEM.md` | This doc |

---

## 9. Migration notes (v1 → v2)

- The project still contains **193 references** to legacy v1 tokens (`bg-surface`, `text-text-primary`, `border-border-light`, `brand-purple*`, etc.) across 7 files. These are preserved in `index.css` and continue to work. New UI work should target v2 tokens.
- **No `tailwind.preset.js`** — the project uses Tailwind 4 (CSS-first `@theme`), so the legacy v3-style preset is not applicable. All utilities are exposed via `@theme` in `index.css`.
- `constants/palettes.ts` hex values have not been synced to v2 tokens. Leave as-is until a product decision is made; `--bead-*` is for UI preview only.
