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

    const { SourcererAPI } = ChromeUtils.importESModule("chrome://sourcerer/content/SourcererAPI.sys.mjs");

    const browserElement = document.getElementById("sourcerer-content");
    const loadingElement = document.getElementById("sourcerer-loading");
    const errorElement = document.getElementById("sourcerer-error");
    const errorMessageElement = document.getElementById("sourcerer-error-message");
    const errorRetryButton = document.getElementById("sourcerer-error-retry");
    const errorDiagnosticsButton = document.getElementById("sourcerer-error-diagnostics");
    // WebDriver finds content browsing contexts through `win.gBrowser.tabs`
    // (remote/shared/TabManager.sys.mjs) and identifies each one by its
    // browser's `permanentKey` (remote/shared/NavigableManager.sys.mjs returns
    // a null context id without one). The shell is deliberately not Firefox
    // chrome and has no tabbrowser, so it presents its single browser through
    // that same shape -- also the seed of the chrome-owned tab model the
    // post-4.0 bridge needs.
    browserElement.permanentKey = SourcererAPI.createPermanentKey();
    window.gBrowser = { tabs: [{ linkedBrowser: browserElement }] };

    // Exposed for plan 04-04's TheiaService.sys.mjs to call once the
    // backend is ready: navigates the content browser to the Theia
    // backend's URL and hides the branded loading layer. The navigation
    // itself goes through SourcererAPI.loadURIInBrowser -- both
    // fixupAndLoadURIString and nodePrincipal are privileged chrome API and
    // belong behind the one boundary file, not here.
    window.sourcererSwapToUrl = function sourcererSwapToUrl(url) {
      dump(`SOURCERER_SHELL_SWAP ${url}\n`);
      SourcererAPI.loadURIInBrowser(browserElement, url);
      loadingElement.style.display = "none";
    };

    window.sourcererGetBrowser = function sourcererGetBrowser() {
      return browserElement;
    };

    // SHELL-03 (05-02): the error layer, reached by TheiaService exactly
    // the same way sourcererSwapToUrl is -- through this window's exposed
    // globals, never by touching browserElement's own location (D-114).
    // Neither the message text nor either sentinel may ever carry the
    // per-launch token or any credential; TheiaService's `reason` strings
    // are always static/derived-from-config text, never the token, and
    // `detail` here carries only `reason` and `recoverable`.
    window.sourcererShowError = function sourcererShowError(detail) {
      const { reason, recoverable } = detail;
      errorMessageElement.textContent = reason;
      errorElement.style.display = "flex";
      dump(`SOURCERER_SHELL_ERROR ${JSON.stringify({ reason, recoverable })}\n`);
    };

    window.sourcererHideError = function sourcererHideError() {
      errorElement.style.display = "none";
      dump(`SOURCERER_SHELL_ERROR_CLEARED ${JSON.stringify({})}\n`);
    };

    window.sourcererRetry = function sourcererRetry() {
      errorElement.style.display = "none";
      TheiaService.retry();
    };

    errorRetryButton.addEventListener("click", () => {
      window.sourcererRetry();
    });

    // 05-03 (SHELL-04) owns sourcererShowDiagnostics; the control stays
    // disabled (sourcerer.xhtml) until that global exists, so this handler
    // never fires on an inert click -- left here as the wiring point.
    errorDiagnosticsButton.addEventListener("click", () => {
      if (typeof window.sourcererShowDiagnostics === "function") {
        window.sourcererShowDiagnostics();
      }
    });

    // Task 2 (04-03) proof-of-resolution: import SourcererAPI.sys.mjs and
    // read back two sidecar prefs through it, emitting an additional
    // sentinel. Left in place -- plan 04-04 keeps it.
    const backendMain = SourcererAPI.getStringPref("sourcerer.sidecar.backendMain", "");
    const nodePath = SourcererAPI.getStringPref("sourcerer.sidecar.nodePath", "");
    dump(`SOURCERER_SIDECAR_PREFS backendMain=${backendMain} nodePath=${nodePath}\n`);

    // 04-04: hand off to the backend supervisor. The shell-ready sentinel
    // above is already written -- nothing in this spawn path may run
    // before it.
    const { TheiaService } = ChromeUtils.importESModule("chrome://sourcerer/content/TheiaService.sys.mjs");
    // Announce shell readiness the way Firefox's own chrome does, so WebDriver
    // will create a session against the shell window.
    SourcererAPI.notifyStartupFinished(window);

    TheiaService.start(browserElement);
  },
  { once: true }
);
