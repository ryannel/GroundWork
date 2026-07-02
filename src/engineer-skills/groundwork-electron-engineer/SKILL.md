---
name: groundwork-electron-engineer
description: >
  Implement, review, and refactor Electron desktop applications using the
  hardened main/preload/renderer process model, typed IPC contracts with
  runtime validation, enforced security defaults, fuse-hardened Forge
  packaging, and Playwright _electron boot smokes. Use for work touching the
  main process, preload bridges, IPC channels, BrowserWindow configuration,
  contextBridge, utilityProcess, auto-update, code signing, desktop packaging,
  nativeTheme, or Electron testing. Make sure to use this skill whenever a
  user is working in an Electron codebase, building desktop shell features,
  fixing desktop app bugs, or reviewing Electron code.
---

# Electron Engineer

Desktop execution engineer for Electron applications. This skill guides implementation within the flagship-app architecture — a privileged main process that only orchestrates, fully sandboxed Node-free renderers behind a narrow typed bridge, security defaults that are baked rather than advisory, and a boot smoke driven by Playwright's `_electron` driver, the agent-closable loop this stack was chosen for.

## Operating Rules

1. Locate the process before editing. Main, preload, renderer, and shared each have distinct responsibilities and their own compiler context; a change that blurs the boundary is wrong even when it works.
2. The capability core owns business logic. The renderer is a thin surface adapter, and privileged core access belongs on main's side of the IPC seam — never re-implement a rule the core's contract already proves.
3. Route durable desktop policy to the canonical docs (`docs/principles/stack/electron/`) instead of duplicating it in code comments or this skill.
4. Verify typecheck (both tsconfigs), lint (including the boundary rules), unit tests, and — for shell-touching changes — the boot smoke before declaring work complete.

## Code intelligence (repo map + Serena)

Orient before reading widely: `.groundwork/skills/code-intelligence.md` covers the repo map (hub-finding by centrality) and Serena (LSP-backed symbol navigation and edits) in full, including degraded mode. TypeScript's compiler already catches a missed call site within one process's tsconfig, so treat `find_referencing_symbols` as a blast-radius and navigation win rather than a correctness gate — it earns its keep tracing a shared IPC type across the main/preload/renderer boundary, where compilation is siloed per process.

## Core Pillars

1. **Main Is an Orchestrator** — Window creation, security policy, IPC registration, OS integration. CPU-heavy or crash-prone work runs in a `utilityProcess` with MessagePorts wired renderer↔utility directly. A blocked main process freezes every window the app has.

2. **The Renderer Is a Web App** — Sandboxed, context-isolated, Node-free; its only platform surface is the preload-exposed `window.api`. Everything it shares with the web stack — component idiom, styling, accessibility — follows the web rules unchanged (see the deferrals below).

3. **IPC Is a Contract Boundary** — One shared channel-map type consumed by both sides; `invoke`/`handle` for two-way; sender validation in every handler and zod validation for non-trivial payloads. The seam gets the same discipline the core enforces at its contracts.

4. **Security Defaults Are Baked** — The hardened quartet, denied-by-default permissions, restricted navigation, allowlisted `openExternal`, custom-protocol content, strict CSP, and package-time fuses. None of these is a hardening backlog item; loosening one is a defect.

5. **The Smoke Closes the Loop** — Playwright `_electron` launches the real built app, drives its window as an ordinary Page, and evaluates in the main process — headless under xvfb in CI. Generate → boot → test → observe, no human in the loop.

## How to Use This Skill

**Orient first** — see Code intelligence above; it is the first step, not optional. Then match the user's task to the smallest relevant reference set. Most tasks touch one or two references.

| Topic | Reference | Load When |
|-------|-----------|-----------|
| Process Model | `references/process-model.md` | Placing new code, main vs preload vs renderer vs shared, utilityProcess, the enforced folder boundary. |
| IPC Contracts | `references/ipc-contracts.md` | Adding or changing channels, the bridge, validation at the seam, TanStack Query over IPC, push events. |
| Security | `references/security.md` | BrowserWindow options, permissions, navigation, openExternal, CSP, the custom protocol, fuses, Electron upgrades. |
| Packaging & Updates | `references/packaging-and-updates.md` | Forge config, makers, fuses at package time, code signing, notarization, auto-update routes. |
| Testing & Smoke | `references/testing-and-smoke.md` | The three test tiers, Playwright `_electron` patterns, xvfb CI, skip-with-reason guards. |
| Theming & Tokens | `references/theming-and-tokens.md` | The generated brand.css, Tailwind token mapping, nativeTheme sync, dark mode on desktop. |
| Performance & Reliability | `references/performance-and-reliability.md` | Main never blocks, renderer/bundle perf, IPC batching, long-lived-window memory, cold boot, gateway resilience. |
| Observability | `references/observability.md` | Two-process crash reporting, structured logs across IPC, app/update telemetry, PII discipline. |
| Documentation | `references/documentation.md` | The typed IPC contract as documentation, TSDoc on the bridge, process-boundary why-comments. |

## Shared with the web stack — deferrals

The renderer is a normal Vite + React web app, and the web stack's rules apply to it unchanged. That knowledge is owned by the Next.js engineer skill (`.agents/skills/groundwork-nextjs-engineer/`, installed alongside any web surface) and by `docs/principles/stack/typescript/frontend.md` (always deployed with this app); it is deliberately **not** duplicated here:

- **Component idiom, composition, and visual language** → `groundwork-nextjs-engineer/references/visual-language.md` and `groundwork-nextjs-engineer/references/ux-principles.md`. Skip the App Router / Server Component material — an Electron renderer is fully client-side and has no server boundary.
- **Tailwind usage and styling discipline** → `groundwork-nextjs-engineer/references/tailwind-and-styling.md`. Only the desktop delta (the generated token file, nativeTheme sync) lives in this skill's `references/theming-and-tokens.md`.
- **Data-fetching discipline** (cache-layer rules, no fetch-in-useEffect) → `groundwork-nextjs-engineer/references/data-fetching.md`. The transport here is the IPC bridge with TanStack Query instead of SWR over HTTP — that delta is in `references/ipc-contracts.md`.
- **Accessibility** → `groundwork-nextjs-engineer/references/accessibility.md` and `groundwork-nextjs-engineer/references/testing.md` (Accessibility Testing). Desktop changes nothing about it.
- **Component testing idiom** (Testing Library patterns, what to assert) → `groundwork-nextjs-engineer/references/testing.md`. This skill's testing reference covers only what the shell adds: the process-split test projects and the `_electron` smoke.

When the workspace has no web surface, the same canon is available as `docs/principles/stack/typescript/frontend.md` in the project's deployed docs.

## Task Routing

- **New capability reaching the shell** → Load `references/ipc-contracts.md`. Contract type first, then handler (validated), then bridge method, then the renderer query.
- **New window / shell behaviour** → Load `references/process-model.md` and `references/security.md`. The quartet and the policy handlers apply to every window, no exceptions.
- **Heavy work (parsing, crypto, indexing)** → Load `references/process-model.md`. It goes in a `utilityProcess`, not main.
- **UI/visual work** → Load `references/theming-and-tokens.md`, then defer to the web stack's styling references. Check the generated token file before adding any colour.
- **Release/packaging work** → Load `references/packaging-and-updates.md`. Fuses and signing live in the pipeline; signing material never enters the repo.
- **Test work** → Load `references/testing-and-smoke.md`. Pick the cheapest tier that can carry the assertion; the smoke stays thin.
- **External content or user-influenced URLs — `openExternal` targets, navigation, protocol handlers, files from disk** → Load `references/security.md`. The allowlists are the boundary; extending one is a security decision.
- **Electron upgrade** → Load `references/security.md` (currency window). Treat a skipped support window as a security finding.
- **Performance / responsiveness work** → Load `references/performance-and-reliability.md`. Main never blocks; SLOs and load shedding live in the core.
- **Crash reporting / telemetry** → Load `references/observability.md`. Both processes report; distributed tracing lives at the services the app calls.

## Safety Gates

- Do not loosen the hardened quartet — `contextIsolation: true`, `sandbox: true`, `nodeIntegration: false`, `webSecurity: true` — for any window, flag, or debugging session.
- Do not expose `ipcRenderer`, any Electron module, or a generic `invoke` passthrough on `window`; the bridge stays narrow and purpose-named.
- Do not add an IPC handler without sender validation, or accept a non-trivial payload without zod parsing.
- Do not import Electron or Node built-ins in `src/renderer/` or `src/shared/` — the lint boundary and per-process tsconfigs enforce this; a suppression comment is a review finding.
- Do not serve app content over `file://` or weaken the CSP to unblock a feature.
- Do not ship a build whose fuses were not flipped by the packaging pipeline, and do not flip `nodeCliInspect` off — it breaks the Playwright `_electron` loop.
- Run typecheck, lint, and unit tests where the toolchain is available; report a tier as skipped-with-reason (never silently green) where it is not.

## Hallucination Controls

Before presenting Electron guidance as factual:

- Check `package.json` for the actual Electron major and available dependencies; the support window moves every 8 weeks.
- Check `src/shared/ipc.ts` for the real channel map before referencing or inventing channels.
- Check `src/main/policy.ts` for the actual navigation/permission/external-URL rules before describing the app's security behaviour.
- Check `electron.vite.config.ts` and `forge.config.ts` for the real build/packaging shape before recommending tooling changes.
- Label any recommendation based on general Electron knowledge (rather than project-specific patterns) as an inference.

## Output Expectations

- Changes name the process each touched file runs in and why the code belongs there.
- IPC changes show all four pieces: contract type, validated handler, bridge method, renderer consumption.
- Shell changes state their security impact explicitly, even when it is "none".
- Verification steps name the specific Nx targets (`typecheck`, `lint`, `test`, `smoke`) with the skipped-with-reason caveat where the binary or display is absent.
- Recommendations distinguish project conventions from general Electron practice.

## Antipatterns

Reject these patterns:

- **Node-enabled renderers** — `nodeIntegration: true` also silently kills the sandbox for that renderer; the controls fail as a set.
- **Raw ipcRenderer on window** — The bridge exists to be narrow; this makes it infinitely wide.
- **`sendSync`** — Blocks the renderer event loop. There is always an async shape.
- **Untyped ad-hoc channels** — A channel missing from the shared contract is a seam that drifts silently.
- **Trusting renderer input in main** — Compile-time types are not runtime guarantees; validate sender and payload.
- **CPU-heavy work in main** — It freezes every window. `utilityProcess` exists.
- **Shared folders with runtime code** — `src/shared/` carries types only; shared behaviour leaks Node toward the sandbox.
- **`webSecurity: false` or CSP wildcards to "unblock" development** — Fix the content, not the boundary.
- **Un-fused release builds** — Post-CVE-2025-55305, ASAR integrity off is a shipping defect.
- **Fat smoke suites** — The smoke proves boot and wiring; rules are proven in unit tiers and at the core's contract.
