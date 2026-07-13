# CWV Lab — ledger

Running ledger for the `burn-perf-cwv-lab` routine. Each run closes the single
next-biggest Core-Web-Vitals or accessibility gap on **one** of the tracked
static sites (`HerrEmil.com`, `cv`), proves it moved with a re-audit, and logs
it here. **Before picking a target, read this file** — never re-attempt a fix
already applied or a lever already marked exhausted / intentionally-off.

Audit method: `npx @lhci/cli autorun` (3 runs, `lighthouse:no-pwa` preset) via
each site's own `lighthouserc.json`, plus `asset-guard.sh`, `html-validate`,
`stylelint`. Gate thresholds: perf ≥ 0.92, a11y = 1.0, best-practices ≥ 0.95,
seo ≥ 0.95, LCP ≤ 1800 ms, CLS ≤ 0.05, TBT ≤ 180 ms, TTI ≤ 2500 ms.

## Fixes applied

| Date | Site | Metric | Before → After | Change |
|------|------|--------|----------------|--------|
| 2026-07-12 | cv | accessibility | **0.93 → 1.00** | `h2` date-range `<span>`s were `color: grey` (#808080, 3.94:1 on white) — failed WCAG AA on 14 nodes. Darkened to `#666` (5.7:1). |
| 2026-07-12 | cv | best-practices | **0.96 → 1.00** | No favicon → Chrome requested `/favicon.ico` → 404 logged as a console error (`errors-in-console`). Added an inline `data:` SVG favicon (no extra request). |
| 2026-07-13 | HerrEmil.com | accessibility (axe landmarks) | **2 violations → 0** | Homepage (en + sv) + 404 had no `<main>` landmark — all content sat in plain `<div>`s, so axe-core flagged `landmark-one-main` + `region` on every page. Lighthouse's coarse a11y check missed it (stayed 1.00 — it scores neither rule). Promoted the `.main` content `<div>` to a native `<main>` element; the `.main` class is kept so all styling is unchanged (zero visual / CLS impact). |
| 2026-07-13 | cv | accessibility (axe landmarks) | **2 violations / 4 nodes → 0** | CV content sat in plain `<div>`s across three stacked `.a4` print-page divs — axe flagged `landmark-one-main` (no `<main>`) + `region` ×3 (the un-landmarked `.main` content of each page). Trickier than the HerrEmil.com fix: one `<main>` had to span all three page divs without a duplicate-main. Wrapped the three `.a4` divs in a single `<main>` (the CV is one continuous document; the splits are print-only pagination). `<main>` is a zero-box transparent block, so zero visual / print / CLS impact. Lighthouse a11y stayed 1.00 (doesn't score these rules). |

Commit: `cv@532c92a`. Verified: full `lighthouse:no-pwa` autorun green
(perf/a11y/bp/seo all 1.00, LCP 1506 ms, CLS 0, TBT 0), asset-guard PASS,
html-validate + stylelint clean.

Commit: `HerrEmil.com@25bf61d`. Verified: axe-core 4.12 in real Chrome (via
Playwright) — violations **2 → 0** on `/`, `/sv/index.html`, and `/404.html`;
full LHCI autorun green on `/` + `/sv/` (perf/a11y/seo 1.00, best-practices
0.96 — art-bound, see exhausted list; LCP 904 ms, CLS 0, TBT 0); asset-guard
PASS, html-validate + stylelint clean. No score regression vs baseline.

Commit: `cv@bd2e009`. Verified: axe-core 4.12 in real Chrome (via Playwright)
— violations **2 → 0**, nodes **4 → 0**, passes 23 → 25 on `/index.html`;
full LHCI autorun green (perf/a11y/bp/seo 1.00, LCP ~1505 ms, CLS 0, TBT 0,
TTI ~1505 ms); asset-guard PASS, html-validate + stylelint clean. DOM check:
exactly one `<main>`, all three `.a4` page divs its direct children, header
inside main, `break-after:page` + A4 heights intact in both screen and print
media (zero CLS / layout impact). No score regression vs baseline.

## Exhausted / at-ceiling / intentionally-off — do NOT re-attempt

- **cv `uses-responsive-images` / `image-delivery-insight`** — the headshot is
  540×734 for a 35 mm×47.5 mm slot. That is ~390 dpi, i.e. **intentionally
  hi-DPI for A4 print**; Lighthouse's DPR-1.75 screen heuristic wrongly wants it
  smaller. Turned **off** in `cv/lighthouserc.json` (mirrors HerrEmil.com's
  `image-size-responsive: off`). Do not shrink the headshot to chase these — it
  would degrade print/retina quality. perf is already 1.00 regardless.
- **HerrEmil.com (2026-07-12 audit)** — all 3 audited URLs (`/`, `/devlog/`,
  `/devlog/sandpiper.html`) passed the **full** gate with zero failing
  assertions. No sub-ceiling CWV/a11y gap was actionable this run.
- **HerrEmil.com `image-size-responsive` (best-practices stuck at 0.96)** — the
  10 game icons are authored at 128×128, which equals their on-page CSS size.
  Lighthouse's mobile-DPR heuristic wants ~192×192 and scores this audit 0,
  dragging best-practices to 0.96 (still ≥ 0.95 → gate-green; the assertion is
  already `off` in `lighthouserc.json`, but that only silences the *assertion*,
  not the *category score*). Confirmed 2026-07-13 there is **no higher-res
  source**: `_WIP/icon-template.psd` is 128×128 and the sibling game repos only
  hold ≤128 px / mismatched-style art. A real fix would need re-drawing the icon
  set at 2× (no source) or shrinking the on-page design — both out of scope.
  Upscaling 128→256 is metric-gaming (more bytes, no real detail) — do NOT.
  **Accepted at BP 0.96.**

## Candidate backlog (unverified — re-audit before acting)

Ranked rough-biggest-first. These are leads noted in passing, not yet measured
as gate failures; a future run must re-audit to confirm before implementing.

1. **cv fonts not content-hashed** — `fonts/bitter-latin.woff2`,
   `bitter-latin-italic.woff2`, `nunito-sans-300-latin.woff2` (asset-guard WARN).
   All > 5 KB so `hash-assets.mjs` would hash them; enables immutable caching.
   Cache-only win, doesn't move a Lighthouse score.
2. **No dark-mode support** — HerrEmil.com is `color-scheme: light` only; cv uses
   fixed light colors. Contrast passes, so not an a11y *failure*, but a real gap.
   Risk: a dark palette must re-clear contrast on the yellow (#fff200) accents.
3. **No `theme-color` meta** on either site (mobile browser-chrome polish).
4. **No JSON-LD / OpenGraph** on either site. A `Person` schema fits both;
   improves share previews. Note: Lighthouse scores structured-data as
   *manual*, so this won't move the numeric SEO score.
5. **HerrEmil.com png-only game icons** (no webp sibling): `icon-sandpiper`,
   `icon-fartgupp`, `icon-OBVIO`, `icon-sandGrains`, `icon-spyFly`,
   `icon-legendaryjourney`. All < 3 KB — marginal byte savings.
6. **HerrEmil.com below-the-fold icons** could take `loading="lazy"` (11 game
   icons; keep the first as the LCP candidate eager).

_(Item 7 — cv missing `<main>` / region — DONE 2026-07-13, see fixes table
`cv@bd2e009`.)_
