---
schema_version: 1
open_count: 1
waived_count: 0
fixed_count: 0
total_count: 1
last_updated: 2026-08-21T01:39:11.591Z
---

# Broken Windows Ledger

> Cross-phase defect register. With `workflow.windows_enforce` enabled, `/gsd-ship` blocks while `open_count > 0`.
> Waive with `gsd-tools windows waive <id> "<reason>"` (reason required).
> Mark fixed with `gsd-tools windows fixed <id>`.

| id | phase | kind | file | line | description | status | reason | recorded_at | resolved_at |
|----|-------|------|------|------|-------------|--------|--------|-------------|-------------|
| 1 | 02 | stub | theia/extensions/customize/src/browser/sourcerer-privileged-js.ts |  | SourcererPrivilegedJsSurface.tabUriRegistry is always undefined -- @sourcerer/tab-uris (Plan 06) does not exist yet in this plan's dependency chain; no plan currently wires it up. | open |  | 2026-08-21T01:39:11.591Z |  |

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
  }
]
````
