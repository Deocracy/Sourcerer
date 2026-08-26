/* This Source Code Form is subject to the terms of the Mozilla Public
 * License, v. 2.0. If a copy of the MPL was not distributed with this
 * file, You can obtain one at http://mozilla.org/MPL/2.0/. */

/*
 * D-89/D-94/SHELL-05: the chrome bootstrap for sourcerer.xhtml. A classic
 * script (not a module) -- ES modules are reached from here via
 * ChromeUtils.importESModule, matching the Picture-in-Picture player
 * window's own pattern.
 *
 * The SOURCERER_SHELL_READY sentinel is written to stdout via dump() as
 * the very first thing this handler does, before any other bootstrap
 * work -- SHELL-05's ordering assertion (shell paints before backend
 * work is even attempted) can never be satisfied by accident.
 */

document.addEventListener(
  "DOMContentLoaded",
  () => {
    dump("SOURCERER_SHELL_READY chrome://sourcerer/content/sourcerer.xhtml\n");

    const browserElement = document.getElementById("sourcerer-content");
    const loadingElement = document.getElementById("sourcerer-loading");

    // Exposed for plan 04-04's TheiaService.sys.mjs to call once the
    // backend is ready: navigates the content browser to the Theia
    // backend's URL and hides the branded loading layer. Uses this
    // chrome document's own nodePrincipal (the system principal, since
    // this document is loaded from chrome://) as the triggering
    // principal -- avoids reaching for Services/Cc/Ci directly, which
    // scripts/check-internals-boundary.sh forbids outside
    // SourcererAPI.sys.mjs.
    window.sourcererSwapToUrl = function sourcererSwapToUrl(url) {
      dump(`SOURCERER_SHELL_SWAP ${url}\n`);
      browserElement.fixupAndLoadURIString(url, {
        triggeringPrincipal: document.nodePrincipal,
      });
      loadingElement.style.display = "none";
    };

    window.sourcererGetBrowser = function sourcererGetBrowser() {
      return browserElement;
    };

    // Task 2 (04-03) proof-of-resolution: import SourcererAPI.sys.mjs and
    // read back two sidecar prefs through it, emitting an additional
    // sentinel. Left in place -- plan 04-04 keeps it.
    const { SourcererAPI } = ChromeUtils.importESModule("chrome://sourcerer/content/SourcererAPI.sys.mjs");
    const backendMain = SourcererAPI.getStringPref("sourcerer.sidecar.backendMain", "");
    const nodePath = SourcererAPI.getStringPref("sourcerer.sidecar.nodePath", "");
    dump(`SOURCERER_SIDECAR_PREFS backendMain=${backendMain} nodePath=${nodePath}\n`);

    // 04-04: hand off to the backend supervisor. The shell-ready sentinel
    // above is already written -- nothing in this spawn path may run
    // before it.
    const { TheiaService } = ChromeUtils.importESModule("chrome://sourcerer/content/TheiaService.sys.mjs");
    TheiaService.start(browserElement);
  },
  { once: true }
);
