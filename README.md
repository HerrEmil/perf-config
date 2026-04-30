# perf-config

## Purpose

Shared source of truth for performance rules across all herremil sites. Reusable GitHub Actions workflow, Lighthouse budgets, and asset tooling — one place to bump thresholds, every site picks them up.

## Architecture

`perf-config` is a **standalone GitHub repo**. Each consuming site is its own independent repo and pulls perf-config in via a GitHub Actions reusable workflow:

```yaml
uses: HerrEmil/perf-config/.github/workflows/perf.yml@v1
```

The reusable workflow checks out the calling site as the workspace root (the code being audited) and checks out perf-config into `./.perf-config/` (tools and configs). Sites pin to a tag (`@v1`) to receive patch updates automatically.

| Piece | Path | Role |
|---|---|---|
| Reusable workflow | `.github/workflows/perf.yml` | Cross-repo entry point; called by each site |
| Example consumer | `examples/calling-workflow.yml` | Copy-paste template for new sites |
| Base budgets | `perf-budgets.json` | Lighthouse budgets schema, default profile |
| Tier variants | `perf-budgets.static.json`, `perf-budgets.game.json` | Tier-specific size envelopes |
| LHCI config | `lighthouserc.json` | Mobile preset, score floors, budget pointer |
| Asset guard | `tools/asset-guard.sh` | Fail-fast: banned formats, size caps, `.DS_Store`, content-hash |
| Asset hasher | `tools/hash-assets.mjs` | Content-hash assets, rewrite HTML/CSS refs |
| Budgets bridge | `tools/budgets-to-lhci.mjs` | Derive LHCI assertions from budgets |
| HTML lint | `html-validate.config.json` | Shared html-validate ruleset (perf + a11y errors) |
| CSS lint | `.stylelintrc.json` | Shared stylelint ruleset (bans `@import`, vendor prefixes, etc.) |

## Page tiers

| Tier | Profile | Sites |
|---|---|---|
| T1 | Static | herremil.com, cv |
| T2 | SPA | chess |
| T3 | Game shell | sandpiper, legendaryjourney, gameland |
| T4 | Backend | lunch (separate, not enforced via this workflow) |

## Threshold cheat sheet

Timings are identical across tiers. Resource sizes (KB) differ.

| Tier | LCP | CLS | TBT | TTI | Total | JS | CSS | Image | Font |
|---|---|---|---|---|---|---|---|---|---|
| Static | 1800 | 0.05 | 180 | 2500 | 250 | 45 | 20 | 100 | 40 |
| SPA (default) | 1800 | 0.05 | 180 | 2500 | 600 | 5 | 8 | 450 | 80 |
| Game | 1800 | 0.05 | 180 | 2500 | 5000 | 45 | 25 | 2000 | 80 |

Score floors (LHCI): performance ≥ 0.92, a11y = 1.0, best-practices ≥ 0.95, SEO ≥ 0.95. Third-party budget = 0.

## Integrating a new site

Each site is a separate GitHub repo. Steps:

1. Copy `examples/calling-workflow.yml` to `<site-repo>/.github/workflows/perf.yml`.
2. Replace `HerrEmil` with the real GitHub owner/org of perf-config.
3. Edit the `with:` block — set `site_dir`, `build_cmd`, `tier`, `package_manager`.
4. (Optional) `<site-repo>/lighthouserc.json` to override the shared LHCI config.
5. (Optional) `<site-repo>/perf-budgets.override.json` — deep-merged onto base.
6. (Optional) `<site-repo>/.size-limit.json` for JS/CSS bundle deltas.
6a. (Optional) `<site-repo>/html-validate.config.json` and/or `.stylelintrc.json` to extend or override shared lint rules. Without these, the shared configs in perf-config are used and lint errors fail the gate.
6b. (Optional) `<site-repo>/.asset-guard-override.json` — exempt specific files from asset-guard failures until a sunset date:
    ```json
    { "exempt": [{ "path": "fonts/avenir.otf", "sunset": "2026-09-30", "reason": "task 26 deferred" }] }
    ```
    Paths are relative to `site_dir`. Past `sunset`, the file fails again.
7. Smoke-test locally: clone perf-config sibling to your site, run `bash ../perf-config/tools/asset-guard.sh dist`.
8. Open PR — gate runs.

**Static sites without a `package.json`** (hand-written HTML/CSS, no toolchain): set `package_manager: none` in the `with:` block. Skips Node install, build, and size-limit; asset-guard / LHCI / html-validate / stylelint still run via `npx`.

Use the chess repo as the canonical reference; copy its config to bootstrap.

## Versioning

Sites pin to a tag in their `uses:` line. Recommended pinning strategy:

| Ref | Behavior |
|---|---|
| `@v1` | Tracks the latest `v1.x.y` — gets patches automatically. **Default.** |
| `@v1.0.0` | Immutable; no auto-updates. Pin here only when stability matters more than fixes. |
| `@main` | Cutting edge; for testing in-flight changes. Not for prod gates. |

Tags are cut on every release:
- `v1.0.0`, `v1.0.1`, … patch tags
- `v1` floating tag, force-updated to point at the latest `v1.x.y`
- Breaking changes → bump to `v2`, sites opt in by editing their `uses:` ref.

## Local dev

```bash
# from any site dir, with perf-config cloned as a sibling
bash ../perf-config/tools/asset-guard.sh dist
node ../perf-config/tools/hash-assets.mjs dist
npx lhci autorun --config=lighthouserc.json
```

## Threshold updates

Edit `perf-budgets.json` (or tier variant), commit, retag `v1` → all sites pinned to `@v1` pick it up on their next CI run. Per-site override: drop a `perf-budgets.override.json` in the site repo — same key wins from override (deep merge).

## Failure modes

- LCP flake → 3-run median, retry once
- CI cost → ~3 min full job; skip on docs-only via `paths-ignore`
- Pilot site (chess) is the canonical example — copy its config to bootstrap others
- Asset-guard fails on: `.DS_Store`, `.otf`/`.ttf`/`.eot`/`.woff`, `.tiff`/`.gif`/`.bmp`, images > 200 KB
- Asset-guard warns on: images > 100 KB, woff2 > 35 KB, missing content-hash, stray sourceMappingURL

## Monitoring crons

| Workflow | Cron | What it does |
|---|---|---|
| `lhci-weekly.yml` | Mon 06:00 UTC | Per-site LHCI against each prod URL using that site's own `lighthouserc.json` (same bar as the on-PR gate, run with `collect.url` rewritten to the live URL). Opens regression issue after **2 consecutive** failures. State on `lhci-state` orphan branch. |
| `size-limit-dashboard.yml` | Mon 07:00 UTC | Builds each site, runs `size-limit --json`, appends to `size-limit-history`, renders sparkline dashboard to `gh-pages` (https://herremil.github.io/perf-config/). |

Cross-repo issue creation needs a `HERREMIL_ISSUE_TOKEN` repo secret (PAT with `repo` scope). Without it, `lhci-weekly.yml` falls back to opening the issue in `perf-config` itself.

## Roadmap (deferred)

- web-vitals RUM beacon → CloudFront Function → S3 NDJSON → Athena
- Synthetic TTFB cron for lunch.herremil.com
- Per-site action items: woff2 conversion, AVIF re-encode, asm.js drop, AWS SDK trim (see ruleset §8)

---

## Appendix: Repo bootstrap (push to GitHub)

This repo is initialized locally but not yet pushed. To make it consumable from other repos:

```bash
cd perf-config

# 1. Create the remote repo (public so reusable workflows can be referenced
#    from other repos without a PAT). Pick an owner — user or org.
gh repo create <owner>/perf-config --public --source=. --remote=origin --description="Shared perf gate for herremil sites"

# 2. Push main + tags.
git push -u origin main
git push --tags

# 3. Replace HerrEmil in:
#      - .github/workflows/perf.yml  (the `repository:` field)
#      - examples/calling-workflow.yml  (the `uses:` line)
#      - README.md  (the `uses:` example near the top)
#    Commit, retag v1, push.

# 4. Each consuming site repo: copy examples/calling-workflow.yml into
#    that repo's .github/workflows/, replace HerrEmil, commit, push.
```
