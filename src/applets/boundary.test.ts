import { describe, it, expect } from "vitest";
import { readdirSync, readFileSync, statSync } from "node:fs";
import { join, dirname } from "node:path";
import { fileURLToPath } from "node:url";

/**
 * boundary.test.ts — mechanical enforcement of the applet→shell import
 * boundary (CR-01). The phase's hard invariant: applets touch the shell ONLY
 * through the `host` API. Review is not a durable enforcement mechanism, so
 * this test scans every source module under src/applets/** and fails on any
 * import that reaches into src/store/** or src/shell/** — with the single
 * sanctioned exception of `shell/appletDefs` (the leaf glyph/title/desc
 * single-source-of-truth; see IN-04 for the proposal to relocate it).
 */

const APPLETS_DIR = dirname(fileURLToPath(import.meta.url));

/** Recursively collects .ts/.tsx source files (tests excluded — tests may
 *  legitimately import shell/store modules to build fixtures). */
function collectSources(dir: string): string[] {
  const out: string[] = [];
  for (const entry of readdirSync(dir)) {
    const full = join(dir, entry);
    if (statSync(full).isDirectory()) {
      out.push(...collectSources(full));
    } else if (
      /\.(ts|tsx)$/.test(entry) &&
      !/\.test\.(ts|tsx)$/.test(entry) &&
      !/\.d\.ts$/.test(entry)
    ) {
      out.push(full);
    }
  }
  return out;
}

const FORBIDDEN: { name: string; pattern: RegExp }[] = [
  // Any relative import reaching src/store/** (e.g. ../../store/shellStore).
  { name: "src/store/**", pattern: /^(?:\.\.\/)+store\// },
  // Any relative import reaching src/shell/** EXCEPT the sanctioned
  // appletDefs leaf (IN-04 documents that lone exception).
  { name: "src/shell/** (except appletDefs)", pattern: /^(?:\.\.\/)+shell\/(?!appletDefs$)/ },
];

describe("applet import boundary (CR-01)", () => {
  it("no module under src/applets/** imports src/store/** or src/shell/** (except shell/appletDefs)", () => {
    const violations: string[] = [];
    for (const file of collectSources(APPLETS_DIR)) {
      const source = readFileSync(file, "utf-8");
      const importRe = /(?:import|export)\s[^"']*?from\s+["']([^"']+)["']/g;
      let match: RegExpExecArray | null;
      while ((match = importRe.exec(source)) !== null) {
        const specifier = match[1];
        for (const rule of FORBIDDEN) {
          if (rule.pattern.test(specifier)) {
            violations.push(`${file} → "${specifier}" (${rule.name})`);
          }
        }
      }
    }
    expect(violations).toEqual([]);
  });
});
