// Distributable entry point (see vite.plugin.config.ts / SETUP.md).
//
// Deliberately does NOT import src/main.tsx, which also imports
// src/index.css — that stylesheet is the mock Cairn Supply Co. dev harness
// page, not the plugin, and must never ship inside dist-plugin/sanity.js.
import { initSanity } from './lib/mount';

initSanity();
