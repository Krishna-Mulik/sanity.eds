# Setting up Sanity on an EDS site

Sanity ships as three files (`dist-plugin/` — built by `pnpm build:plugin`, see
`vite.plugin.config.ts`): a tiny entry point plus two chunks it loads at different times. It has
no CSS to link and no assets to copy — all of its fonts are base64-inlined
(`src/lib/fonts.ts`).

**A regular site visitor loads none of this — zero bytes, not even the tiny part.** Sanity is a
developer/author tool, so the wiring below never imports anything at the top level of
`scripts.js`; the only `import()` anywhere lives inside the `custom:sanity` Sidekick event
handler. Only once that fires does the entry point (`src/plugin-entry.ts` — `sanity.js` +
`sanity-core.js`, ~2.4KB) run, installing dependency-free runtime-error capture and immediately
triggering a second, separate fetch for the actual Preact + axe-core panel (`sanity-ui.js`,
~290KB gzip) via the exported `mount()`. This means runtime-error capture only sees errors from
that first click onward, not from page load — a deliberate trade-off in favor of true
zero-footprint-until-invoked, not an oversight. This replaces an earlier eager-mount design that
shipped the full ~290KB, and a visible diagnostics ball, to every real visitor on every page
load, whether or not they had Sidekick at all.

## Recommended: npm package with a postinstall that drops the files into the consumer's own repo

```bash
npm i sanity.eds -D
```

`scripts/postinstall.js` runs automatically on install and copies every file from
`node_modules/sanity.eds/dist-plugin/` into **`tools/sanity/`** in the consumer's own project
root (renaming `sanity.js` → `index.js` on the way). That destination is deliberate: EDS serves
pages from the site's own git repo, not from `node_modules` — copying the files out is what
makes them loadable at all, and `sanity-ui.js` has to land next to `index.js` for its relative
`import()` to resolve.

### Wiring it into `scripts.js`

Sanity is registered as an **event-type Sidekick plugin** (see `tools/sidekick/config.json`
below), so the consumer's own `scripts.js` needs to listen for the `custom:<id>` event Sidekick
dispatches on the `<aem-sidekick>` element and call `mount()` in response — this is the exact
pattern [aem.live's sidekick-development docs](https://www.aem.live/developer/sidekick-development)
show for any event-type plugin, Sanity included:

```js
function initSanity() {
  const sidekick = document.querySelector('aem-sidekick');
  if (!sidekick) {
    // Sidekick hasn't initialized yet — it dispatches this on `document`
    // once it has.
    document.addEventListener('sidekick-ready', initSanity, { once: true });
    return;
  }
  sidekick.addEventListener('custom:sanity', async (event) => {
    const { mount } = await import('/tools/sanity/index.js');
    mount(event.detail);
  });
}

initSanity();
```

Call `initSanity()` from wherever your `scripts.js` already runs on every page. `mount()` is
idempotent and opens the panel immediately on its first call — no second click needed — and any
click after that is handled by the panel's own internal listener on the `<aem-sidekick>`
element, so calling `mount()` again is a harmless no-op.

Commit the whole `tools/sanity/` directory — `node_modules` is gitignored as usual, but this
copy is the actual served asset, so it can't be.

### `tools/sidekick/config.json`

```json
{
  "project": "Sanity",
  "plugins": [
    {
      "id": "sanity",
      "title": "Sanity",
      "event": "sanity",
      "environments": ["any"]
    }
  ]
}
```

`"environments": ["any"]` is a valid documented value; Sidekick itself already restricts
event-type plugins to dev/preview/live/prod regardless, so nothing further to configure there.

**Why the npm/postinstall route beats a CDN script tag for EDS specifically:**
- **Same-origin.** The files are served by the consumer's own site, so nothing needs to be added
  to `script-src` in their CSP (a jsDelivr/CDN route would need `https://cdn.jsdelivr.net` added
  there). `style-src 'unsafe-inline'` and `font-src data:` are still needed either way — those
  come from how the panel injects its own CSS and fonts at runtime, not from where the files
  were loaded from.
- **No third-party runtime dependency.** Nothing breaks if a CDN has an outage or a consumer's
  security policy disallows third-party script origins.

### Update flow

```bash
npm update sanity.eds
```

Reinstalling re-runs `postinstall` and re-copies the newest `tools/sanity/` — the consumer never
touches the build, never re-downloads anything by hand. They just commit the resulting diff.

### One-time repo setup (publishing side)

1. `pnpm build:plugin` (also runs automatically via `prepublishOnly` on `npm publish`, so a
   manual build before publishing isn't required, just harmless).
2. `npm publish` (needs an npm account, but no separate hosting — the registry *is* the
   distribution point; the package's own source of truth stays this GitHub repo).
3. Bump `version` in `package.json` per release using normal semver — consumers control how
   loosely they track that via their own `package.json` range (`^1.0.0` vs an exact pin), same
   as any other npm dependency. A change to the exported API (like the `mount()` contract itself)
   is a major-version bump; internal-only changes are minor/patch.

## Alternatives (no npm registry at all)

If publishing to npm isn't wanted, the `dist-plugin/` files can instead be:

- **Loaded from GitHub via jsDelivr** — same `mount()`-on-click wiring above, but
  `await import('https://cdn.jsdelivr.net/gh/Krishna-Mulik/sanity.eds@2/dist-plugin/sanity.js')`
  in place of the local path. Needs `https://cdn.jsdelivr.net` added to the consumer's
  `script-src`. Auto-updates within a pinned major version (`@2`), same tradeoff as the npm range
  above, but cross-origin.
- **Vendored by hand** — download a tagged release's `dist-plugin/` directory and commit it
  directly into the consumer's repo. Same-origin like the npm flow, but every update is a fully
  manual re-download — no `postinstall` to automate the copy.

## Content-Security-Policy

Regardless of how the files are loaded, a consumer running a CSP needs:

- `style-src 'unsafe-inline'` (or a matching nonce) — the panel injects a `<style>` element with
  `textContent` at runtime (`src/lib/mount.tsx`), not a `<link>` to an external stylesheet, so
  it's treated as inline CSS.
- `font-src data:` — the bundled fonts load via `@font-face { src: url('data:font/woff2;base64,...') }`.
- `script-src` — only needs an addition (`https://cdn.jsdelivr.net`) for the CDN alternative
  above; the npm/postinstall and vendored routes are same-origin and need nothing extra here.
