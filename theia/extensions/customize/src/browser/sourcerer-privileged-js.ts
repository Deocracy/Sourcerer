import { interfaces } from '@theia/core/shared/inversify';
import { ApplicationShell } from '@theia/core/lib/browser';

// CUST-02's build-time gate (D-62..D-67). The DI token MUST use the global
// symbol registry (`Symbol.for`), not a bare `Symbol()`: a bare symbol is a
// unique value unreachable from any out-of-bundle evaluation context --
// including the WebDriver BiDi `script.evaluate` callback
// `scripts/verify-dev-flag-off.mjs` runs the CUST-02 proof from -- which
// would make the proof structurally incapable of ever reporting anything
// but "unbound". The string key below must match that script exactly.
export const SourcererPrivilegedJs = Symbol.for('SourcererPrivilegedJs');

// The small, stable surface `customize.js` receives when the dev flag is
// on (D-67). `tabUriRegistry` is not yet populated: `@sourcerer/tab-uris`
// (Plan 06) does not exist at this point in the phase's dependency graph
// (02-05 depends only on 02-04), so there is no class to import or bind
// here. The property is reserved so a later plan can populate it without
// changing this interface's shape -- see 02-05-SUMMARY.md's Known Stubs.
export interface SourcererPrivilegedJsSurface {
    readonly container: interfaces.Container;
    readonly shell: ApplicationShell;
    readonly tabUriRegistry: undefined;
}
