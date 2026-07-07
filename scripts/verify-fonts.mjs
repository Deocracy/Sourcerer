// SHELL-04 gate: assert the production build ships zero network-font references.
// Scans dist/ for the Google Fonts domains the reference prototype's <helmet>
// links use — those must NOT have been ported. Exit 1 on any match.
// Cross-platform (node) so it runs the same on Windows and CI.
import { readdirSync, readFileSync, statSync } from "node:fs";
import { join } from "node:path";

const DIST = "dist";
const NEEDLES = ["fonts.googleapis.com", "fonts.gstatic.com"];
// Only scan text assets; woff2/woff are binary local font files (expected).
const TEXT_EXT = /\.(js|mjs|cjs|css|html|json|map|txt|svg)$/i;

function walk(dir) {
  const out = [];
  for (const name of readdirSync(dir)) {
    const p = join(dir, name);
    if (statSync(p).isDirectory()) out.push(...walk(p));
    else out.push(p);
  }
  return out;
}

let files;
try {
  files = walk(DIST);
} catch {
  console.error(`verify:fonts — no ${DIST}/ directory; run "npm run build" first.`);
  process.exit(1);
}

const hits = [];
for (const f of files) {
  if (!TEXT_EXT.test(f)) continue;
  const text = readFileSync(f, "utf8");
  for (const needle of NEEDLES) {
    if (text.includes(needle)) hits.push(`${f}: ${needle}`);
  }
}

const woff2 = files.filter((f) => /ibm-plex-.*\.woff2?$/i.test(f));
if (woff2.length === 0) {
  console.error("verify:fonts — FAIL: no bundled IBM Plex woff2 assets found in dist/.");
  process.exit(1);
}

if (hits.length > 0) {
  console.error("verify:fonts — FAIL: network font references found in build output:");
  for (const h of hits) console.error(`  ${h}`);
  process.exit(1);
}

console.log(`verify:fonts — PASS: no external font references; ${woff2.length} local IBM Plex assets bundled.`);
