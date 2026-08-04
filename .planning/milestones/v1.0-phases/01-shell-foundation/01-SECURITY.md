# SECURITY.md — Phase 1: Shell Foundation

**Audit date:** 2026-07-06
**ASVS Level:** 1
**block_on:** high
**Result:** SECURED — 5/5 threats closed, 0 open

This phase spans plans 01-01, 01-02, 01-03. The threat register below is the
deduplicated union of the three `<threat_model>` blocks (T-01-03 and T-01-SC
recur across plans; verified once against the shipped implementation).

## Threat Verification

| Threat ID | Category | Disposition | Status | Evidence |
|-----------|----------|-------------|--------|----------|
| T-01-01 | Elevation of Privilege | mitigate | CLOSED | `src-tauri/capabilities/default.json` permissions = `core:default`, `core:window:allow-minimize`, `allow-toggle-maximize`, `allow-close`, `allow-start-dragging`, `opener:default`; `windows:["main"]`. No `core:window:default` catch-all present. Exactly the four scoped window verbs, least-privilege. |
| T-01-03 | Tampering/Spoofing | mitigate | CLOSED | `src/shell/TitleBar.tsx:16` — `data-tauri-drag-region` on the flex spacer `<div>` only; LogoCluster and WindowControls carry none. `src/shell/TitleBar.test.tsx:26-41` asserts exactly one drag-region element, that it is not a BUTTON, does not contain the wordmark, and that none of the three control buttons carry the attribute. Human-verified in 01-03 (Task 1 step 7: drag on spacer only, no click swallowing). |
| T-01-14 | Configuration | accept | CLOSED | See Accepted Risks Log below. `tauri.conf.json:24` `security.csp = null` confirmed. Accept-condition holds: no remote content loads — `frontendDist:"../dist"` (local bundle), `devUrl:"http://localhost:1420"` (local dev server); no remote origins. |
| T-01-02 | Denial of Service | accept | CLOSED | See Accepted Risks Log below. `src/shell/WindowControls.tsx:9-15` `withWindow` wraps every command in `try/catch` with `fn(...).catch(console.error)`. All three handlers (minimize/toggleMaximize/close, lines 33/41/49) route through it. Accept-condition (fail silently, no cascading failure) holds. |
| T-01-SC | Tampering (supply chain) | mitigate | CLOSED | RESEARCH Package Legitimacy Audit cleared the dependency set (slopcheck OK, empty postinstall). 01-02 SUMMARY `tech-stack.added: []` — no new runtime deps introduced beyond 01-01's cleared set. Re-run slopcheck required for any future dependency (control below). |

## Accepted Risks Log

### T-01-14 — CSP is null (Configuration)
- **Disposition:** accept
- **Rationale:** Phase 1 is a frameless shell loading only locally bundled assets (`frontendDist: ../dist`) and a local dev server (`http://localhost:1420`). No remote or untrusted content is fetched into the webview, so a null Content-Security-Policy exposes no injection surface in this phase.
- **Condition monitored:** Remains acceptable ONLY while the webview loads no remote/untrusted content. The first phase that introduces remote URLs, external iframes, or user-supplied HTML MUST set a real `security.csp` before shipping.
- **Deferred to:** future hardening phase (RESEARCH Security Domain V14).

### T-01-02 — Window-command handlers fail silently (Denial of Service)
- **Disposition:** accept
- **Rationale:** Window commands target the local native window chrome (low-value, no remote actor). Per UI-SPEC there is no user-facing error UI for native chrome; failures are logged to console via `.catch(console.error)`. A failed minimize/maximize/close does not cascade or corrupt state.
- **Condition monitored:** Acceptable while handlers remain confined to local window operations with no security-relevant side effects. Revisit if window commands ever gate privileged or remote actions.

## Supply-Chain Control (T-01-SC standing rule)

Any newly added npm or cargo dependency MUST be run through the slopcheck /
Package Legitimacy Audit before it lands. Phase 1 added zero new runtime deps
beyond the pre-cleared set (per 01-02 SUMMARY `tech-stack.added: []`).

## Unregistered Flags

None. No `## Threat Flags` section appears in 01-01, 01-02, or 01-03 SUMMARY.md;
no new attack surface was declared during implementation.

## Notes

- Implementation files were not modified during this audit (read-only).
- `@tauri-apps/plugin-opener` (`opener:default` capability) is a scaffold default
  retained per 01-01 decision; it grants URL/path opening. Not in the Phase 1
  threat register and out of scope for this verification pass — flag for review
  if a future phase exposes it to untrusted input.
