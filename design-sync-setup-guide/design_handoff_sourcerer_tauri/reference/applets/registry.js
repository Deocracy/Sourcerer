// ============================================================
// APPLET REGISTRY
// ------------------------------------------------------------
// To add a REAL applet:
//   1. Copy _TemplateApplet.js → YourApplet.js and build it
//   2. Import it below and add it to the `applets` array
// That's it. The shell picks it up on load: it appears in the
// left rail + Applet Catalog and renders for real in panes.
// Any applet NOT listed here keeps its demo stub in the shell.
// ============================================================

import * as Notes from './Notes.js';

export const applets = [
  Notes,
];
