/**
 * Brand tokens — the machine-readable projection of the design system's branding.
 *
 * This module is the shared theme contract. The `./dev` CLI is its first consumer;
 * the `cli-app` product starter is the second. Both read a `dev.config.json` (itself
 * projected from `.groundwork/config/brand-tokens.json`) and render from it.
 *
 * Keep this module free of `./dev`-specific logic so it can be extracted to a shared
 * package when the second consumer lands. See the contract at
 * groundwork-design-system/templates/brand-tokens.md.
 */

export type NoColorTreatment =
  | 'bold'
  | 'dim'
  | 'underline'
  | 'bold+upper'
  | 'plain';

export interface ColorRole {
  truecolor: string | null; // "#rrggbb" or null
  ansi256: number | null; // 0-255 or null
  noColor: NoColorTreatment;
}

export type RoleName =
  | 'success'
  | 'error'
  | 'warning'
  | 'info'
  | 'muted'
  | 'accent'
  | 'header'
  | 'key'
  | 'value';

export interface SymbolToken {
  unicode: string;
  ascii: string;
}

export type SymbolName =
  | 'success'
  | 'error'
  | 'warning'
  | 'info'
  | 'step'
  | 'substep'
  | 'active';

export interface BrandTokens {
  identity: {
    appName: string;
    wordmark: string;
    primary: string; // "#rrggbb"
    accent: string; // "#rrggbb"
    voice: string;
  };
  terminal?: {
    colorRoles: Record<RoleName, ColorRole>;
    symbols: Record<SymbolName, SymbolToken>;
    splash: { style: 'wordmark-line' | 'banner' | 'none'; tagline: string };
    typography: Record<'header' | 'title' | 'body' | 'muted', string>;
  };
}

/** The fallback theme used when no brand tokens are present. Mirrors the values in
 *  the design-system colour exemplar so a themed and an un-themed CLI look like kin. */
export const DEFAULT_TOKENS: BrandTokens = {
  identity: {
    appName: 'Workspace',
    wordmark: '◢◤',
    primary: '#5fafff',
    accent: '#d7afff',
    voice: 'clear, modern',
  },
  terminal: {
    colorRoles: {
      success: { truecolor: '#5faf87', ansi256: 72, noColor: 'bold' },
      error: { truecolor: '#d75f5f', ansi256: 167, noColor: 'bold' },
      warning: { truecolor: '#d7af5f', ansi256: 179, noColor: 'bold' },
      info: { truecolor: '#5fafff', ansi256: 75, noColor: 'dim' },
      muted: { truecolor: '#8a8a8a', ansi256: 245, noColor: 'dim' },
      accent: { truecolor: '#d7afff', ansi256: 183, noColor: 'underline' },
      header: { truecolor: null, ansi256: null, noColor: 'bold+upper' },
      key: { truecolor: '#5fafff', ansi256: 75, noColor: 'plain' },
      value: { truecolor: '#d0d0d0', ansi256: 252, noColor: 'plain' },
    },
    symbols: {
      success: { unicode: '✔', ascii: 'OK' },
      error: { unicode: '✖', ascii: 'x' },
      warning: { unicode: '⚠', ascii: '!' },
      info: { unicode: '●', ascii: '*' },
      step: { unicode: '▶', ascii: '>' },
      substep: { unicode: '↳', ascii: '-' },
      active: { unicode: '❯', ascii: '>' },
    },
    splash: { style: 'wordmark-line', tagline: '' },
    typography: {
      header: 'bold + UPPERCASE',
      title: 'bold + primary',
      body: 'plain',
      muted: 'dim',
    },
  },
};

/** Deep-merge a partial tokens object from dev.config.json over the defaults so a
 *  Tier-1 file (identity only) still yields a complete, renderable theme. */
export function mergeTokens(partial: unknown): BrandTokens {
  const p = (partial ?? {}) as Partial<BrandTokens>;
  const identity = { ...DEFAULT_TOKENS.identity, ...(p.identity ?? {}) };
  const terminal = p.terminal
    ? {
        colorRoles: { ...DEFAULT_TOKENS.terminal!.colorRoles, ...p.terminal.colorRoles },
        symbols: { ...DEFAULT_TOKENS.terminal!.symbols, ...p.terminal.symbols },
        splash: { ...DEFAULT_TOKENS.terminal!.splash, ...p.terminal.splash },
        typography: { ...DEFAULT_TOKENS.terminal!.typography, ...p.terminal.typography },
      }
    : DEFAULT_TOKENS.terminal;
  return { identity, terminal };
}
