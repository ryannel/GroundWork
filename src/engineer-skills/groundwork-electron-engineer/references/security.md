# Security

## The Posture

An Electron app is a browser with a privileged process attached: every web vulnerability becomes a local-machine vulnerability the moment a boundary control is loosened. The generated app ships with the full baseline **enforced in code** — `src/main/index.ts` (wiring), `src/main/policy.ts` (rules, pure and unit-tested), `forge.config.ts` (fuses). This reference explains each control so changes preserve it; the canonical statement is `docs/principles/stack/electron/security.md`.

The controls fail **as a set**: enabling `nodeIntegration` silently disables the sandbox for that renderer. There is no safe partial loosening.

## The Hardened Quartet

```ts
webPreferences: {
  contextIsolation: true,   // never off
  sandbox: true,            // never off
  nodeIntegration: false,   // never on
  webSecurity: true,        // never off — not even "temporarily for dev"
},
```

These are Electron's own defaults, restated explicitly so no upgrade, flag, or debugging session changes them silently. They apply to **every** window (`references/process-model.md` → Adding a Window). The framework's generation tests assert the generated main never contains a loosened value — treat the same assertion as a review rule for hand-written changes.

`webSecurity: false` and `allowRunningInsecureContent` as debugging crutches are how production apps ship with the front door open. Fix the content.

## Permissions: Denied by Default

```ts
session.defaultSession.setPermissionRequestHandler((_wc, _permission, callback) => {
  callback(false);
});
```

Electron's default **grants** permissions (camera, microphone, geolocation) to any content that asks; in a desktop app, content that asks unexpectedly is the attack. Granting a permission is a product decision: extend the handler with an explicit `permission === '...'` allowlist and a comment recording why — never remove the handler.

## Navigation and window.open

Two hooks in `applySecurityPolicy`, registered on `web-contents-created` so they cover every window automatically:

- **`will-navigate`** blocks navigation unless `isTrustedNavigationTarget` allows it — the bundle protocol always, the dev-server origin only while developing. A renderer that can reach an attacker's page hands the attacker a privileged-adjacent context.
- **`setWindowOpenHandler`** returns `{ action: 'deny' }` unconditionally; allowlisted https links are handed to `shell.openExternal` (the OS browser) instead of becoming Electron windows.

New in-app routes need no changes (the SPA never navigates the top frame). A legitimate new navigation target (e.g. an OAuth window) is a change to `policy.ts` with a test in `policy.test.ts`, not an inline exemption.

## shell.openExternal Allowlist

`shell.openExternal` launches whatever the OS associates with the input — `file:`, `smb:`, custom scheme handlers, anything. It is therefore only ever called on URLs that pass `isAllowedExternalUrl` (https-only baseline). Widening the allowlist is a recorded decision in `policy.ts` + test, per scheme, never a pass-through. The renderer can request it through the validated `shell:open-external` channel; it cannot reach `shell` any other way.

## The Custom Protocol

Packaged app content is served over `app://` (`registerBundleProtocol`), never `file://` — `file://` grants origin-level access to the filesystem namespace and breaks standard web security semantics. The handler resolves requests against the built renderer directory and rejects anything failing the `isContainedPath` traversal check.

In dev, electron-vite serves the renderer over `ELECTRON_RENDERER_URL`; the policy treats that origin as trusted only when the env var exists (i.e. never in a packaged build).

## Content-Security-Policy

`src/renderer/index.html` ships a strict CSP via `<meta http-equiv>` (the right mechanism for custom-protocol content):

```
default-src 'self'; script-src 'self'; style-src 'self' 'unsafe-inline'; img-src 'self' data:
```

This strictness is achievable because **all privileged data flows over IPC, not fetch** — the renderer has no business calling the network. Keep it that way: a feature that "needs" `connect-src` should route through main (`references/ipc-contracts.md` → Core Access). A CSP containing `*` is no CSP. `style-src 'unsafe-inline'` carries Vite's dev-mode style injection; scripts stay `'self'`-only in every mode.

## Fuses

Fuses are build-time switches baked into the binary — runtime config cannot re-enable what a fuse removed. They are flipped inside the Forge packaging step (`forge.config.ts`), so an unfused binary cannot reach a release channel:

| Fuse | Setting | Why |
|---|---|---|
| `RunAsNode` | **off** | The shipped binary must not double as a general-purpose Node executable |
| `EnableNodeOptionsEnvironmentVariable` | **off** | Blocks `NODE_OPTIONS` injection |
| `EnableCookieEncryption` | **on** | At-rest cookie protection |
| `EnableEmbeddedAsarIntegrityValidation` | **on** | CVE-2025-55305: heap-snapshot tampering backdoored Signal/Slack/1Password past code-integrity checks; ASAR integrity is the fix |
| `OnlyLoadAppFromAsar` | **on** | Companion to integrity validation — no side-loaded app directory |
| `nodeCliInspect` | **on, deliberately** | Flipping it off breaks Playwright's `_electron` launch; the agent-closable smoke loop outranks the marginal hardening |

Post-CVE-2025-55305, shipping without ASAR integrity is called out as a defect, not a hardening opportunity. Do not move fuse flipping out of the packaging pipeline into a checklist.

## The Currency Window

A stale Electron major is a security finding: only a narrow window of majors receives Chromium CVE patches. The window's numbers and the upgrade checklist live in `references/version-corrections.md` — treat the upgrade as scheduled work with dependency-CVE priority.

## Security Review Checklist

For any PR touching `src/main/`, `src/preload/`, `forge.config.ts`, or `index.html`:

- [ ] Quartet untouched in every `BrowserWindow`
- [ ] No new `ipcMain.handle` without sender validation; zod on non-trivial payloads
- [ ] Preload still exposes only purpose-named methods — no `ipcRenderer`, no generic passthrough
- [ ] Navigation/permission/external-URL changes live in `policy.ts` with tests
- [ ] CSP not weakened; no new `connect-src`
- [ ] Content still served over `app://`
- [ ] Fuse config unchanged (or the change is a recorded decision)
- [ ] No renderer/shared import of Electron or Node (lint must stay green without suppressions)
