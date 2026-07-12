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

Commit: `cv@532c92a`. Verified: full `lighthouse:no-pwa` autorun green
(perf/a11y/bp/seo all 1.00, LCP 1506 ms, CLS 0, TBT 0), asset-guard PASS,
html-validate + stylelint clean.

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
