import { defineConfig } from 'vite';
import preact from '@preact/preset-vite';

// Builds the distributable a target EDS site's own scripts.js loads (see
// SETUP.md). Distinct from the default vite.config.ts, which builds
// index.html — the local Cairn Supply Co. dev harness — not the plugin.
//
// Two output files, not one, on purpose: src/plugin-entry.ts installs
// dependency-free runtime-error capture eagerly, then only dynamically
// import()s the actual Preact/axe-core UI when mount() is called (a
// Sidekick click). Real code-splitting (not just deferred execution inside
// one file) is what makes that meaningful — a visitor who never opens
// Sidekick must never fetch the ~290KB gzip UI chunk at all. The chunk name
// is pinned (not content-hashed) so the relative import path plugin-entry
// emits stays identical release to release.
export default defineConfig({
  plugins: [preact()],
  // The dev harness's public/ (fonts, icons, favicon) is for index.html
  // only — everything the plugin itself needs is base64-inlined via
  // src/lib/fonts.ts, so nothing in dist-plugin/ should ever resolve
  // against the host page's own origin.
  publicDir: false,
  build: {
    outDir: 'dist-plugin',
    emptyOutDir: true,
    assetsInlineLimit: Number.MAX_SAFE_INTEGER,
    lib: {
      entry: 'src/plugin-entry.ts',
      formats: ['es'],
      fileName: () => 'sanity.js',
    },
    // No externals: preact/axe-core must be bundled in, since a consuming
    // site has no reason to have them on hand.
    rollupOptions: {
      output: {
        // Named explicitly (not content-hashed) so the relative import
        // path plugin-entry.ts's dynamic import() resolves to stays
        // identical release to release, whether served from a consumer's
        // committed tools/sanity/ or straight from this repo via jsDelivr.
        chunkFileNames: (chunkInfo) => {
          if (chunkInfo.name === 'runtimeErrors') return 'sanity-core.js';
          if (chunkInfo.name === 'mount') return 'sanity-ui.js';
          return 'sanity-runtime.js';
        },
      },
    },
  },
});
