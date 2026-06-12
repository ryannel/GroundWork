---
title: Process Model
description: Main as orchestrator, sandboxed Node-free renderers, utilityProcess for heavy work, and the lint-enforced folder boundary.
status: active
last_reviewed: 2026-06-12
---
# Process Model

## TL;DR

Main orchestrates and nothing more. Renderers are fully sandboxed, context-isolated, and Node-free. Heavy or crash-prone work runs in a `utilityProcess` with MessagePorts wired renderer↔utility directly. The split is physical — `src/main` / `src/preload` / `src/renderer` / `src/shared` — and a lint rule enforces it.

## Why this matters

The main process owns the event loop that services every window: a CPU-heavy task in main freezes every UI the app has at once. A renderer with Node access turns any XSS into full machine compromise. The process model is where Electron apps are won or lost, and the flagship apps — VS Code, Slack, Signal, 1Password — have all converged on the same shape after learning this the hard way.

## Our principles

### 1. Main is an orchestrator

Main creates windows, registers IPC handlers, talks to the OS, and delegates. It never does CPU-heavy or blocking work — parsing large files, crypto, indexing, image processing all starve the UI event loop. If a task can take longer than a frame, it does not belong in main.

### 2. Renderers are sandboxed, context-isolated, and Node-free

Every renderer runs with the hardened quartet ([Security](security.md)) and imports nothing from Electron or Node. The renderer is a normal Vite + React web app whose only platform surface is the preload-exposed bridge object ([IPC Contracts](ipc-contracts.md)). This is what lets the renderer reuse the web frontend idiom wholesale — component, styling, and accessibility rules come from [TypeScript Frontend](../typescript/frontend.md) unchanged.

### 3. Heavy and crash-prone work runs in `utilityProcess`

`utilityProcess` is the documented home for CPU-intensive tasks, untrusted services, and components that may crash — a `child_process.fork` equivalent with Node enabled and MessagePort support. Wire MessagePorts **renderer↔utility directly** so the traffic never transits, or blocks, the main process. This is the VS Code pattern: its extension host moved out of the renderer into a `utilityProcess`, and VS Code contributed the API to Electron for exactly this purpose. electron-vite builds utility workers first-class via the `?modulePath` import suffix.

### 4. The folder split is enforced, not conventional

```
src/
  main/      # privileged orchestration — Node + Electron main APIs
  preload/   # the bridge — contextBridge only
  renderer/  # the web app — no Node, no Electron imports
  shared/    # IPC contract types — types only, imported by all three
```

A lint boundary (dependency-cruiser or ESLint import rules, the Slack pattern) fails the build when renderer code imports anything Node-touching. The rule exists because the boundary erodes one convenient import at a time, and each erosion is invisible until it is a sandbox hole. Each process target gets its own tsconfig — main and preload compile against Node types, the renderer against DOM types — so the compiler polices the boundary too.

### 5. Shared code crosses the boundary as types only

`src/shared/` holds the IPC contract types both sides consume ([IPC Contracts](ipc-contracts.md)) and nothing with runtime behaviour. A "utils" folder imported by both main and renderer is a process boundary leak: it drags Node-flavoured code toward the sandbox and couples the two sides' upgrade paths.

## Anti-patterns we reject

- **Node-enabled renderers.** Enabling `nodeIntegration` also silently disables the sandbox for that renderer — the settings only protect as a set.
- **Plugin or extension code in the renderer.** Untrusted code belongs in a `utilityProcess`, where a crash or compromise is contained.
- **CPU-heavy work in main.** It freezes every window. Move it to a utility process.
- **`child_process.fork` for work that talks to a renderer.** `utilityProcess` + MessagePorts replaced it; fork has no port wiring and no Services API integration.
- **A shared folder with runtime code.** Shared types, yes. Shared behaviour across the process boundary, no.
