---
title: Electron Desktop Shell
description: Process model, IPC contracts, security defaults, and packaging for Electron desktop applications.
status: active
last_reviewed: 2026-06-12
---
# Electron Desktop Shell

## TL;DR

Electron is GroundWork's standard desktop surface. This set owns what the desktop shell adds over a web app: the process model, the IPC seam, the security posture, and packaging/updates. Everything the renderer shares with a web frontend — component idiom, styling, accessibility, design-system discipline — is owned by [TypeScript Frontend](../typescript/frontend.md) and is not restated here.

## Why Electron

[Surface Stack Selection](../../surface-stack-selection.md) picks Electron on the agent-closable-loop axis: Electron renders on bundled Chromium, so Playwright's `_electron` driver launches the real packaged app, drives its windows as ordinary `Page`s, and evaluates code in the main process — one deterministic engine on every OS, headless under Xvfb in CI. No other desktop option closes generate → boot → test → observe without a human in the loop. The renderer reusing the web stack and brand-token projection wholesale is the second axis win. Tauri is the recorded alternative when binary size and RAM dominate — its per-OS system webviews and WebDriver-only testing surrender the loop, so it is never the default.

## What this set owns

| File | Owns |
|---|---|
| [Process Model](process-model.md) | Main/renderer/utility split, `utilityProcess`, the enforced folder boundary |
| [IPC Contracts](ipc-contracts.md) | The typed bridge, validation at the process seam, renderer data fetching over IPC |
| [Security](security.md) | The hardened defaults, fuses, navigation and permission policy |
| [Packaging & Updates](packaging-and-updates.md) | Forge, electron-vite, auto-update routes, code signing |

The split follows the capability-core model: the renderer is a thin surface adapter, and the desktop shell's job is to host it safely. Where the shell adds something to the renderer's world, the addition lives here and the rest defers:

- **Tailwind v4** loads as a Vite plugin (`@tailwindcss/vite`) in the **renderer section** of `electron.vite.config.ts` — no `tailwind.config.js`; brand tokens live as CSS custom properties via `@theme`. Composition rules: [TypeScript Frontend](../typescript/frontend.md).
- **Theme sync** is `nativeTheme` in main, broadcast over IPC, mapped to an attribute on `<html>`. What the theme contains: [TypeScript Frontend](../typescript/frontend.md).
- Everything else about components, styling, and accessibility: [TypeScript Frontend](../typescript/frontend.md), unmodified.

## Currency is a security obligation

Electron 42 is current (released 2026-05-05, Chromium M148, Node 24). A new major ships every 8 weeks, and only the latest **three** majors receive security patches — Chromium CVEs land in your app on that clock whether you upgrade or not. An app more than three majors behind is out of security support, so the upgrade cadence is scheduled work, not deferred maintenance. Pin the version, take every major within its support window, and treat a skipped window as a security finding.

## Survey basis

Authored from the Electron ecosystem survey dated **2026-06-12**. Load-bearing sources:

- [Electron security checklist](https://www.electronjs.org/docs/latest/tutorial/security) and [process model](https://www.electronjs.org/docs/latest/tutorial/process-model) — the official baseline.
- [IPC tutorial](https://www.electronjs.org/docs/latest/tutorial/ipc) and [`utilityProcess` API](https://www.electronjs.org/docs/latest/api/utility-process).
- [endoflife.date/electron](https://endoflife.date/electron) and [Electron timelines](https://www.electronjs.org/docs/latest/tutorial/electron-timelines) — version and support windows.
- [VS Code sandbox migration](https://code.visualstudio.com/blogs/2022/11/28/vscode-sandbox) and [Slack: The App Sandbox](https://slack.engineering/the-app-sandbox/) — the reference process architectures.
- [Trail of Bits, CVE-2025-55305](https://blog.trailofbits.com/2025/09/03/subverting-code-integrity-checks-to-locally-backdoor-signal-1password-slack-and-more/) — why fuses are now expected.
- [Why Electron Forge](https://www.electronforge.io/core-concepts/why-electron-forge), [electron-vite](https://electron-vite.org/guide/) (v5, alex8088), [Updating Applications](https://www.electronjs.org/docs/latest/tutorial/updates), [update.electronjs.org](https://github.com/electron/update.electronjs.org).
- [Playwright Electron class](https://playwright.dev/docs/architecture/api/class-electron) — the loop driver.
- [Azure Artifact Signing](https://azure.microsoft.com/en-us/products/artifact-signing) — Windows signing (renamed from Trusted Signing, GA Jan 2026).
