// Pure security policy — no Electron imports, so every rule in this file is
// unit-testable in a plain Node environment (src/main/policy.test.ts) and the
// privileged decisions live in one reviewable place.

/** The custom protocol the packaged renderer is served over. file:// is never
 *  used: it grants origin-level filesystem access and breaks web security
 *  semantics (docs/principles/stack/electron/security.md). */
export const APP_SCHEME = 'app';
export const APP_ORIGIN = `${APP_SCHEME}://bundle`;

/** shell.openExternal launches whatever the OS associates with the input, so
 *  it only ever receives validated, allowlisted URLs. https-only is the
 *  baseline; widen it per-scheme as a recorded product decision, never with a
 *  pass-through. */
export function isAllowedExternalUrl(raw: string): boolean {
  let url: URL;
  try {
    url = new URL(raw);
  } catch {
    return false;
  }
  return url.protocol === 'https:';
}

/** Navigation policy for will-navigate: app content stays on the bundle
 *  protocol (or the dev server while developing). Everything else is blocked —
 *  a renderer that can navigate to an attacker's page hands the attacker a
 *  privileged-adjacent context. */
export function isTrustedNavigationTarget(
  raw: string,
  devServerUrl?: string,
): boolean {
  let url: URL;
  try {
    url = new URL(raw);
  } catch {
    return false;
  }
  if (url.protocol === `${APP_SCHEME}:`) return true;
  if (devServerUrl) {
    try {
      if (url.origin === new URL(devServerUrl).origin) return true;
    } catch {
      // unparseable dev URL — fall through to deny
    }
  }
  return false;
}

/** Sender validation for every IPC handler (security checklist item 17): the
 *  call must come from this app's own frame, not an iframe or a navigated-away
 *  window. A missing frame (destroyed sender) is rejected. */
export function isTrustedSender(
  frameUrl: string | undefined,
  devServerUrl?: string,
): boolean {
  if (!frameUrl) return false;
  return isTrustedNavigationTarget(frameUrl, devServerUrl);
}

/** Containment check for the bundle protocol handler: the resolved path must
 *  stay inside the renderer output directory (no traversal escapes). The
 *  separator is a parameter so the rule stays pure and testable; callers pass
 *  path.sep. */
export function isContainedPath(
  rootDir: string,
  target: string,
  sep = '/',
): boolean {
  if (target === rootDir) return false; // the root itself is not a file
  const root = rootDir.endsWith(sep) ? rootDir : `${rootDir}${sep}`;
  return target.startsWith(root);
}
