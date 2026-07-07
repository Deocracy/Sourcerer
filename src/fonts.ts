/*
 * Single font import point — locally bundled IBM Plex, no runtime Google Fonts (SHELL-04, D-03).
 * Per-weight @fontsource subpath imports ONLY — never a bare/all-weights index import.
 * Budget: Mono 400/500 · Sans 400/500/600 · Serif 400 + 400-italic.
 * Phase 1 chrome uses only Mono 400; the rest are bundled now so Phase 2+ needs no second pass.
 */

import "@fontsource/ibm-plex-mono/400.css";
import "@fontsource/ibm-plex-mono/500.css";

import "@fontsource/ibm-plex-sans/400.css";
import "@fontsource/ibm-plex-sans/500.css";
import "@fontsource/ibm-plex-sans/600.css";

import "@fontsource/ibm-plex-serif/400.css";
import "@fontsource/ibm-plex-serif/400-italic.css";
