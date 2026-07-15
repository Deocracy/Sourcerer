---
sketch: 006
name: settings
question: "Corpus settings vs app settings — one place or two?"
winner: null
tags: [settings, providers, tiers]
---

# Sketch 006: Settings

## Design Question

Two different scopes exist: **app-wide** settings (LLM/embedding providers + API keys, corpora root, general behavior) and **per-corpus** settings (feature tier, agent permissions, engine sidecar, OKF export). One unified screen, or split by scope?

## How to View

open .planning/sketches/006-settings/index.html

## Variants

- **A: One Settings Screen** — a single Settings destination with a sectioned sidebar: App (Providers & Keys, General) above Corpus (Tier, Permissions, Engine, OKF). Everything in one place.
- **B: Split — Corpus vs App** — corpus settings live as the Settings item inside the corpus rail (sketch 004); app-wide settings open separately from the title-bar gear.
- **C: Launcher Gear + Modal** — a ⚙ on each corpus row in the launcher opens that corpus's settings as a modal; app settings behind the title-bar gear.

All variants use real Databasise shapes: tier cards (Library / Wiki / Wiki+Graph, Wiki default), agent-permission toggles (destructive requires `_confirm`), engine sidecar status (pid/port/pinned contract), OKF export/import/mirror, and the TRUST-01 trust-doc link in the footer.

## What to Look For

- When you change an API key, do you *think* "app setting" (B/C's separation) or just "settings" (A)?
- B keeps corpus settings one click away while working in the corpus — worth splitting settings across two homes?
- C's modal is fastest from the launcher but modals get cramped — click a ⚙ and judge.
- Tier cards + permission toggles: is this the right level of control for an average person, or already too knobby?
