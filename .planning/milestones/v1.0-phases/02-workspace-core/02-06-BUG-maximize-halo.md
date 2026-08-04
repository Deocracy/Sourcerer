# BUG: window shows dark halo band + odd edge-resize behavior

**Status:** CLOSED 2026-07-07 — root cause was DESIGN, not code. The reported state was WINDOWED mode (not maximized, as initially assumed); the "halo" was the handoff's D-03 20px floating-stage inset itself. Resolved by user decision: **card fills the window** (inset removed; 10px radius + 1px border at the true window edge; maximized stays square edge-to-edge).

## Root cause (final)
The D-03 "floating rounded window" (20px inset margin around the card, from the web-prototype handoff) reads as a defect on a real desktop window in windowed mode:
- transparent margin band → dark halo against dark backgrounds (shadow invisible);
- resize grips at the invisible OUTER window edge, 20px from the visible card edge;
- the margin band eats clicks aimed at windows behind it.
The user rejected both renderings (opaque stage = "black box outline"; transparent margin = "dark border shadow"). Maximize was a secondary casualty fixed along the way (see below) and was confirmed FINE by the user before the windowed-mode reframe.

## Kept fixes that ARE real (survive the redesign)
- Rust `on_window_event`: in-place `set_resizable(false)` while maximized (kills the unpainted WS_THICKFRAME band + edge grip), `set_resizable(true)` on restore. NO un/re-maximize kick — tao's `maximize()` no-ops on non-resizable windows.
- `useMaximizedState`: sequenced isMaximized() queries (stale async answers can't overwrite the newest).
- CSS state split windowed/maximized (now `.card` / `.cardMax`).

## Debug method that cracked it (for future reference)
Component bisection at the user's insistence, after 4 frozen fix attempts: React fully off (lime page) proved native was innocent → full app + on-screen DEV state badge proved isMaximized/CSS were correct → forced the realization the complaint was about the OTHER window state. Lesson: verify WHICH state/user-condition is being reported before fixing anything.
**Found during:** 02-06 consolidated human-verify (Phase 2 UAT gate)
**Environment:** Windows 11, monitor 2560×1600 physical, Tauri 2.11 window `decorations:false, transparent:true, shadow:false`, WebView2.

## Symptom
When the window is maximized ("full screen"), the app does not render edge-to-edge:
- a dark border/halo band is visible on all four sides;
- the app card still shows **rounded corners** (see user screenshot of bottom-left corner — radius clearly visible while maximized);
- the mouse can grab the screen edge and **resize** the window even though it is maximized.

## Established evidence (verified, not theory)
| # | Evidence | Source |
|---|----------|--------|
| E1 | Native maximize rect is CORRECT: `pos=(-8,-8) size=2576x1568` on 2560×1600 — window overhangs every screen edge by 8px; no desktop gap is geometrically possible from the window rect | Rust `on_window_event` logs, repeated across runs |
| E2 | Restore path works natively: `restored: pos≈(1154,270) size≈1221x893` and resize frame re-enabled | Rust logs |
| E3 | While maximized, the visible card still has ROUNDED corners → the **windowed CSS** (`.backdrop` 20px inset + `.card` radius) is applied, not `.cardMax` | user screenshot |
| E4 | In a plain browser (no Tauri), layout is correct: card inset 20px, title bar 40px full-width; no halo issue exists there (no maximize concept) | chrome-devtools measurements |
| E5 | `tauri.conf.json`: `shadow:false` already; capability now includes `core:window:allow-set-resizable` | config/file reads |
| E6 | First-round CSS fix (backdropMax/cardMax) initially DID collapse the chrome — user: "fixed, but still this odd border" (thin strip + grip remained). Full halo + radius REGRESSED after the Rust un/re-maximize kick was added | user reports over session |

## Deduction from E1+E3
The dark band is **inside the window** (transparent 20px CSS inset showing the desktop through the transparent window), not a native rect gap. Therefore the defect chain is: `isMaximized` (React state) is **false** while the window is natively maximized → windowed CSS stays applied.

## Fix attempts (frozen)
| # | Attempt | Result |
|---|---------|--------|
| 1 | CSS `backdropMax/cardMax` collapse driven by `useMaximizedState` | Worked initially (E6); thin strip + grip remained |
| 2 | JS `setResizable(!isMaximized)` | Silently rejected (missing capability), then superseded |
| 3 | Rust kick: `set_resizable(false) → unmaximize() → maximize()` | REGRESSED the working CSS collapse; suspected cause: tao `maximize()` no-ops on non-resizable windows → broken half-state |
| 4 | In-place `set_resizable(false)` on maximize (no kick) + sequenced `isMaximized()` queries | User reports unchanged (visual verdict pending final confirmation) |

## Open unknowns (what bisection must answer)
| U | Question | Instrument |
|---|----------|-----------|
| U1 | What does React's `isMaximized` actually read at the moment the halo is visible? | on-screen debug badge (DEV-only) |
| U2 | Does the webview viewport actually span the full window (innerWidth/Height vs screen)? | same badge |
| U3 | Which gesture is used to "full screen" (□ button / double-click / Win+↑ / snap)? Do all behave the same? | user, with badge visible |
| U4 | With the CSS layer forced to max (bypassing state), does the halo disappear entirely? | temporary `forceMax` query param |
| U5 | DPI scale factor (affects all px math) | badge (`devicePixelRatio`) |

## Bisection plan (one variable at a time)
1. **Instrument first** (no behavior change): DEV-only overlay badge showing `isMaximized`, `innerWidth×innerHeight`, `screen.width×height`, `devicePixelRatio`, applied CSS class. → answers U1/U2/U5 with one glance.
2. If `isMaximized=false` while maximized → the bug is the **state path** (event/IPC); bisect: remove Rust handler entirely (revert to stock window behavior), re-test badge.
3. If `isMaximized=true` but halo persists → the bug is **native painting** (frame/DWM); bisect window flags one at a time: `resizable:false` at config level → `transparent:false` → `decorations:true` control test.
4. Each step: exactly one change, then observe badge + screenshot.
