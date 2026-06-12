import { describe, expect, it } from 'vitest';
import {
  APP_ORIGIN,
  isAllowedExternalUrl,
  isContainedPath,
  isTrustedNavigationTarget,
  isTrustedSender,
} from './policy';

// The security policy is pure (no Electron imports), so the privileged
// decisions are proven in a plain Node environment. The boot smoke
// (tests/smoke/) proves the wiring; these tests prove the rules.

describe('isAllowedExternalUrl', () => {
  it('allows https URLs', () => {
    expect(isAllowedExternalUrl('https://example.com/docs')).toBe(true);
  });

  it.each([
    'http://example.com',
    'file:///etc/passwd',
    'javascript:alert(1)',
    'smb://attacker/share',
    'not a url',
    '',
  ])('rejects %s', (url) => {
    expect(isAllowedExternalUrl(url)).toBe(false);
  });
});

describe('isTrustedNavigationTarget', () => {
  it('allows the bundle protocol', () => {
    expect(isTrustedNavigationTarget(`${APP_ORIGIN}/index.html`)).toBe(true);
  });

  it('allows the dev server origin only while developing', () => {
    expect(
      isTrustedNavigationTarget('http://localhost:5173/', 'http://localhost:5173'),
    ).toBe(true);
    expect(isTrustedNavigationTarget('http://localhost:5173/')).toBe(false);
  });

  it('rejects everything else', () => {
    expect(isTrustedNavigationTarget('https://attacker.example')).toBe(false);
    expect(isTrustedNavigationTarget('file:///etc/passwd')).toBe(false);
    expect(isTrustedNavigationTarget('')).toBe(false);
  });
});

describe('isTrustedSender', () => {
  it('rejects a missing frame (destroyed sender)', () => {
    expect(isTrustedSender(undefined)).toBe(false);
  });

  it('accepts the app frame', () => {
    expect(isTrustedSender(`${APP_ORIGIN}/`)).toBe(true);
  });
});

describe('isContainedPath', () => {
  it('accepts files inside the root', () => {
    expect(isContainedPath('/out/renderer', '/out/renderer/index.html')).toBe(true);
    expect(isContainedPath('/out/renderer', '/out/renderer/assets/app.css')).toBe(true);
  });

  it('rejects traversal escapes and the root itself', () => {
    expect(isContainedPath('/out/renderer', '/out/secret.js')).toBe(false);
    expect(isContainedPath('/out/renderer', '/out/renderer-evil/x')).toBe(false);
    expect(isContainedPath('/out/renderer', '/out/renderer')).toBe(false);
  });
});
