/* This Source Code Form is subject to the terms of the Mozilla Public
 * License, v. 2.0. If a copy of the MPL was not distributed with this
 * file, You can obtain one at http://mozilla.org/MPL/2.0/. */

// This file contains branding-specific prefs.
//
// This is a minimal placeholder for Phase 3 Plan 01 -- it exists so the
// build has the file branding-common.mozbuild hardcodes the name of. Plan
// 03-03 fills in the real endpoint allowlist and telemetry prefs (BRAND-04).

pref("startup.homepage_override_url", "");
pref("startup.homepage_welcome_url", "");
pref("startup.homepage_welcome_url.additional", "");

// The Mozilla update-wizard URLs must not be carried forward from the
// unofficial/ template (both pointed at nightly.mozilla.org).
pref("app.update.url.manual", "");
pref("app.update.url.details", "");

// Number of usages of the web console.
// If this is less than 5, then pasting code into the web console is disabled
pref("devtools.selfxss.count", 5);
