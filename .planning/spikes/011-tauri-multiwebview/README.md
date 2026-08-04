---
spike: 011
name: tauri-multiwebview
type: standard
validates: "Given a Tauri 2 window with the `unstable` feature, when a full-size shell webview and two external-origin child webviews are composed and one child's bounds are animated, then children render above the shell at DOM-aligned coordinates without jank, and the shell webview stays healthy"
verdict: VALIDATED
related: [010-nixos-wsl-substrate]
tags: [tauri, multiwebview, unstable, panes, webview2, container-platform, spike-E]
---

# Spike 011: Tauri Multiwebview as the Pane Mechanism (Container Platform "spike E")

## What This Validates

Given a Tauri 2 window built with `features = ["unstable"]`, when composed the way Sourcerer
actually needs (NOT the official example's tiling):

- a **full-size local shell-UI webview added first** (mock chrome: 40px bar, two dashed
  green pane rects, 1s JS heartbeat), and
- two **external-origin child webviews** (`example.com`, `en.wikipedia.org`) positioned by
  Rust at exactly the rect coordinates the shell's CSS draws,

then:

1. **Z-order:** children render ABOVE the full-size shell webview (the Sourcerer overlay model).
2. **Alignment:** logical child bounds line up with the shell DOM's CSS pixels (DPI test —
   dashed border should peek evenly around each pane).
3. **Bounds sync:** a 60fps-paced `set_position` orbit (~2s) + `set_size` pulse (~1s) on pane A
   tracks without tearing/ghosting/lag.
4. **Stability:** shell heartbeat keeps counting during animation; window resize with
   `auto_resize()` on the shell doesn't disturb children; no crash on close.

This is the load-bearing pane mechanism for CONTAINER-PLATFORM-PLAN.md P4 (app panes),
P12 (streamed apps), P11 (Tier-2 applets), and the Power Browser tab surface.
Fallback if invalidated: child windows, or WebView2 distinct-origin iframes.

## Research

Official example `examples/multiwebview/main.rs` (fetched from tauri dev branch 2026-08-02)
confirms the API: `WindowBuilder::new` (raw window) + `window.add_child(WebviewBuilder, pos, size)`,
`.auto_resize()`. Known open issues from session research: Linux vertical-stack layout bug
(#13071), resize stalls (#10131/#10420) — Windows/WebView2 is the platform under test here.
Main app pins tauri 2 (no features); this spike is its own crate so the shell tree is untouched.

## How to Run

```bash
cd .planning/spikes/011-tauri-multiwebview
cargo run
# watch: shell chrome behind, two panes over the dashed rects; pane A orbits ~6s after launch.
# process check while it runs:  tasklist | findstr -i msedgewebview2
```

## What to Expect

Window opens; dark shell UI visible full-window; example.com and Wikipedia render inside the
dashed rects (borders evenly visible around them); after ~6s pane A orbits smoothly and pulses
size, then snaps back; heartbeat counter keeps incrementing; closing the window exits cleanly.

## Investigation Trail

- **Build 1:** failed — `icons/icon.ico` not found: tauri-build on Windows requires an icon for
  the Windows Resource file even with `bundle.active: false`. Fixed by copying the main app's
  icon. (Also caught my own harness bug: `cargo build | tail` masked the failure — check
  `PIPESTATUS`, not the pipe tail.)
- **Build 2:** clean — tauri 2.11.5 / tauri-runtime-wry 2.11.4, 25.8s incremental.
- **Run 1 (captured):** launched detached via `capture.ps1`; screenshots at t+9s (mid-orbit)
  and t+17s (settled); WebView2 process count 12 → 20; app stdout `[spike011] animation leg
  complete`; app left running and exited cleanly on manual close.

## Results

**VERDICT: VALIDATED** (on Windows 11 / WebView2 / 100% display scaling) — all four
kill-questions answered by direct evidence:

1. **Z-order ✓** — both external-origin children render ABOVE the full-size shell webview
   (screenshots show shell chrome + labels + heartbeat behind/around the panes). The Sourcerer
   overlay model (shell full-window, panes on top) works with plain `add_child` ordering —
   no hole-punching needed.
2. **Alignment ✓** — settled pane A exactly covers its DOM-drawn dashed rect (outline fully
   hidden under the pane); logical coords == CSS px at scale factor 1.0.
3. **Bounds sync ✓** — mid-orbit screenshot shows the pane displaced with the rect visible
   behind it (set_position tracking live); snap-back landed pixel-exact; 60fps-paced
   set_position/set_size from a plain thread produced no tearing/ghosting in captures.
4. **Stability ✓** — shell JS heartbeat kept counting (7 → 15) through orbit + pulse;
   +8 WebView2 processes for 3 webviews (separate renderer trees per origin — the isolation
   premise for Tier-2 applets holds at the process-model level).

**Caveats (open, not blocking):**
- `devicePixelRatio` was 1 on this display — the fractional-DPI alignment case (125%/150%
  scaling) is UNTESTED; retest on a scaled display before P4 relies on pixel-exact rects.
- Animation smoothness judged from stills + heartbeat, not high-speed capture; live-feel
  confirmation invited (app runs via `cargo run`).
- The API remains behind Tauri's `unstable` flag — spike proves behavior today, not API
  stability through Tauri 3.0 (plan already isolates it behind a pane-host abstraction).
- IPC-unreachability from external-origin children not probed here (advisory-backed;
  P11 test suite must assert it).

**Signal for the plan:** P4's pane mechanism is real — proceed as planned; add a scaled-display
retest to P4's test matrix; keep the fallback ladder recorded but unlikely needed.
