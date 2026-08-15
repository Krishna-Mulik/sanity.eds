#!/usr/bin/env node
// Runs when a consumer does `npm i sanity.eds -D` (or pnpm/yarn add -D).
// Copies the pre-built, self-contained bundle out of node_modules and into
// the consumer's own repo at tools/sanity/index.js — a path their own EDS
// server actually serves, unlike node_modules. This is what lets the
// consuming site load Sanity same-origin with zero build step of their own.
import { fileURLToPath } from 'node:url';
import path from 'node:path';
import fs from 'node:fs';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const packageRoot = path.resolve(__dirname, '..');

// Guard against running this during local development on Sanity's own repo
// (`pnpm install` here also triggers the root package's own postinstall) —
// only act when actually installed as a dependency inside some other
// project's node_modules.
if (!packageRoot.split(path.sep).includes('node_modules')) {
  process.exit(0);
}

// npm/pnpm/yarn all set INIT_CWD to the directory the install command was
// run from, which is the consumer's project root — not process.cwd(),
// which during a lifecycle script is the package's own directory.
const consumerRoot = process.env.INIT_CWD || process.cwd();
const src = path.join(packageRoot, 'dist-plugin', 'sanity.js');
const destDir = path.join(consumerRoot, 'tools', 'sanity');
const dest = path.join(destDir, 'index.js');

if (!fs.existsSync(src)) {
  console.warn('[sanity.eds] dist-plugin/sanity.js not found in the package — skipping copy.');
  process.exit(0);
}

fs.mkdirSync(destDir, { recursive: true });
fs.copyFileSync(src, dest);
console.log(`[sanity.eds] copied plugin bundle to ${path.relative(consumerRoot, dest)}`);
