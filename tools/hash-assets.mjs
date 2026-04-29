#!/usr/bin/env node
import { readdir, readFile, writeFile, rename, stat } from 'node:fs/promises';
import { createHash } from 'node:crypto';
import { join, dirname, basename, extname, relative, posix } from 'node:path';

const HASHABLE = /\.(js|css|wasm|woff2|svg|png|jpg|jpeg|webp|avif)$/i;
const HASHED = /\.[a-f0-9]{10}\.[a-zA-Z0-9]+$/;
const MIN_SIZE = 5 * 1024;

const dist = process.argv[2];
if (!dist) {
  console.error('usage: hash-assets.mjs <dist_dir>');
  process.exit(2);
}

async function walk(dir, out = []) {
  const entries = await readdir(dir, { withFileTypes: true });
  for (const e of entries) {
    const p = join(dir, e.name);
    if (e.isDirectory()) await walk(p, out);
    else if (e.isFile()) out.push(p);
  }
  return out;
}

function hashContent(buf) {
  return createHash('sha256').update(buf).digest('hex').slice(0, 10);
}

const allFiles = await walk(dist);
const manifest = {};
let hashedCount = 0;

for (const file of allFiles) {
  const base = basename(file);
  // Skip if has more than one extension and the last-but-one is .map etc — actually skip .map outright
  if (base.endsWith('.map')) continue;
  if (!HASHABLE.test(base)) continue;
  if (HASHED.test(base)) continue;
  const st = await stat(file);
  if (st.size <= MIN_SIZE) continue;

  const buf = await readFile(file);
  const h = hashContent(buf);
  const ext = extname(base);
  const stem = base.slice(0, -ext.length);
  const newBase = `${stem}.${h}${ext}`;
  const newPath = join(dirname(file), newBase);
  await rename(file, newPath);

  // Manifest keys: relative POSIX paths from dist root, plus bare filename
  const relOld = relative(dist, file).split(/[\\/]/).join('/');
  const relNew = relative(dist, newPath).split(/[\\/]/).join('/');
  manifest[relOld] = relNew;
  manifest[base] = newBase;
  hashedCount++;
}

// Rewrite references in HTML and CSS files
const refFiles = (await walk(dist)).filter((f) => /\.(html?|css)$/i.test(f));
let rewrites = 0;

const sortedKeys = Object.keys(manifest).sort((a, b) => b.length - a.length);

function replaceInString(src, replacer) {
  let out = src;
  for (const key of sortedKeys) {
    const val = manifest[key];
    if (key === val) continue;
    // Word-boundary-ish replacement: must be preceded by a non-path char
    const escaped = key.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
    const re = new RegExp(`(^|[\\s"'(=,/])${escaped}(?=[\\s"')#?,]|$)`, 'g');
    out = out.replace(re, (_m, pre) => {
      rewrites++;
      return pre + val;
    });
  }
  return out;
}

for (const f of refFiles) {
  const orig = await readFile(f, 'utf8');
  const next = replaceInString(orig);
  if (next !== orig) await writeFile(f, next);
}

await writeFile(
  join(dist, 'asset-manifest.json'),
  JSON.stringify(manifest, null, 2)
);

console.log(`hash-assets: ${hashedCount} files hashed, ${rewrites} references rewritten`);
