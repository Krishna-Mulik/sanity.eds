#!/usr/bin/env node
// Runs when a consumer does `npm i sanity.eds -D` (or pnpm/yarn add -D).
// Copies the pre-built bundle out of node_modules and into the consumer's
// own repo at tools/sanity/ — a path their own EDS server actually serves,
// unlike node_modules. This is what lets the consuming site load Sanity
// same-origin with zero build step of their own.
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
const srcDir = path.join(packageRoot, 'dist-plugin');
const destDir = path.join(consumerRoot, 'tools', 'sanity');

if (!fs.existsSync(srcDir)) {
  console.warn('[sanity.eds] dist-plugin/ not found in the package — skipping copy.');
  process.exit(0);
}

// Copies every file dist-plugin/ contains, not just sanity.js: the entry
// point only installs eager runtime-error capture and dynamically
// import()s the actual panel UI (sanity-ui.js) from an adjacent path only
// when mount() is called — that lazy chunk has to land next to index.js
// for the relative import to resolve, or a Sidekick click would 404.
fs.mkdirSync(destDir, { recursive: true });
let copied = 0;
for (const entry of fs.readdirSync(srcDir, { withFileTypes: true })) {
  if (!entry.isFile()) continue;
  const destName = entry.name === 'sanity.js' ? 'index.js' : entry.name;
  fs.copyFileSync(path.join(srcDir, entry.name), path.join(destDir, destName));
  copied += 1;
}
console.log(`[sanity.eds] copied ${copied} file(s) to ${path.relative(consumerRoot, destDir)}`);
