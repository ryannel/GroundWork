/**
 * Colour resolution: truecolor → ANSI 256 → bold/dim → plain, gated by terminal
 * capability and the NO_COLOR / FORCE_COLOR standards. The render layer asks for a
 * semantic role; this module decides how to paint it given the environment.
 */

import { BrandTokens, ColorRole, NoColorTreatment, RoleName } from './tokens';

const RESET = '\x1b[0m';

export type ColorDepth = 'none' | 'ansi16' | 'ansi256' | 'truecolor';

export interface RenderCaps {
  depth: ColorDepth;
  unicode: boolean;
  isTTY: boolean;
}

function envFlag(name: string): boolean {
  const v = process.env[name];
  return v !== undefined && v !== '' && v !== '0' && v.toLowerCase() !== 'false';
}

/** Detect the renderable capabilities of the current stdout. Honors NO_COLOR
 *  (https://no-color.org) and FORCE_COLOR; detects truecolor via $COLORTERM. */
export function detectCaps(stream: NodeJS.WriteStream = process.stdout): RenderCaps {
  const isTTY = Boolean(stream.isTTY);
  // Unicode: assume yes on UTF-8 locales / modern terminals; fall back to ASCII for
  // dumb terminals or explicit opt-out.
  const term = process.env.TERM ?? '';
  const unicode =
    term !== 'dumb' &&
    !envFlag('ASCII_ONLY') &&
    /utf-?8/i.test(process.env.LC_ALL || process.env.LC_CTYPE || process.env.LANG || 'UTF-8');

  let depth: ColorDepth;
  if (envFlag('NO_COLOR')) {
    depth = 'none';
  } else if (!isTTY && !envFlag('FORCE_COLOR')) {
    depth = 'none';
  } else {
    const colorterm = (process.env.COLORTERM ?? '').toLowerCase();
    if (colorterm === 'truecolor' || colorterm === '24bit') {
      depth = 'truecolor';
    } else if (/256/.test(term)) {
      depth = 'ansi256';
    } else if (term === 'dumb' || term === '') {
      depth = 'none';
    } else {
      depth = 'ansi16';
    }
  }
  return { depth, unicode, isTTY };
}

function hexToRgb(hex: string): [number, number, number] {
  const m = /^#?([0-9a-f]{2})([0-9a-f]{2})([0-9a-f]{2})$/i.exec(hex.trim());
  if (!m) return [255, 255, 255];
  return [parseInt(m[1], 16), parseInt(m[2], 16), parseInt(m[3], 16)];
}

function treatmentCode(t: NoColorTreatment): string {
  switch (t) {
    case 'bold':
    case 'bold+upper':
      return '\x1b[1m';
    case 'dim':
      return '\x1b[2m';
    case 'underline':
      return '\x1b[4m';
    default:
      return '';
  }
}

/** A bound painter: closes over the resolved tokens and capabilities so callers
 *  just name a role. */
export class Painter {
  constructor(
    public readonly tokens: BrandTokens,
    public readonly caps: RenderCaps,
  ) {}

  private roleColor(role: RoleName): ColorRole | undefined {
    return this.tokens.terminal?.colorRoles?.[role];
  }

  /** Paint text in a semantic role, degrading by capability. */
  paint(role: RoleName, text: string): string {
    const r = this.roleColor(role);
    if (!r) return text;
    if (r.noColor === 'bold+upper') text = text.toUpperCase();

    if (this.caps.depth === 'none') {
      const code = treatmentCode(r.noColor);
      return code ? `${code}${text}${RESET}` : text;
    }
    if (this.caps.depth === 'truecolor' && r.truecolor) {
      const [rr, gg, bb] = hexToRgb(r.truecolor);
      return `\x1b[38;2;${rr};${gg};${bb}m${text}${RESET}`;
    }
    if (
      (this.caps.depth === 'ansi256' || this.caps.depth === 'truecolor') &&
      r.ansi256 !== null
    ) {
      return `\x1b[38;5;${r.ansi256}m${text}${RESET}`;
    }
    // ansi16 or missing colour value → degrade to the bold/dim treatment.
    const code = treatmentCode(r.noColor);
    return code ? `${code}${text}${RESET}` : text;
  }

  /** Paint with the brand primary accent (truecolor only; degrades to bold). */
  primary(text: string): string {
    if (this.caps.depth === 'truecolor') {
      const [r, g, b] = hexToRgb(this.tokens.identity.primary);
      return `\x1b[38;2;${r};${g};${b}m${text}${RESET}`;
    }
    if (this.caps.depth === 'none') return text;
    return `\x1b[1m${text}${RESET}`;
  }

  bold(text: string): string {
    return this.caps.depth === 'none' ? text : `\x1b[1m${text}${RESET}`;
  }

  dim(text: string): string {
    return this.caps.depth === 'none' ? text : `\x1b[2m${text}${RESET}`;
  }
}
