# Setting up Sanity on an EDS site

Sanity ships as a **single self-contained JS file** (`dist-plugin/sanity.js` — built by
`pnpm build:plugin`, see `vite.plugin.config.ts`). It has no CSS to link, no assets to copy: all
of its fonts are base64-inlined (`src/lib/fonts.ts`), and it mounts itself into its own Shadow
DOM the moment it's loaded — importing the file *is* the init call (`src/plugin-entry.ts` calls
`initSanity()` as a side effect).

## Recommended: npm package with a postinstall that drops the file into the consumer's own repo

```bash
npm i sanity.eds -D
```

`scripts/postinstall.js` runs automatically on install and copies the bundle from
`node_modules/sanity.eds/dist-plugin/sanity.js` to **`tools/sanity/index.js`** in the consumer's
own project root. That destination is deliberate: EDS serves pages from the site's own git repo,
not from `node_modules` — copying it out is what makes the file loadable at all.

The consumer then adds one line to their `scripts.js` (or wherever else runs on every page):

```js
import '/tools/sanity/index.js';
```

...and commits `tools/sanity/index.js` to their repo — `node_modules` is gitignored as usual,
but this copy is the actual served asset, so it can't be. This is the only manual step in the
whole flow; everything upstream of it (installing, rebuilding, copying) is automatic.

**Why this beats a CDN script tag for EDS specifically:**
- **Same-origin.** The file is served by the consumer's own site, so nothing needs to be added
  to `script-src` in their CSP (a jsDelivr/CDN route would need
  `https://cdn.jsdelivr.net` added there). `style-src 'unsafe-inline'` and `font-src data:`
  are still needed either way — those come from how the panel injects its own CSS and fonts at
  runtime, not from where the file was loaded from.
- **No third-party runtime dependency.** Nothing breaks if a CDN has an outage or a consumer's
  security policy disallows third-party script origins.

### Update flow

```bash
npm update sanity.eds
```

Reinstalling re-runs `postinstall` and re-copies the newest `tools/sanity/index.js` — the
consumer never touches the build, never re-downloads anything by hand. They just commit the
resulting diff to `tools/sanity/index.js`, same as any other dependency bump.

### One-time repo setup (publishing side)

1. `pnpm build:plugin` (also runs automatically via `prepublishOnly` on `npm publish`, so a
   manual build before publishing isn't required, just harmless).
2. `npm publish` (needs an npm account, but no separate hosting — the registry *is* the
   distribution point; the package's own source of truth stays this GitHub repo).
3. Bump `version` in `package.json` per release using normal semver — consumers control how
   loosely they track that via their own `package.json` range (`^1.0.0` vs an exact pin), same
   as any other npm dependency.

## Alternatives (no npm registry at all)

If publishing to npm isn't wanted, `dist-plugin/sanity.js` can instead be:

- **Loaded from GitHub via jsDelivr** — `import('https://cdn.jsdelivr.net/gh/Krishna-Mulik/sanity.eds@1/dist-plugin/sanity.js')`.
  Needs `https://cdn.jsdelivr.net` added to the consumer's `script-src`. Auto-updates within a
  pinned major version (`@1`), same tradeoff as the npm range above, but cross-origin.
- **Vendored by hand** — download a tagged release's `dist-plugin/sanity.js` and commit it
  directly into the consumer's repo. Same-origin like the npm flow, but every update is a fully
  manual re-download — no `postinstall` to automate the copy.

## Content-Security-Policy

Regardless of how the file is loaded, a consumer running a CSP needs:

- `style-src 'unsafe-inline'` (or a matching nonce) — the panel injects a `<style>` element with
  `textContent` at runtime (`src/lib/mount.tsx`), not a `<link>` to an external stylesheet, so
  it's treated as inline CSS.
- `font-src data:` — the bundled fonts load via `@font-face { src: url('data:font/woff2;base64,...') }`.
- `script-src` — only needs an addition (`https://cdn.jsdelivr.net`) for the CDN alternative
  above; the npm/postinstall and vendored routes are same-origin and need nothing extra here.
