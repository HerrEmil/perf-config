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
| 2026-07-14 | cv | LCP (largest-contentful-paint) | **1504 → 1279 ms** (7-run median, −225 ms / ~15%) | LCP element is the intro `<p>` (body text in Nunito Sans), so the body font is the LCP-critical resource. Retuned the four `<head>` preloads: body font `nunito-sans` → `fetchpriority="high"` + listed first (wins bandwidth under Lantern throttling); `bitter-latin-italic` (below-the-fold job titles only) → `fetchpriority="low"` but **kept** as a preload; headshot avif → dropped its `fetchpriority="high"` (it is not the LCP element). FCP unchanged (614→615 ms), CLS 0, all four categories 1.00 — no regression. |
| 2026-07-14 | HerrEmil.com | accessibility (redundant heading name) | **20 → 0 headings** | Every game `<h2>` wrapped an icon whose `alt` duplicated the visible heading text (`<img alt="Sandpiper">Sandpiper`), so each heading's *accessible name* was the icon alt **concatenated** with the text → announced twice by screen readers ("SandpiperSandpiper") on all 10 games × en+sv = **20 headings**. axe/Lighthouse do **not** flag redundant *present* alt (it's not a WCAG violation), so it survived every prior pass — including the same-day "no actionable gap" note below, which relied on axe/LHCI cleanliness. The icon sits beside its own name → it's decorative: set `alt=""`. Heading accessible name now equals its visible text. |
| 2026-07-14 | cv | total-byte-weight (font payload) | **95.8 → 86.3 KiB** (EN; SV same, −9.5 KiB / ~10%) | Fonts were **70%** of the page's transfer weight. Each Google "latin" woff2 still carried ~230 glyphs (full Basic Latin + Latin-1 + Latin Extended-A **plus** currency/arrows/math/primes the CV never renders). Re-subset with `pyftsubset` to a future-safe Latin range (`U+0020-017F` + en/em dash, curly quotes, bullet, ellipsis) — covers every glyph both EN + SV use plus any European name Emil could add — keeping **all** layout features + hinting so rendering is byte-identical. Font payload **66848 → 57096 B (−14.6%)** (bitter −12%, bitter-italic −15%, nunito −18%). **Honest scope: this does NOT move LCP.** 40 interleaved Lantern runs (20 base / 20 after) → both median **~1279 ms, Δ +1 ms**; cv's LCP is at a font-byte-independent ~1279 ms floor (see exhausted). The win is real payload/bandwidth (~9.5 KiB less per visitor), not the LCP number. In-place subset (same filenames) — did NOT touch index.html/sv, to stay clear of the concurrent i18n task's HTML edits; the subsetted fonts are now un-hashed and want re-hashing (backlog #1). |
| 2026-07-14 | HerrEmil.com | dark-mode (`prefers-color-scheme`) | **absent → present, WCAG AA** | Portfolio was light-only. Added a purely additive `@media (prefers-color-scheme: dark)` block to all 3 locales + `color-scheme: light dark`; **light mode byte-identical → zero regression**. Dark palette: bg `#14161a`, text `#e8e6e3` (14.5:1), link `#c4664c` (4.62:1 on bg **and** 3.15:1 vs body text → clears axe `link-in-text-block`, mirroring light's clean no-underline links at 5.22/3.05), selection `#3a3f47`, footer band unchanged (white 6:1). Icons are opaque app-tiles → render fine on dark. axe-core 0 violations light+dark × en/sv/de. |

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

Commit: `cv@4f78c7b`. Verified: full LHCI autorun (cv `lighthouserc.json`)
exit 0 with every assertion green — perf/a11y/bp/seo 1.00, LCP ~1280 ms ≤ 1800,
CLS 0 ≤ 0.05, TBT 0 ≤ 180, TTI ~1289 ms ≤ 2500; asset-guard PASS, html-validate
clean, stylelint clean (no CSS). Measured with 7-run before/after medians on the
cv config: **LCP 1504 → 1279 ms** (before cluster 1503–1509; after cluster
1278–1281 — fully separated), **FCP 614 → 615 ms (unchanged)**, CLS 0 throughout.
Isolation runs (7 each) attributed the gain to font-preload prioritization, not
the headshot: removing the italic preload alone gave LCP 1355 ms but inflated
Lantern FCP to ~905 ms; keeping it as a `low` preload recovered FCP while the
`nunito high` + demoted headshot delivered the full LCP win. `observedFCP` stayed
~65 ms in every variant (the FCP swing was a Lantern-attribution artifact, never a
real first-paint change). Observed trace: all four preloads still finish < 45 ms
wall-clock; the win is entirely in Lantern's shared-bandwidth simulation.

Commit: `HerrEmil.com@62a08d0`. Verified: targeted metric = headings whose
accessible name ≠ visible text (the icon `alt` is concatenated into the `<h2>`
accessible name), measured by reconstructing each `<h2>`'s accessible name via
Playwright: **20 → 0** across `/` + `/sv/` (10 games each). axe-core 4.x re-run
**0 violations** on `/`, `/sv/`, `/404` in **light + dark** (passes 33/33/19
unchanged — no regression). LHCI autorun all assertions green, 0 failures
(perf/a11y/seo 1.00, bp 0.96 — exhausted `image-size-responsive`; LCP ~904 ms,
CLS 0, TBT 0 — identical to baseline). asset-guard PASS, html-validate +
stylelint exit 0. `alt=""` does not render on successfully-loaded local images
→ zero visual / CLS impact.

**HerrEmil.com — no *scored* gap this run (2026-07-14).** Re-audited both
locales + 404: axe-core 4.12 (headless + Playwright) clean — 0 violations,
0 incomplete across `wcag2a/aa, wcag21a/aa, wcag22aa, best-practice` and the
default ruleset. LHCI (6-run) perf/a11y/seo 1.00, bp 0.96 (only
`image-size-responsive`, exhausted), LCP ~905 ms (the LCP `<p>` is system-font
text — no webfont swap to optimize, unlike cv), CLS 0, TBT 0, zero
opportunity/diagnostic savings. **Correction (same day, later run):** axe/LHCI
cleanliness ≠ zero a11y gap. A *manual accessible-name pass* — which no axe rule
covers — surfaced the redundant in-heading icon `alt` (doubled heading names),
fixed above in `HerrEmil.com@62a08d0`. Lesson for future runs: always
reconstruct heading/landmark accessible names by hand even when axe is green.

Commit: `cv@6ff5d89`. Verified: font payload **66848 → 57096 B** (−9752 B,
−14.6%) with **no tofu** — every used codepoint present in all three subsets,
proven two ways: `fontTools` cmap coverage of all 78 EN+SV glyphs, and
`document.fonts.check` in real Chrome (Playwright) over every unique glyph on
both `/index.html` and `/sv/index.html` → 0 missing, all three faces `loaded`,
correct face per element (intro `<p>`=Nunito 300, `h1`=Bitter 700, `h2`=Bitter
*italic* 600, `h2 span`=Nunito). Gate: `lhci assert` **exit 0** — both URLs
perf/a11y/bp/seo **1.00**, LCP 1279–1280 ms, CLS 0, TBT 0; asset-guard PASS
(fonts still WARN-unhashed — see backlog #1), html-validate clean, no CSS for
stylelint. LCP proof-of-flat: 40 interleaved single-URL Lantern runs
(BASE n=20 median 1279, σ=2.3; AFTER n=20 median 1280) → Δ +1 ms; the ~1354 ms
AFTER outliers are intermittent CPU-throttle spikes (BASE showed them in the
pre-i18n run too), not a font effect. **Kept the subset future-safe** (whole
Latin range, not exact-glyph) per the standing tofu caution. Committed **only**
`fonts/*.woff2` by explicit path — the concurrent i18n task owns index.html.

Commit: `HerrEmil.com@89d207e`. Verified: dark-mode support added to all three
locales as an additive `@media (prefers-color-scheme: dark)` block (+
`color-scheme: light dark`); **light-mode CSS byte-identical**, so the passing
gate is untouched. axe-core 4.12.1 in real Chrome (Playwright `colorScheme`
emulation) over `wcag2a/2aa, wcag21a/aa, wcag22aa, best-practice`: **0
violations / 33 passes / 0 incomplete** on en+sv+de in **both** light and dark —
incl. `color-contrast` and `link-in-text-block`. Computed styles confirmed the
dark palette actually applied (html bg #14161a, text #e8e6e3, link #c4664c,
color-scheme "light dark"). LHCI autorun (3 runs × 3 URLs) **exit 0**, every
assertion green (perf/a11y/seo 1.00, bp 0.96 — the exhausted `image-size-
responsive` ceiling; LCP ~904 ms, CLS 0, TBT 0 — identical to baseline).
asset-guard PASS, html-validate + stylelint exit 0. Visual pass (full-page
screenshots, both schemes): light pixel-unchanged; dark clean + readable, no
icon clash. Contrast math: text 14.5:1, link 4.62:1 on bg + 3.15:1 vs text,
footer white 6:1 — all ≥ AA. **cv deliberately NOT given dark mode** (it is a
print/paper A4 document; a dark "sheet of paper" breaks the metaphor + print CSS).

## Exhausted / at-ceiling / intentionally-off — do NOT re-attempt

- **cv LCP is font-*byte*-independent (~1279 ms Lantern floor)** — proven
  2026-07-14 (`cv@6ff5d89`): re-subsetting all three fonts −14.6 % (−9.75 KiB,
  incl. −18 % on the LCP-critical Nunito body font) moved LCP by **+1 ms** over
  40 interleaved runs. The prior run (`cv@4f78c7b`) already took the LCP win
  from font *preload priority* (bandwidth contention); once that is tuned, the
  remaining ~1279 ms is set by FCP + the swap/layout paint of the intro `<p>`,
  which fewer font *bytes* do not touch. **Do NOT chase cv LCP via font size or
  further preload reshuffling.** (Byte-weight is still worth reducing on its own
  merits — that's what this fix did — just don't expect the LCP number to move.)

- **cv `uses-responsive-images` / `image-delivery-insight`** — the headshot is
  540×734 for a 35 mm×47.5 mm slot. That is ~390 dpi, i.e. **intentionally
  hi-DPI for A4 print**; Lighthouse's DPR-1.75 screen heuristic wrongly wants it
  smaller. Turned **off** in `cv/lighthouserc.json` (mirrors HerrEmil.com's
  `image-size-responsive: off`). Do not shrink the headshot to chase these — it
  would degrade print/retina quality. perf is already 1.00 regardless.
- **HerrEmil.com (2026-07-12 audit)** — all 3 audited URLs (`/`, `/devlog/`,
  `/devlog/sandpiper.html`) passed the **full** gate with zero failing
  assertions. No sub-ceiling CWV/a11y gap was actionable this run.
- **cv "just remove the Bitter-italic preload"** — do NOT. Isolation-tested
  2026-07-14: dropping the `<link rel=preload>` for `bitter-latin-italic.woff2`
  entirely makes the browser discover the font late (during layout, when the
  first italic `<h2>` job title needs it) and fetch it at **VeryHigh**, which
  pulls it into Lantern's FCP dependency graph and inflates simulated FCP
  ~612 → ~905 ms — for no LCP gain beyond keeping it at `fetchpriority="low"`.
  The shipped fix (`cv@4f78c7b`) keeps it preloaded at **low** priority. Keep it.
- **cv LCP font-preload priority** — tuned 2026-07-14 (`cv@4f78c7b`, LCP
  1504→1279 ms). The `<head>` preload priorities are now at their useful ceiling
  for the Lantern model. Further LCP gains would require the exhausted headshot
  downsize (off) or font subsetting (backlog) — do not re-shuffle these hints.
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
   Cache-only win, doesn't move a Lighthouse score. **Now more relevant**
   (2026-07-14, `cv@6ff5d89`): the fonts were just re-subset in place under the
   same filenames, so returning visitors could serve a stale cached copy until
   TTL — content-hashing is the correct way to ship the changed bytes. NB: this
   edits index.html **and** `sv/index.html` (`../fonts/…` refs) — `hash-assets.mjs`
   rewrites both, but coordinate with the concurrent i18n task to avoid an
   index.html collision (or do it when cv's tree is quiet).
   **⚠ Reassessed 2026-07-14 — near-zero real-world value as-is; deprioritised.**
   Both sites' `deploy.yml` does a plain `aws s3 sync` with **no `Cache-Control`**
   headers AND a CloudFront `/*` invalidation on **every** deploy — so browsers
   never hold these assets long-term and edge staleness is already flushed each
   push. Content-hashing would therefore only silence the asset-guard WARN, not
   buy a real caching win, until immutable cache headers exist. Also a landmine:
   `hash-assets.mjs`'s `HASHED` regex wants `{10}` hex but cv's headshots are
   `{8}`-hex, so running the tool on cv `.` would **double-hash the headshots**.
   If ever pursued: (a) first add long-max-age `immutable` headers for hashed
   assets + short TTL for HTML in `deploy.yml` (that's the actual win), and
   (b) hash the fonts by hand / fix the `{10}`→`{8,}` regex — never run the tool
   blindly on cv.
2. ~~**No dark-mode support**~~ — **HerrEmil.com DONE 2026-07-14 (`89d207e`)**:
   additive `@media (prefers-color-scheme: dark)` on all 3 locales, axe-clean in
   dark, light untouched. **cv intentionally left light** — it is a print/paper
   A4 document (paper shadows + `#fff200` header highlight + print CSS); a dark
   "sheet of paper" breaks the metaphor. Do not add dark mode to cv.
3. **No `theme-color` meta** on either site (mobile browser-chrome polish).
4. **No JSON-LD / OpenGraph** on either site. A `Person` schema fits both;
   improves share previews. Note: Lighthouse scores structured-data as
   *manual*, so this won't move the numeric SEO score.
5. **HerrEmil.com png-only game icons** (no webp sibling): `icon-sandpiper`,
   `icon-fartgupp`, `icon-OBVIO`, `icon-sandGrains`, `icon-spyFly`,
   `icon-legendaryjourney`. All < 3 KB — marginal byte savings.
6. **HerrEmil.com below-the-fold icons** could take `loading="lazy"` (11 game
   icons; keep the first as the LCP candidate eager).
7. ~~**cv font subsetting**~~ — **DONE 2026-07-14, `cv@6ff5d89`.** Subset all
   three woff2 to a future-safe whole-Latin range (`U+0020-017F` + typographic
   punctuation), −14.6 % font payload (66848 → 57096 B), no tofu. Byte-weight
   win only — **it did NOT move LCP** (proven flat over 40 runs; cv LCP is now
   in the exhausted list as a font-byte-independent ~1279 ms floor). Kept a safe
   named range, not exact-glyph, per the tofu caution. Still un-hashed → feeds
   back into #1.

_(Item 7 — cv missing `<main>` / region — DONE 2026-07-13, `cv@bd2e009`.
 cv LCP font-preload priority — DONE 2026-07-14, `cv@4f78c7b`.
 Both sites' axe-core surface confirmed fully clean 2026-07-14, incl.
 WCAG 2.2 AA + best-practice + AAA tags, 0 violations / 0 incomplete.)_
