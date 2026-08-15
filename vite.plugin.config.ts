import { defineConfig } from 'vite';
import preact from '@preact/preset-vite';

// Builds the single, self-contained file that a target EDS site's own
// scripts.js loads (see SETUP.md). Distinct from the default vite.config.ts,
// which builds index.html — the local Cairn Supply Co. dev harness — not
// the distributable plugin.
//
// `initSanity()` mounts eagerly as a side effect of importing
// src/plugin-entry.ts, so this bundle needs no exports and no init call at
// the consumer's end: `import 'https://.../sanity.js'` is the entire
// contract.
export default defineConfig({
  plugins: [preact()],
  // The dev harness's public/ (fonts, icons, favicon) is for index.html
  // only — everything the plugin itself needs is base64-inlined via
  // src/lib/fonts.ts, so the distributable is sanity.js alone.
  publicDir: false,
  build: {
    outDir: 'dist-plugin',
    emptyOutDir: true,
    // Every asset this bundle needs (fonts) is already base64-inlined in
    // src/lib/fonts.ts — nothing here should ever resolve against the host
    // page's own origin.
    assetsInlineLimit: Number.MAX_SAFE_INTEGER,
    cssCodeSplit: false,
    lib: {
      entry: 'src/plugin-entry.ts',
      formats: ['es'],
      fileName: () => 'sanity.js',
    },
    // No externals: preact/axe-core must be bundled in, since a consuming
    // site has no reason to have them on hand.
    rollupOptions: { output: {} },
    codeSplitting: false,
  },
});
