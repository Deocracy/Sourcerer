---
schema_version: 1
open_count: 3
waived_count: 0
fixed_count: 3
total_count: 6
last_updated: 2026-08-27T00:59:23.557Z
---

# Broken Windows Ledger

> Cross-phase defect register. With `workflow.windows_enforce` enabled, `/gsd-ship` blocks while `open_count > 0`.
> Waive with `gsd-tools windows waive <id> "<reason>"` (reason required).
> Mark fixed with `gsd-tools windows fixed <id>`.

| id | phase | kind | file | line | description | status | reason | recorded_at | resolved_at |
|----|-------|------|------|------|-------------|--------|--------|-------------|-------------|
| 1 | 02 | stub | theia/extensions/customize/src/browser/sourcerer-privileged-js.ts |  | SourcererPrivilegedJsSurface.tabUriRegistry is always undefined -- @sourcerer/tab-uris (Plan 06) does not exist yet in this plan's dependency chain; no plan currently wires it up. | open |  | 2026-08-21T01:39:11.591Z |  |
| 2 | 04 | unrun-verify | sourcerer/shell/sourcerer.xhtml |  | RESOLVED / MISDIAGNOSED: this was never environmental. The RenderCompositorSWGL message appears identically on the untouched Phase-3 binary and is harmless noise; anchoring on it hid the real cause. sourcerer.xhtml was not well-formed XML (an XML comment cannot contain '--'), so the shell never parsed, sourcerer.js never ran and no backend was ever spawned. Five further defects sat behind it (CSP dropping the inline <style> -> 0x0 viewport; no root width/height; an already-expired cookie aExpiry -> 403; sleep() passing {observe} to initWithCallback -> stalled health loop; _swap() using ownerGlobal). Fixed in commits 1bceacd and b97cb5b; verify-phase-04.sh is now 10/10 and verify-phase-02.sh back to 5/5. The discriminator that settles it: a WebDriver BiDi session succeeds against objdir-release and failed against objdir. | fixed |  | 2026-08-26T22:15:58.074Z | 2026-08-27T00:57:31.545Z |
| 3 | 04 | unrun-verify | sourcerer/shell/TheiaService.sys.mjs |  | RESOLVED / MISDIAGNOSED: this was never environmental. The RenderCompositorSWGL message appears identically on the untouched Phase-3 binary and is harmless noise; anchoring on it hid the real cause. sourcerer.xhtml was not well-formed XML (an XML comment cannot contain '--'), so the shell never parsed, sourcerer.js never ran and no backend was ever spawned. Five further defects sat behind it (CSP dropping the inline <style> -> 0x0 viewport; no root width/height; an already-expired cookie aExpiry -> 403; sleep() passing {observe} to initWithCallback -> stalled health loop; _swap() using ownerGlobal). Fixed in commits 1bceacd and b97cb5b; verify-phase-04.sh is now 10/10 and verify-phase-02.sh back to 5/5. The discriminator that settles it: a WebDriver BiDi session succeeds against objdir-release and failed against objdir. | fixed |  | 2026-08-26T22:32:50.525Z | 2026-08-27T00:57:31.748Z |
| 4 | 04 | unrun-verify | .planning/phases/04-full-window-theia-shell/04-MANUAL-VERIFICATION.md |  | RESOLVED / MISDIAGNOSED: this was never environmental. The RenderCompositorSWGL message appears identically on the untouched Phase-3 binary and is harmless noise; anchoring on it hid the real cause. sourcerer.xhtml was not well-formed XML (an XML comment cannot contain '--'), so the shell never parsed, sourcerer.js never ran and no backend was ever spawned. Five further defects sat behind it (CSP dropping the inline <style> -> 0x0 viewport; no root width/height; an already-expired cookie aExpiry -> 403; sleep() passing {observe} to initWithCallback -> stalled health loop; _swap() using ownerGlobal). Fixed in commits 1bceacd and b97cb5b; verify-phase-04.sh is now 10/10 and verify-phase-02.sh back to 5/5. The discriminator that settles it: a WebDriver BiDi session succeeds against objdir-release and failed against objdir. | fixed |  | 2026-08-26T22:55:36.043Z | 2026-08-27T00:57:31.951Z |
| 5 | 04 | unmet-truth | sourcerer/endpoint-allowlist.json |  | verify-phase-03's verify-endpoints now FAILS: with the shell actually working, Gecko resolves three hosts absent from the BRAND-04 allowlist -- 127.0.0.1 (the Theia sidecar; expected, and the architecture), plus ciscobinary.openh264.org (GMP manager, now woken by a real content page being loaded) and github.com (reached by the Theia FRONTEND running inside the browser). Not a code defect: Phase 4 introduces a network surface the D-83..D-88 allowlist never contemplated. Each existing entry carries a reasoned decision, so adding these needs a product/privacy decision, not a mechanical edit. | open |  | 2026-08-27T00:59:23.344Z |  |
| 6 | 04 | unmet-truth | sourcerer/shell/sourcerer.xhtml |  | verify-phase-03's verify-branding-identity-dev now FAILS on its about-support surface only (all 5 other surfaces PASS; the release variant fully PASSES). The check reads branding from about:support via WebDriver, but the shell's single <browser> is pinned remoteType=web and about:support needs a privileged-about remote type. Consistent with v4.0 intent -- Theia is the only GUI, no URL bar, so about: pages are unreachable by design -- but the check needs a different mechanism (read branding chrome-side), or v4.0 accepts about: pages are unreachable until the post-4.0 tab model brings remote-type switching. Needs a decision. | open |  | 2026-08-27T00:59:23.557Z |  |

````json
[
  {
    "id": 1,
    "kind": "stub",
    "phase": "02",
    "file": "theia/extensions/customize/src/browser/sourcerer-privileged-js.ts",
    "line": null,
    "description": "SourcererPrivilegedJsSurface.tabUriRegistry is always undefined -- @sourcerer/tab-uris (Plan 06) does not exist yet in this plan's dependency chain; no plan currently wires it up.",
    "status": "open",
    "reason": "",
    "recorded_at": "2026-08-21T01:39:11.591Z",
    "resolved_at": null
  },
  {
    "id": 2,
    "kind": "unrun-verify",
    "phase": "04",
    "file": "sourcerer/shell/sourcerer.xhtml",
    "line": null,
    "description": "RESOLVED / MISDIAGNOSED: this was never environmental. The RenderCompositorSWGL message appears identically on the untouched Phase-3 binary and is harmless noise; anchoring on it hid the real cause. sourcerer.xhtml was not well-formed XML (an XML comment cannot contain '--'), so the shell never parsed, sourcerer.js never ran and no backend was ever spawned. Five further defects sat behind it (CSP dropping the inline <style> -> 0x0 viewport; no root width/height; an already-expired cookie aExpiry -> 403; sleep() passing {observe} to initWithCallback -> stalled health loop; _swap() using ownerGlobal). Fixed in commits 1bceacd and b97cb5b; verify-phase-04.sh is now 10/10 and verify-phase-02.sh back to 5/5. The discriminator that settles it: a WebDriver BiDi session succeeds against objdir-release and failed against objdir.",
    "status": "fixed",
    "reason": "",
    "recorded_at": "2026-08-26T22:15:58.074Z",
    "resolved_at": "2026-08-27T00:57:31.545Z"
  },
  {
    "id": 3,
    "kind": "unrun-verify",
    "phase": "04",
    "file": "sourcerer/shell/TheiaService.sys.mjs",
    "line": null,
    "description": "RESOLVED / MISDIAGNOSED: this was never environmental. The RenderCompositorSWGL message appears identically on the untouched Phase-3 binary and is harmless noise; anchoring on it hid the real cause. sourcerer.xhtml was not well-formed XML (an XML comment cannot contain '--'), so the shell never parsed, sourcerer.js never ran and no backend was ever spawned. Five further defects sat behind it (CSP dropping the inline <style> -> 0x0 viewport; no root width/height; an already-expired cookie aExpiry -> 403; sleep() passing {observe} to initWithCallback -> stalled health loop; _swap() using ownerGlobal). Fixed in commits 1bceacd and b97cb5b; verify-phase-04.sh is now 10/10 and verify-phase-02.sh back to 5/5. The discriminator that settles it: a WebDriver BiDi session succeeds against objdir-release and failed against objdir.",
    "status": "fixed",
    "reason": "",
    "recorded_at": "2026-08-26T22:32:50.525Z",
    "resolved_at": "2026-08-27T00:57:31.748Z"
  },
  {
    "id": 4,
    "kind": "unrun-verify",
    "phase": "04",
    "file": ".planning/phases/04-full-window-theia-shell/04-MANUAL-VERIFICATION.md",
    "line": null,
    "description": "RESOLVED / MISDIAGNOSED: this was never environmental. The RenderCompositorSWGL message appears identically on the untouched Phase-3 binary and is harmless noise; anchoring on it hid the real cause. sourcerer.xhtml was not well-formed XML (an XML comment cannot contain '--'), so the shell never parsed, sourcerer.js never ran and no backend was ever spawned. Five further defects sat behind it (CSP dropping the inline <style> -> 0x0 viewport; no root width/height; an already-expired cookie aExpiry -> 403; sleep() passing {observe} to initWithCallback -> stalled health loop; _swap() using ownerGlobal). Fixed in commits 1bceacd and b97cb5b; verify-phase-04.sh is now 10/10 and verify-phase-02.sh back to 5/5. The discriminator that settles it: a WebDriver BiDi session succeeds against objdir-release and failed against objdir.",
    "status": "fixed",
    "reason": "",
    "recorded_at": "2026-08-26T22:55:36.043Z",
    "resolved_at": "2026-08-27T00:57:31.951Z"
  },
  {
    "id": 5,
    "kind": "unmet-truth",
    "phase": "04",
    "file": "sourcerer/endpoint-allowlist.json",
    "line": null,
    "description": "verify-phase-03's verify-endpoints now FAILS: with the shell actually working, Gecko resolves three hosts absent from the BRAND-04 allowlist -- 127.0.0.1 (the Theia sidecar; expected, and the architecture), plus ciscobinary.openh264.org (GMP manager, now woken by a real content page being loaded) and github.com (reached by the Theia FRONTEND running inside the browser). Not a code defect: Phase 4 introduces a network surface the D-83..D-88 allowlist never contemplated. Each existing entry carries a reasoned decision, so adding these needs a product/privacy decision, not a mechanical edit.",
    "status": "open",
    "reason": "",
    "recorded_at": "2026-08-27T00:59:23.344Z",
    "resolved_at": null
  },
  {
    "id": 6,
    "kind": "unmet-truth",
    "phase": "04",
    "file": "sourcerer/shell/sourcerer.xhtml",
    "line": null,
    "description": "verify-phase-03's verify-branding-identity-dev now FAILS on its about-support surface only (all 5 other surfaces PASS; the release variant fully PASSES). The check reads branding from about:support via WebDriver, but the shell's single <browser> is pinned remoteType=web and about:support needs a privileged-about remote type. Consistent with v4.0 intent -- Theia is the only GUI, no URL bar, so about: pages are unreachable by design -- but the check needs a different mechanism (read branding chrome-side), or v4.0 accepts about: pages are unreachable until the post-4.0 tab model brings remote-type switching. Needs a decision.",
    "status": "open",
    "reason": "",
    "recorded_at": "2026-08-27T00:59:23.557Z",
    "resolved_at": null
  }
]
````
