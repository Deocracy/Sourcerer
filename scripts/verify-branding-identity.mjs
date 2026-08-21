#!/usr/bin/env node
// scripts/verify-branding-identity.mjs
//
// BRAND-01's six-surface identity checklist (D-79), replacing the
// unachievable "grep -ri firefox comes back empty" criterion: a correctly
// branded, unpackaged build still ships dozens of files with "firefox" in
// the name (upstream feature names, C-5's update-file set) -- a criterion
// that can only ever fail is not a criterion.
//
// The six surfaces, each an EXACT string/boolean equality -- never
// includes/startsWith, never case-insensitive:
//   1. executable    -- a file named `sourcerer` exists+executable under
//                       objdir/dist/bin, and no file named `firefox` remains.
//   2. application-ini -- application.ini's Name=/Vendor= lines.
//   3. about-support  -- live application-box/version-box textContent, read
//                       over WebDriver BiDi with --remote-allow-system-access
//                       (parent-process evaluation). Empirically confirmed
//                       both directions this session (03-02 Task 1): the
//                       same read throws upstream's own "unsupported
//                       operation" error with the flag absent, and returns
//                       the live value ("Sourcerer") with it present -- so
//                       this is a real live read, not a constant.
//   4. brand-full-name -- the dev variant's own
//                       sourcerer/branding/dev/locales/en-US/brand.ftl
//                       `-brand-full-name`, asserted to be exactly
//                       "Sourcerer Dev". NOT a document.title read: the
//                       Linux window title resolves through Fluent's
//                       `-brand-full-name` term (browser.ftl:7), and
//                       `document.title` over BiDi is the wrong realm anyway
//                       (browsingContext.getTree returns content contexts,
//                       never the chrome window). The live chrome-window
//                       title and WM_CLASS reads are Manual-Only items in
//                       03-VALIDATION.md (no xprop/chrome introspection on
//                       this headless host); 03-05 Task 3 adds the
//                       cross-variant (dev vs release) differ assertion once
//                       the release branding directory exists.
//   5. desktop-entry  -- sourcerer/sourcerer.desktop's Name=/StartupWMClass=
//                       against config.status's resolved MOZ_APP_DISPLAYNAME/
//                       MOZ_APP_REMOTINGNAME. Expected RED until 03-05 --
//                       the file does not exist yet.
//   6. version        -- `--version` stdout equals exactly
//                       "<Vendor> <Name> <version_display>", built from
//                       application.ini and
//                       upstream/browser/config/version_display.txt.
//                       DumpVersion() concatenates vendor and name
//                       unconditionally, so this also catches the doubled-
//                       token form a same-string vendor/basename would print.
//
// Coverage guard: every surface pushes its id onto `surfacesRun` at the
// point its assertion actually completes (pass or fail) -- a surface whose
// implementation returns early without reaching that point is caught by the
// guard at the end of a full run, exactly like verify-branding.mjs's own
// coverage guard.
//
// --positive-control <surface>: runs exactly ONE surface (application-ini,
// about-support, or version) with its expected value replaced by the stock
// Firefox value, and exits 0 only if that surface then reports FAILURE --
// following verify-dev-flag-off.mjs's --expect-bound inversion shape. This
// proves the reader produced a real live value and that the comparison
// discriminates, with no rebuild. Deliberately does NOT catch errors thrown
// during the live about-support read in this mode: catching a mechanism
// error (e.g. a broken --remote-allow-system-access wiring) and reporting it
// as "surface correctly failed" would make the control exit 0 vacuously,
// which is the Phase 2 verify-dev-flag-off failure mode this harness exists
// to prevent. A full (non-control) run wraps every surface's own I/O so an
// absent/unreadable value is always a FAILURE row, never a skip and never an
// uncaught crash that would stop the remaining surfaces from running.
//
// Zero npm dependencies: only ./lib/firefox-bidi.mjs and Node built-ins.
//
// Usage:
//   node scripts/verify-branding-identity.mjs [--bin <path>]
//     [--expect-display-name <string>] [--positive-control <surface>]
//   node scripts/verify-branding-identity.mjs --help

import { withFirefoxPage } from './lib/firefox-bidi.mjs';
import { existsSync, readFileSync, statSync } from 'node:fs';
import { execFileSync } from 'node:child_process';
import { join, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';

const __dirname = dirname(fileURLToPath(import.meta.url));
const REPO_ROOT = join(__dirname, '..');

const HELP = `Usage: node scripts/verify-branding-identity.mjs [--bin <path>] [--expect-display-name <string>] [--positive-control <surface>]
       node scripts/verify-branding-identity.mjs --help

Runs BRAND-01's six-surface identity checklist against the built binary.

  --bin <path>                Binary to drive (default objdir/dist/bin/sourcerer)
  --expect-display-name <s>   Override the expected MOZ_APP_DISPLAYNAME for the
                               desktop-entry surface (default: read live from
                               objdir/config.status)
  --positive-control <surface>
                               Run exactly one surface (application-ini,
                               about-support, or version) with its expected
                               value replaced by the stock Firefox value.
                               Exits 0 only if that surface then reports
                               FAILURE.
  --help                       Print this message and exit 0
`;

const args = process.argv.slice(2);

if (args.includes('--help')) {
    console.log(HELP.trimEnd());
    process.exit(0);
}

function argValue(flag) {
    const i = args.indexOf(flag);
    if (i === -1 || i === args.length - 1) return undefined;
    return args[i + 1];
}

const binOverride = argValue('--bin');
const expectDisplayNameOverride = argValue('--expect-display-name');
const positiveControlSurface = argValue('--positive-control');

const BIN_DIR = join(REPO_ROOT, 'objdir', 'dist', 'bin');
const BIN_PATH = binOverride || join(BIN_DIR, 'sourcerer');
const APP_INI_PATH = join(BIN_DIR, 'application.ini');
const CONFIG_STATUS_PATH = join(REPO_ROOT, 'objdir', 'config.status');
const VERSION_DISPLAY_PATH = join(REPO_ROOT, 'upstream', 'browser', 'config', 'version_display.txt');
const DESKTOP_FILE_PATH = join(REPO_ROOT, 'sourcerer', 'sourcerer.desktop');
const BRAND_FTL_PATH = join(REPO_ROOT, 'sourcerer', 'branding', 'dev', 'locales', 'en-US', 'brand.ftl');

const SURFACE_IDS = ['executable', 'application-ini', 'about-support', 'brand-full-name', 'desktop-entry', 'version'];
const CONTROLLABLE_SURFACES = ['application-ini', 'about-support', 'version'];

const surfacesRun = [];

// --- build-time truth readers -- each throws on absent/unreadable input,
// never returns a silently-empty value. ---

function readAppIni(path) {
    if (!existsSync(path)) throw new Error(`${path} does not exist`);
    const lines = readFileSync(path, 'utf8').split(/\r?\n/);
    const nameLine = lines.find(l => l.startsWith('Name='));
    const vendorLine = lines.find(l => l.startsWith('Vendor='));
    if (nameLine === undefined || vendorLine === undefined) {
        throw new Error(`${path} is missing a Name= or Vendor= line`);
    }
    const name = nameLine.slice('Name='.length);
    const vendor = vendorLine.slice('Vendor='.length);
    if (!name || !vendor) throw new Error(`${path} has an empty Name= or Vendor= value`);
    return { name, vendor };
}

function readVersionDisplay(path) {
    if (!existsSync(path)) throw new Error(`${path} does not exist`);
    const value = readFileSync(path, 'utf8').trim();
    if (!value) throw new Error(`${path} is empty`);
    return value;
}

function readConfigStatusVar(path, name) {
    if (!existsSync(path)) throw new Error(`${path} does not exist`);
    const text = readFileSync(path, 'utf8');
    const re = new RegExp(`'${name}':\\s*'([^']*)'`);
    const m = text.match(re);
    if (!m || !m[1]) throw new Error(`${path} has no resolved value for ${name}`);
    return m[1];
}

function readBrandFullName(path) {
    if (!existsSync(path)) throw new Error(`${path} does not exist`);
    const line = readFileSync(path, 'utf8').split(/\r?\n/).find(l => l.trim().startsWith('-brand-full-name'));
    if (!line) throw new Error(`${path} has no -brand-full-name entry`);
    const m = line.match(/^-brand-full-name\s*=\s*(.+)$/);
    if (!m || !m[1].trim()) throw new Error(`${path} -brand-full-name line has an unexpected or empty shape: ${JSON.stringify(line)}`);
    return m[1].trim();
}

function parseDesktopFile(path) {
    if (!existsSync(path)) throw new Error(`${path} does not exist`);
    const lines = readFileSync(path, 'utf8').split(/\r?\n/);
    const nameLine = lines.find(l => l.startsWith('Name='));
    const wmClassLine = lines.find(l => l.startsWith('StartupWMClass='));
    if (nameLine === undefined || wmClassLine === undefined) {
        throw new Error(`${path} is missing a Name= or StartupWMClass= line`);
    }
    return { name: nameLine.slice('Name='.length), wmClass: wmClassLine.slice('StartupWMClass='.length) };
}

// --- the six surfaces ---

function checkExecutable() {
    const sourcererPath = join(BIN_DIR, 'sourcerer');
    const firefoxPath = join(BIN_DIR, 'firefox');

    let sourcererOk = false;
    if (existsSync(sourcererPath)) {
        try {
            sourcererOk = (statSync(sourcererPath).mode & 0o111) !== 0;
        } catch {
            sourcererOk = false;
        }
    }
    const firefoxAbsent = !existsSync(firefoxPath);
    const pass = sourcererOk && firefoxAbsent;
    surfacesRun.push('executable');
    return {
        pass,
        detail: `${sourcererPath} executable=${sourcererOk}; ${firefoxPath} absent=${firefoxAbsent}`,
    };
}

function checkApplicationIni({ stockControl = false } = {}) {
    const { name, vendor } = readAppIni(APP_INI_PATH);
    const expectedName = stockControl ? 'Firefox' : 'Sourcerer';
    const expectedVendor = stockControl ? 'Mozilla' : 'Deocracy';
    const pass = name === expectedName && vendor === expectedVendor;
    surfacesRun.push('application-ini');
    return {
        pass,
        detail: `Name=${JSON.stringify(name)} (expected ${JSON.stringify(expectedName)}), Vendor=${JSON.stringify(vendor)} (expected ${JSON.stringify(expectedVendor)})`,
    };
}

async function checkAboutSupport({ stockControl = false } = {}) {
    // Real build values, read before the browser even launches -- these are
    // the non-control expected values. A read failure here is a genuine
    // infra problem (application.ini / version_display.txt absent) and is
    // allowed to throw uncaught in --positive-control mode, per this file's
    // header note: catching it and calling the surface "FAILED" would make
    // the control pass for the wrong reason.
    const { name: realName } = readAppIni(APP_INI_PATH);
    const expectedName = stockControl ? 'Firefox' : realName;

    const result = await withFirefoxPage('about:support', async ({ waitFor }) => {
        const appName = await waitFor(
            "document.getElementById('application-box') ? document.getElementById('application-box').textContent : false"
        );
        const appVersion = await waitFor(
            "document.getElementById('version-box') ? document.getElementById('version-box').textContent : false"
        );
        return { appName, appVersion };
    }, { binPath: BIN_PATH });

    const versionDisplay = readVersionDisplay(VERSION_DISPLAY_PATH);
    const namePass = result.appName === expectedName;
    // The stock substitution axis for this surface is the display name
    // (per the plan's enumerated stock values); the version field is only
    // asserted in non-control mode.
    const versionPass = stockControl ? true : result.appVersion === versionDisplay;
    const pass = namePass && versionPass;

    surfacesRun.push('about-support');
    return {
        pass,
        detail: `application-box=${JSON.stringify(result.appName)} (expected ${JSON.stringify(expectedName)}), version-box=${JSON.stringify(result.appVersion)}${stockControl ? '' : ` (expected ${JSON.stringify(versionDisplay)})`}`,
    };
}

function checkBrandFullName() {
    const value = readBrandFullName(BRAND_FTL_PATH);
    const expected = 'Sourcerer Dev';
    const pass = value === expected;
    surfacesRun.push('brand-full-name');
    return {
        pass,
        detail: `dev variant -brand-full-name=${JSON.stringify(value)} (expected ${JSON.stringify(expected)}); dev-vs-release differ assertion is 03-05 Task 3's responsibility`,
    };
}

function checkDesktopEntry() {
    const expectedName = expectDisplayNameOverride || readConfigStatusVar(CONFIG_STATUS_PATH, 'MOZ_APP_DISPLAYNAME');
    const expectedWmClass = readConfigStatusVar(CONFIG_STATUS_PATH, 'MOZ_APP_REMOTINGNAME');
    const { name, wmClass } = parseDesktopFile(DESKTOP_FILE_PATH);
    const pass = name === expectedName && wmClass === expectedWmClass;
    surfacesRun.push('desktop-entry');
    return {
        pass,
        detail: `Name=${JSON.stringify(name)} (expected ${JSON.stringify(expectedName)}), StartupWMClass=${JSON.stringify(wmClass)} (expected ${JSON.stringify(expectedWmClass)})`,
    };
}

function checkVersion({ stockControl = false } = {}) {
    const { name, vendor } = readAppIni(APP_INI_PATH);
    const versionDisplay = readVersionDisplay(VERSION_DISPLAY_PATH);
    const actual = execFileSync(BIN_PATH, ['--version'], { encoding: 'utf8' }).trim();
    const expected = stockControl ? `Mozilla Firefox ${versionDisplay}` : `${vendor} ${name} ${versionDisplay}`;
    const pass = actual === expected;
    surfacesRun.push('version');
    return {
        pass,
        detail: `--version output=${JSON.stringify(actual)} (expected ${JSON.stringify(expected)})`,
    };
}

// Wraps a synchronous or async surface check so an absent/unreadable value
// is a FAILURE row, never a skip and never an uncaught crash that would stop
// the remaining surfaces from running. Only used in the full (non-control)
// run -- --positive-control mode calls each surface's check function
// directly, unwrapped, per the header note above.
async function runSurfaceSafe(id, fn) {
    try {
        const result = await fn();
        return { id, ...result };
    } catch (err) {
        if (!surfacesRun.includes(id)) surfacesRun.push(id);
        return { id, pass: false, detail: `could not be read/executed: ${err.message}` };
    }
}

async function runFull() {
    const results = [];
    results.push(await runSurfaceSafe('executable', () => checkExecutable()));
    results.push(await runSurfaceSafe('application-ini', () => checkApplicationIni()));
    results.push(await runSurfaceSafe('about-support', () => checkAboutSupport()));
    results.push(await runSurfaceSafe('brand-full-name', () => checkBrandFullName()));
    results.push(await runSurfaceSafe('desktop-entry', () => checkDesktopEntry()));
    results.push(await runSurfaceSafe('version', () => checkVersion()));

    const missing = SURFACE_IDS.filter(id => !surfacesRun.includes(id));
    if (missing.length > 0) {
        console.error(`verify-branding-identity: FAIL -- coverage guard: surface(s) never asserted: ${missing.join(', ')}`);
        process.exit(1);
    }

    let failed = false;
    for (const r of results) {
        if (r.pass) {
            console.log(`verify-branding-identity: PASS ${r.id} -- ${r.detail}`);
        } else {
            failed = true;
            console.error(`verify-branding-identity: FAIL ${r.id} -- ${r.detail}`);
        }
    }

    if (failed) {
        console.error('verify-branding-identity: FAIL -- see surface(s) above');
        process.exit(1);
    }
    console.log('verify-branding-identity: PASS -- all six surfaces correct');
    process.exit(0);
}

async function runPositiveControl(surface) {
    if (!CONTROLLABLE_SURFACES.includes(surface)) {
        console.error(
            `verify-branding-identity: FAIL -- no positive control defined for surface '${surface}'. ` +
            `Supported: ${CONTROLLABLE_SURFACES.join(', ')}`
        );
        process.exit(1);
    }

    let result;
    if (surface === 'application-ini') {
        result = checkApplicationIni({ stockControl: true });
    } else if (surface === 'about-support') {
        result = await checkAboutSupport({ stockControl: true });
    } else if (surface === 'version') {
        result = checkVersion({ stockControl: true });
    }

    if (!result.pass) {
        console.log(`verify-branding-identity: PASS -- positive control for '${surface}' correctly reported FAILURE against the stock Firefox value (${result.detail})`);
        process.exit(0);
    }
    console.error(`verify-branding-identity: FAIL -- positive control for '${surface}' did NOT report FAILURE against the stock Firefox value (${result.detail}); the reader is not discriminating a real live value`);
    process.exit(1);
}

if (positiveControlSurface !== undefined) {
    runPositiveControl(positiveControlSurface).catch(err => {
        console.error(`verify-branding-identity: FAIL -- ${err.message}`);
        process.exit(1);
    });
} else {
    runFull().catch(err => {
        console.error(`verify-branding-identity: FAIL -- ${err.message}`);
        process.exit(1);
    });
}
