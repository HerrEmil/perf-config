#!/usr/bin/env node
import { readFile } from 'node:fs/promises';

const path = process.argv[2];
if (!path) {
  console.error('usage: budgets-to-lhci.mjs <budgets-json>');
  process.exit(2);
}

const raw = await readFile(path, 'utf8');
const parsed = JSON.parse(raw);
const budgets = Array.isArray(parsed) ? parsed : (parsed.budgets ?? [parsed]);

const assertions = {};

const err = (n) => ['error', { maxNumericValue: n }];

for (const b of budgets) {
  for (const t of b.timings ?? []) {
    if (t.metric != null && t.budget != null) {
      assertions[t.metric] = err(t.budget);
    }
  }
  for (const r of b.resourceSizes ?? []) {
    if (r.resourceType && r.budget != null) {
      assertions[`resource-summary:${r.resourceType}:size`] = err(r.budget * 1024);
    }
  }
  for (const r of b.resourceCounts ?? []) {
    if (r.resourceType && r.budget != null) {
      assertions[`resource-summary:${r.resourceType}:count`] = err(r.budget);
    }
  }
}

process.stdout.write(JSON.stringify({ assertions }, null, 2) + '\n');
