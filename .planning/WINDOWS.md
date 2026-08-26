---
schema_version: 1
open_count: 2
waived_count: 0
fixed_count: 0
total_count: 2
last_updated: 2026-08-26T22:15:58.074Z
---

# Broken Windows Ledger

> Cross-phase defect register. With `workflow.windows_enforce` enabled, `/gsd-ship` blocks while `open_count > 0`.
> Waive with `gsd-tools windows waive <id> "<reason>"` (reason required).
> Mark fixed with `gsd-tools windows fixed <id>`.

| id | phase | kind | file | line | description | status | reason | recorded_at | resolved_at |
|----|-------|------|------|------|-------------|--------|--------|-------------|-------------|
| 1 | 02 | stub | theia/extensions/customize/src/browser/sourcerer-privileged-js.ts |  | SourcererPrivilegedJsSurface.tabUriRegistry is always undefined -- @sourcerer/tab-uris (Plan 06) does not exist yet in this plan's dependency chain; no plan currently wires it up. | open |  | 2026-08-21T01:39:11.591Z |  |
| 2 | 04 | unrun-verify | sourcerer/shell/sourcerer.xhtml |  | Task 1/3 <verify>: live launch of objdir/dist/bin/sourcerer could not be confirmed end-to-end (SOURCERER_SHELL_READY sentinel, single-window paint). Blocked by a pre-existing content-process IPC failure (RenderCompositorSWGL framebuffer error -> repeated channel errors) reproduced identically on the untouched Phase-3 objdir-release binary -- confirmed environmental, not caused by this plan's code. | open |  | 2026-08-26T22:15:58.074Z |  |

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
    "description": "Task 1/3 <verify>: live launch of objdir/dist/bin/sourcerer could not be confirmed end-to-end (SOURCERER_SHELL_READY sentinel, single-window paint). Blocked by a pre-existing content-process IPC failure (RenderCompositorSWGL framebuffer error -> repeated channel errors) reproduced identically on the untouched Phase-3 objdir-release binary -- confirmed environmental, not caused by this plan's code.",
    "status": "open",
    "reason": "",
    "recorded_at": "2026-08-26T22:15:58.074Z",
    "resolved_at": null
  }
]
````
