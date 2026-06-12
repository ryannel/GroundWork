---
title: Packaging & Updates
description: Electron Forge, electron-vite, auto-update routes, code signing, and fuse-flipping in the release pipeline.
status: active
last_reviewed: 2026-06-12
---
# Packaging & Updates

## TL;DR

Electron Forge packages and publishes; electron-vite builds. Auto-update is `update-electron-app` + update.electronjs.org for open-source apps, `electron-updater` feeds otherwise. Code signing on both platforms is non-optional, and fuses are flipped inside the packaging step so an unhardened binary cannot ship.

## Why this matters

Packaging is where the security posture becomes physical: signing, notarization, ASAR integrity, and fuses all happen here or not at all. It is also where users experience the app's lifecycle — an app that updates silently and reliably stays inside the 3-major security window; one with a hand-rolled update path drifts out of support and into known CVEs.

## Our principles

### 1. Electron Forge is the toolchain default

Forge is the officially recommended pipeline — maintained in the `electron/` GitHub org, composing the first-party tools (`@electron/packager`, `@electron/osx-sign`, `@electron/notarize`, `@electron/fuses`) into one configuration. **electron-builder** is the documented escape hatch when packaging needs outgrow Forge's makers (exotic targets, NSIS specifics, percentage rollouts via its updater); it is healthy and more downloaded, but "official" means Forge, and the default needs no justification in a decision record — the escape hatch does.

### 2. electron-vite is the build layer

electron-vite (v5, electron-vite.org) builds all three targets from one `electron.vite.config.ts` with `main`/`preload`/`renderer` sections — renderer HMR, main/preload hot-reload, and `utilityProcess` workers via `?modulePath`. Forge's own Vite plugin remains marked experimental and lags Vite majors, so the production pairing is electron-vite for the build and Forge for packaging. The renderer section is where web-stack build config lives — Tailwind v4 loads here as `@tailwindcss/vite`, applied to the renderer only; everything about how it is used defers to [TypeScript Frontend](../typescript/frontend.md).

### 3. Two sanctioned auto-update routes

- **Open-source, GitHub-released:** the drop-in `update-electron-app` module against **update.electronjs.org** — free, zero-infrastructure, feeding the platform-native Squirrel updaters behind Electron's built-in `autoUpdater`. It serves only semver-tagged, non-draft releases.
- **Everything else:** `electron-updater` with a generic, S3, or GitHub feed — channels and staged rollouts included. Self-hosted feed servers (Nucleus-style) only when rollout control demands them.

A hand-rolled update endpoint without semver and rollback discipline is an outage generator and is not a third route.

### 4. Update discipline is a fixed set of rules

- Never check for updates on `--squirrel-firstrun` — the install is still settling.
- Call `quitAndInstall()` only after the `update-downloaded` event.
- One in-flight `checkForUpdates()` at a time; double-calls corrupt state.
- Set `app.setAppUserModelId()` to match the Squirrel shortcut ID, or Windows notifications detach from the app.
- Staying inside the 3-major support window is an update-discipline item, not a backlog wish ([Security](security.md)).

### 5. Code signing is non-optional on both platforms

An unsigned build is a development artifact, never a release.

- **macOS:** Developer ID signing with the hardened runtime and entitlements, then notarization via `notarytool` (Forge wraps `@electron/notarize`). `altool` is dead; Gatekeeper rejects un-notarized apps outright.
- **Windows:** **Azure Artifact Signing** (renamed from Azure Trusted Signing; GA in US/Canada/Europe since Jan 2026) — cloud-HSM-backed, clears SmartScreen, runs from CI via signtool/jsign. It displaced OV/EV certificates on USB tokens, which cannot live in a pipeline.

### 6. Fuses are flipped inside the packaging step

`@electron/fuses` runs as part of the Forge packaging hook — `RunAsNode` off, `EnableEmbeddedAsarIntegrityValidation` and `OnlyLoadAppFromAsar` on ([Security](security.md) for why). Putting the flip in the pipeline rather than a checklist means a release artifact that skipped hardening cannot exist.

## Anti-patterns we reject

- **electron-packager as a standalone "toolchain."** It is a Forge internal (`@electron/packager`) now; driving it by hand re-implements Forge badly.
- **webpack-based Forge templates and boilerplates.** The ecosystem's motion is uniformly Vite; webpack templates receive no investment.
- **Shipping unsigned or un-notarized builds.** Both desktop platforms treat them as malware, because malware is what unsigned binaries usually are.
- **`altool`, USB-token certificates, and other pre-cloud signing flows.** They cannot run in CI, so they guarantee a human in the release loop.
- **Update checks wired to app startup with no event discipline.** First-run checks and premature `quitAndInstall()` are the two classic self-inflicted update outages.
