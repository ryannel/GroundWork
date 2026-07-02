# Packaging & Updates

## The Toolchain Split

Two tools, one pipeline:

- **electron-vite builds.** One `electron.vite.config.ts` with `main`/`preload`/`renderer` sections → `out/`. Renderer HMR and main/preload hot-reload in dev; `utilityProcess` workers via `?modulePath`. Tailwind loads as a Vite plugin in the **renderer section only**.
- **Electron Forge packages.** `forge.config.ts` drives `@electron/packager`, the makers, signing hooks, and `@electron/fuses` — the officially recommended pipeline, maintained in the `electron/` org.

`package.json` `main` points at `out/main/index.js`, so packaging always consumes the built output; the `package` Nx target runs the build first. Forge's own Vite plugin remains experimental and lags Vite majors — keep the electron-vite + Forge pairing. **electron-builder** is the recorded escape hatch when packaging needs outgrow Forge's makers (exotic targets, NSIS specifics, staged-rollout updater); switching to it is a decision record, not a preference.

## Anatomy of forge.config.ts

The generated config has three load-bearing parts:

```ts
packagerConfig: {
  asar: true,                 // required for the integrity fuses to mean anything
  appBundleId: '<org>.<app>', // macOS bundle id; pairs with the AppUserModelID main sets
},
makers: [new MakerZIP({}, ['darwin', 'linux', 'win32'])],
plugins: [new FusesPlugin({ ... })],   // see references/security.md → Fuses
```

The fuses plugin is the part that must never be removed or moved out of the pipeline: it is what makes "an unhardened binary cannot ship" structurally true rather than procedurally hoped. `nodeCliInspect` stays on (Playwright `_electron` needs it); everything else is hardened per the table in `references/security.md`.

## Makers

ZIP is the scaffold's lowest-common-denominator maker — it packages on every host OS with no native tooling. Graduate per platform when distribution starts:

| Target | Maker | Notes |
|---|---|---|
| Windows installer | `@electron-forge/maker-squirrel` | Pairs with the Squirrel auto-update route; set `setupIcon`, match `appBundleId`/AppUserModelID |
| macOS disk image | `@electron-forge/maker-dmg` | Sign + notarize first or Gatekeeper rejects |
| Linux | `maker-deb` / `maker-rpm` | Needs `dpkg`/`rpm` on the build host |

Cross-platform makers generally require their native OS — package per-OS in CI matrix jobs, not on one machine.

## Code Signing

An unsigned build is a development artifact, never a release. Both platforms treat unsigned binaries as malware, because malware is what unsigned binaries usually are.

- **macOS:** Developer ID certificate + hardened runtime + entitlements, then notarization via `notarytool` (Forge wraps `@electron/notarize` — configure `osxSign`/`osxNotarize` in `packagerConfig`). `altool` is dead. Credentials arrive from CI secrets, never the repo.
- **Windows:** **Azure Artifact Signing** — cloud-HSM-backed, clears SmartScreen, runs from CI via signtool/jsign. USB-token OV/EV certificates cannot live in a pipeline; they are the legacy path. Naming and tooling currency (the product was recently renamed): `references/version-corrections.md`.

Signing config is wired in `forge.config.ts` when release credentials exist; until then the scaffold's unsigned `package` output is explicitly a dev artifact.

## Auto-Update Routes

Two sanctioned routes — pick by distribution model, record the choice:

1. **Open-source, GitHub-released:** `update-electron-app` (drop-in module) against **update.electronjs.org** — free, zero infrastructure, feeds the platform-native Squirrel updaters behind Electron's built-in `autoUpdater`. Serves only semver-tagged, non-draft releases.
2. **Everything else:** `electron-updater` with a generic/S3/GitHub feed — channels and staged rollouts included. Self-hosted feed servers only when rollout control demands them.

A hand-rolled update endpoint without semver and rollback discipline is an outage generator, not a third route.

## Update Discipline

Fixed rules, each one a classic self-inflicted outage when skipped:

- Never check for updates on `--squirrel-firstrun` — the install is still settling.
- Call `quitAndInstall()` only after the `update-downloaded` event.
- One in-flight `checkForUpdates()` at a time; double-calls corrupt state.
- `app.setAppUserModelId()` must match the Squirrel shortcut ID (the generated main sets it from the same `appId` as the bundle id) or Windows notifications detach.
- Staying inside the Electron support window is an update-discipline item (`references/version-corrections.md` → The currency window) — the auto-updater is the mechanism that makes the release cadence shippable.

## Version Hygiene

- `version` in `package.json` is what `app.getVersion()` reports, what the smoke sees, and what update feeds compare — bump it semver-honestly per release.
- Pin the Electron major deliberately (`^42.0.0` floats within the major; that is correct — patch releases are Chromium security fixes).
- When bumping the Electron major, run the full tier set including the smoke in CI before merging: driver/runtime pairings occasionally regress (`references/security.md`).
