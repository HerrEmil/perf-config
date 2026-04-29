#!/usr/bin/env node
// Render the size-limit history dashboard.
//
// Inputs:
//   --history <dir>   Directory containing per-site NDJSON files (one per site).
//                     Each line: {"ts":"<ISO>","name":"<metric>","size":<bytes>,"limit":<bytes>,"passed":<bool>}
//   --out <dir>       Output directory (will contain index.html).
//
// Output: a single self-contained index.html with inline SVG sparklines.
// No JS, no network deps — opens straight from gh-pages.

import { readdirSync, readFileSync, writeFileSync, mkdirSync, existsSync } from "node:fs";
import { join, basename, extname } from "node:path";

const args = Object.fromEntries(
  process.argv.slice(2).reduce((acc, v, i, a) => {
    if (v.startsWith("--")) acc.push([v.slice(2), a[i + 1]]);
    return acc;
  }, []),
);

const historyDir = args.history;
const outDir = args.out;
if (!historyDir || !outDir) {
  console.error("usage: render-size-dashboard.mjs --history <dir> --out <dir>");
  process.exit(2);
}

mkdirSync(outDir, { recursive: true });

const sites = existsSync(historyDir)
  ? readdirSync(historyDir)
      .filter((f) => extname(f) === ".ndjson")
      .map((f) => basename(f, ".ndjson"))
      .sort()
  : [];

const fmtKB = (b) => `${(b / 1024).toFixed(1)} KB`;

function sparkline(points, { width = 200, height = 40, limit } = {}) {
  if (points.length === 0) return "";
  const xs = points.map((_, i) => i);
  const ys = points.map((p) => p.size);
  const ymax = Math.max(...ys, limit ?? 0) * 1.05;
  const ymin = 0;
  const sx = (i) => (xs.length === 1 ? width / 2 : (i / (xs.length - 1)) * width);
  const sy = (y) => height - ((y - ymin) / (ymax - ymin || 1)) * height;
  const path = ys.map((y, i) => `${i === 0 ? "M" : "L"}${sx(i).toFixed(1)},${sy(y).toFixed(1)}`).join(" ");
  const limitLine = limit
    ? `<line x1="0" y1="${sy(limit).toFixed(1)}" x2="${width}" y2="${sy(limit).toFixed(1)}" stroke="#c00" stroke-dasharray="3,3" stroke-width="1"/>`
    : "";
  const last = points[points.length - 1];
  const lastColor = last.passed === false ? "#c00" : "#0a0";
  return `
    <svg viewBox="0 0 ${width} ${height}" width="${width}" height="${height}" role="img" aria-label="size history sparkline">
      ${limitLine}
      <path d="${path}" fill="none" stroke="#333" stroke-width="1.5"/>
      <circle cx="${sx(xs.length - 1).toFixed(1)}" cy="${sy(ys[ys.length - 1]).toFixed(1)}" r="2.5" fill="${lastColor}"/>
    </svg>`;
}

function siteSection(site) {
  const lines = readFileSync(join(historyDir, `${site}.ndjson`), "utf8")
    .split("\n")
    .filter(Boolean)
    .map((l) => JSON.parse(l))
    .sort((a, b) => a.ts.localeCompare(b.ts));
  if (lines.length === 0) return "";

  const byMetric = new Map();
  for (const r of lines) {
    if (!byMetric.has(r.name)) byMetric.set(r.name, []);
    byMetric.get(r.name).push(r);
  }

  const rows = [...byMetric.entries()]
    .sort(([a], [b]) => a.localeCompare(b))
    .map(([metric, points]) => {
      const last = points[points.length - 1];
      const status = last.passed === false ? "FAIL" : "ok";
      const statusColor = last.passed === false ? "#c00" : "#0a0";
      return `
        <tr>
          <td>${metric}</td>
          <td>${sparkline(points, { limit: last.limit })}</td>
          <td style="text-align:right">${fmtKB(last.size)}</td>
          <td style="text-align:right; color:#666">${last.limit ? fmtKB(last.limit) : "—"}</td>
          <td style="text-align:right; color:${statusColor}; font-weight:bold">${status}</td>
          <td style="text-align:right; color:#666">${points.length}</td>
        </tr>`;
    })
    .join("");

  return `
    <section>
      <h2>${site}</h2>
      <table>
        <thead>
          <tr>
            <th>metric</th><th>history</th><th>latest</th><th>limit</th><th>status</th><th>runs</th>
          </tr>
        </thead>
        <tbody>${rows}</tbody>
      </table>
    </section>`;
}

const sections = sites.map(siteSection).filter(Boolean).join("\n");
const generatedAt = new Date().toISOString();

const html = `<!doctype html>
<html lang="en">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width, initial-scale=1">
<title>size-limit dashboard — herremil sites</title>
<style>
  body { font: 14px/1.5 system-ui, sans-serif; max-width: 920px; margin: 2rem auto; padding: 0 1rem; color: #222; }
  h1 { font-size: 1.4rem; margin-bottom: 0.25rem; }
  h2 { font-size: 1.1rem; margin-top: 2rem; border-bottom: 1px solid #ddd; padding-bottom: 0.25rem; }
  p.subtitle { color: #666; margin-top: 0; }
  table { width: 100%; border-collapse: collapse; margin-top: 0.5rem; }
  th, td { padding: 0.4rem 0.6rem; border-bottom: 1px solid #eee; vertical-align: middle; }
  th { text-align: left; color: #666; font-weight: normal; font-size: 0.85rem; }
  td:first-child { font-family: ui-monospace, monospace; }
  svg { display: block; }
  footer { margin-top: 3rem; color: #999; font-size: 0.85rem; }
  footer a { color: #06a; }
</style>
</head>
<body>
<h1>size-limit dashboard</h1>
<p class="subtitle">JS/CSS bundle size history per herremil site. Sparkline = bundle size over time; dashed red line = limit.</p>
${sections || "<p><em>No history yet. Sites with a <code>.size-limit.json</code> will appear here after the next dashboard run.</em></p>"}
<footer>
  Generated ${generatedAt} by
  <a href="https://github.com/HerrEmil/perf-config/blob/main/.github/workflows/size-limit-dashboard.yml">size-limit-dashboard.yml</a>
  in <code>HerrEmil/perf-config</code>.
</footer>
</body>
</html>`;

writeFileSync(join(outDir, "index.html"), html);
console.log(`wrote ${join(outDir, "index.html")} (${sites.length} site(s))`);
