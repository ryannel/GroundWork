---
title: Security
description: The hardened quartet, CSP, navigation and permission policy, fuses, and the currency window — enforced defaults, not advice.
status: active
last_reviewed: 2026-06-12
---
# Security

## TL;DR

Electron's security checklist is our enforced baseline, not a menu. The quartet — `contextIsolation: true`, `sandbox: true`, `nodeIntegration: false`, `webSecurity: true` — never changes. CSP is required, permissions and navigation are explicitly handled, local content ships over a custom protocol, and fuses are flipped at package time. Staying inside the 3-major support window is itself a security control.

## Why this matters

An Electron app is a browser with a privileged process attached. Every web vulnerability the renderer inherits becomes a local-machine vulnerability the moment a boundary control is loosened — and the controls fail as a set, not individually: enabling `nodeIntegration` silently disables the sandbox for that renderer. CVE-2025-55305 showed that even apps with the runtime controls right (Signal, Slack, 1Password) were backdoorable at rest because packaging integrity was left off. The baseline below is what "done" means.

## The enforced defaults

### 1. The quartet is never changed

```ts
new BrowserWindow({
  webPreferences: {
    contextIsolation: true,   // default since 12 — never off
    sandbox: true,            // default since 20 — never off
    nodeIntegration: false,   // default since 5 — never on
    // webSecurity defaults true — never off, not even "temporarily for dev"
  },
});
```

These are Electron's defaults; our rule is that no code path, flag, or debugging session turns them off. `webSecurity: false` and `allowRunningInsecureContent` as debugging crutches are how production apps ship with the front door open.

### 2. A CSP is required

Every renderer ships a Content-Security-Policy — HTTP header where content is served, `<meta http-equiv>` for custom-protocol content. `default-src 'self'`-style strictness is achievable because all privileged data flows over IPC, not fetch; a CSP containing `*` is no CSP.

### 3. Permission requests are handled, never defaulted

`session.setPermissionRequestHandler()` is registered with an explicit allowlist. The default grants permissions (camera, microphone, geolocation) to any content that asks — in a desktop app, content that asks unexpectedly is the attack.

### 4. Navigation is restricted

`will-navigate` blocks navigation away from app content, and `setWindowOpenHandler()` denies or routes every `window.open`. A renderer that can navigate to an attacker's page hands the attacker a sandboxed-but-privileged-adjacent context. `shell.openExternal` is called only on validated, allowlisted URLs (scheme check at minimum) — it launches whatever the OS associates with the input.

### 5. Local content ships over a custom protocol, not `file://`

A registered custom protocol (`app://`) scopes what the renderer can load; `file://` grants origin-level access to the filesystem's namespace and breaks standard web security semantics.

### 6. Fuses are flipped at package time

Fuses are build-time switches baked into the binary — runtime config cannot re-enable what a fuse removed:

- `RunAsNode` **off** — otherwise the shipped binary doubles as a general-purpose Node executable for anything on the machine.
- `EnableEmbeddedAsarIntegrityValidation` **on** and `OnlyLoadAppFromAsar` **on** — CVE-2025-55305 (Trail of Bits, 2025-09) backdoored Signal, Slack, and 1Password via local V8 heap-snapshot tampering that bypassed code-integrity checks; ASAR integrity validation is the fix, and shipping without it is now called out as a defect, not a hardening opportunity.
- `nodeCliInspect` stays **on** — flipping it off breaks Playwright's `_electron` launch, and the agent-closable test loop ([Surface Stack Selection](../../surface-stack-selection.md)) outranks the marginal hardening.

Fuse flipping lives in the packaging pipeline ([Packaging & Updates](packaging-and-updates.md)), so an unfused build cannot reach a release channel.

### 7. The currency window is a security obligation

Only the latest three Electron majors receive patches, and majors ship every 8 weeks — Chromium CVEs apply to your shipped app on Chromium's schedule, not yours. Falling out of the window means known-exploitable, unpatched browser bugs in production. The upgrade is scheduled work with the same priority as a dependency CVE.

## Anti-patterns we reject

- **`nodeIntegration: true` anywhere, for any window.** It also kills the sandbox for that renderer.
- **`webSecurity: false` or `allowRunningInsecureContent` to "unblock" development.** Fix the content, not the boundary.
- **The `remote` module or packages that emulate it.** Synchronous privileged access from the renderer is the whole threat model in one API.
- **Un-fused release builds.** Post-CVE-2025-55305, ASAR integrity off is a shipping defect.
- **Treating the checklist as guidance for a security review later.** It is the definition of a correctly configured app on day one.
