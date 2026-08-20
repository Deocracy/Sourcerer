#!/usr/bin/env node
// scripts/verify-branding.mjs
//
// Headless proof that `@sourcerer/branding` is loaded by the running app:
// document title, favicon link, and the `theia.frontend.config` custom-key
// path (D-62) all read live in the page over WebDriver BiDi -- not by
// reading source or package.json on disk (D-64's vacuous-pass caveat).
// No npm test dependency is added to the `theia` workspace (D-69).
//
// `FrontendApplicationConfigProvider` stores the merged config on
// `window[Symbol('FrontendApplicationConfigProvider')]` -- a bare Symbol, so
// there is no fixed key to read from an external evaluation context. It is
// found instead via `Object.getOwnPropertySymbols(window)`, which is how a
// page-external observer can reach it without a `require()` (not exposed on
// the frontend bundle's global scope) or grepping the served bundle text.
//
// Usage: node scripts/verify-branding.mjs [url]   (default http://localhost:3000)
//
// Later plans extend this same file rather than adding sibling scripts.

import { withFirefoxPage } from './lib/firefox-bidi.mjs';

const url = process.argv[2] || 'http://localhost:3000';

const FIND_FRONTEND_CONFIG =
    "Object.getOwnPropertySymbols(window).map(s => window[s])" +
    ".find(v => v && typeof v === 'object' && Object.prototype.hasOwnProperty.call(v, 'applicationName'))";

async function main() {
    return withFirefoxPage(url, async ({ evaluate, waitFor }) => {
        await waitFor('window.theia && window.theia.container ? true : false');

        const title = await evaluate('document.title');
        if (title !== 'Sourcerer') {
            throw new Error(`document.title was ${JSON.stringify(title)}, expected "Sourcerer"`);
        }

        // `window.theia.container` is assigned before `application.start()`
        // runs the `onStart` contributions (src-gen/frontend/index.js), so
        // the favicon link -- appended from `onStart` -- needs its own poll,
        // not just the container's.
        const iconHref = await waitFor(
            'document.querySelector(\'link[rel="icon"]\')?.getAttribute("href") || false'
        );
        if (typeof iconHref !== 'string' || !iconHref.startsWith('data:image/svg+xml')) {
            throw new Error(`favicon href was ${JSON.stringify(iconHref)}, expected a data:image/svg+xml URI`);
        }

        const sourcererPrivilegedJs = await evaluate(`(${FIND_FRONTEND_CONFIG})?.sourcererPrivilegedJs`);
        if (sourcererPrivilegedJs !== false) {
            throw new Error(`sourcererPrivilegedJs was ${JSON.stringify(sourcererPrivilegedJs)}, expected boolean false`);
        }

        return { title, iconHref, sourcererPrivilegedJs };
    });
}

main()
    .then(() => {
        console.log('verify-branding: PASS');
        process.exit(0);
    })
    .catch(err => {
        console.error(`verify-branding: FAIL -- ${err.message}`);
        process.exit(1);
    });
