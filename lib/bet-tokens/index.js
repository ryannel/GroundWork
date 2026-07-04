'use strict';

// The MECHANICAL half of the design-integrity ratchet (W3.4): a token-conformance
// scan over UI source files changed since the bet's sealed baseline
// (`bet/<slug>/approved`). It flags raw design literals — hex/rgb/hsl colors,
// magic font sizes, px spacing, raw animation durations — that bypass the
// project's design-token set: the "flat and boring drift" that accumulates one
// innocent literal at a time until the owner's patience breaks.
//
// Scope: UI-ish extensions only (.tsx/.jsx/.css/.scss/.swift/.dart/.vue/.svelte);
// everything else — and test files — is skipped silently. Comments are stripped
// before matching, so a hex in a comment never fires.
//
// Token-set awareness is best-effort: the scan looks for a tailwind config, a
// `*token*`/`*theme*` file under a src/ or lib/ segment, or a stylesheet
// defining CSS custom properties (3+ `--*:` definitions). Found → findings say
// a token set exists and name it. Not found → raw literals still report, but
// the result carries `token_set: null` and the caller softens the framing to
// tokenization leads. The scan never invents a token set. In stylesheets,
// spacing literals are flagged only when a token indirection exists — a plain
// CSS file with no token layer has nowhere else to put a margin.
//
// Allowlist (the unavoidable literals, deliberately tiny and stated here):
// pure white/black (`#fff`/`#ffff`/`#ffffff`/`#ffffffff`, `#000` + long forms,
// Flutter `0xFFFFFFFF`/`0xFF000000`), `transparent`, zero spacing (`0px`),
// `1px` (hairline borders/nudges), and zero durations (`0s`/`0ms`).
//
// Findings are LEADS for slice-review triage, never verdicts — a raw literal
// can be legitimate (a one-off illustration, a third-party override); the
// reviewer judges. Dependency-free: Node built-ins + git.

const fs = require('fs');
const path = require('path');
const { execFileSync } = require('child_process');

// Thrown when the scan cannot run at all (no git repo, no approved tag) — the
// CLI maps this to exit 2, distinct from exit 1 (findings).
class ScanUnavailableError extends Error {}

const MAX_FILE_BYTES = 512 * 1024;

const UI_EXTENSIONS = new Set(['.tsx', '.jsx', '.css', '.scss', '.swift', '.dart', '.vue', '.svelte']);
const STYLESHEET_EXTENSIONS = new Set(['.css', '.scss']);

// The pass-list: literals no token set is expected to absorb (see header).
const ALLOWLIST_COLORS = new Set([
  '#fff', '#ffff', '#ffffff', '#ffffffff',
  '#000', '#000f', '#000000', '#000000ff',
  'transparent', '0xffffffff', '0xff000000',
]);
const ALLOWLIST_SPACING = new Set(['0px', '1px']);
const ALLOWLIST_DURATIONS = new Set(['0s', '0ms']);

function approvedTag(slug) {
  return `bet/${slug}/approved`;
}

function git(cwd, args) {
  // stderr piped (not inherited): probe failures — a missing tag, a file absent
  // at a ref — are expected control flow here, never user-facing noise.
  return execFileSync('git', args, {
    cwd, encoding: 'utf8', maxBuffer: 64 * 1024 * 1024, stdio: ['ignore', 'pipe', 'pipe'],
  });
}

function gitLines(cwd, args) {
  return git(cwd, args).split('\n').filter(Boolean);
}

function showAt(cwd, ref, file) {
  try {
    return git(cwd, ['show', `${ref}:${file}`]);
  } catch {
    return null;
  }
}

function isTestFile(file) {
  const base = path.basename(file);
  return (
    /(^|\/)(tests?|__tests__|spec)\//.test(file) ||
    /^test_/.test(base) ||
    /_test\.[^.]+$/.test(base) ||
    /\.(test|spec)\.[^.]+$/.test(base)
  );
}

function countMatches(content, regex) {
  regex.lastIndex = 0;
  let n = 0;
  while (regex.exec(content) !== null) n++;
  return n;
}

// ─── Token-set discovery (best-effort, never invented) ──────────────────────
// Grounded in what GroundWork scaffolds actually carry: a tailwind config
// (nextjs-app / docs-site), `*token*`/`*theme*` sources (brand-tokens
// projections, Flutter ThemeData files under lib/, dev-cli theme/tokens.ts),
// and CSS custom-property sheets (app/brand.css `--*` variables).

const CSS_CUSTOM_PROP_RE = /(^|[\s;{])--[A-Za-z][\w-]*\s*:/g;

function detectTokenSet(cwd) {
  let tracked;
  try {
    tracked = gitLines(cwd, ['ls-files']).filter((f) => !f.startsWith('.groundwork/')).sort();
  } catch {
    return null;
  }

  for (const f of tracked) {
    if (/^tailwind\.config\.(js|cjs|mjs|ts)$/.test(path.basename(f))) return f;
  }
  for (const f of tracked) {
    if (!/(^|\/)(src|lib)\//.test(f)) continue;
    const base = path.basename(f).toLowerCase();
    if (/(token|theme)/.test(base) && /\.(ts|js|tsx|jsx|css|scss|json|dart|swift)$/.test(base)) return f;
  }
  for (const f of tracked) {
    if (!STYLESHEET_EXTENSIONS.has(path.extname(f))) continue;
    try {
      const full = path.join(cwd, f);
      if (fs.statSync(full).size > MAX_FILE_BYTES) continue;
      if (countMatches(fs.readFileSync(full, 'utf8'), CSS_CUSTOM_PROP_RE) >= 3) return f;
    } catch { /* unreadable → not a token source */ }
  }
  return null;
}

// ─── Comment stripping (line numbers preserved) ──────────────────────────────

function stripLineComment(line) {
  // `//` starts a comment unless the previous char is `:` (https://…) or `/`.
  for (let i = 0; i < line.length - 1; i++) {
    if (line[i] === '/' && line[i + 1] === '/' && (i === 0 || (line[i - 1] !== ':' && line[i - 1] !== '/'))) {
      return line.slice(0, i);
    }
  }
  return line;
}

function stripComments(content, ext) {
  // Block comments → same-shape whitespace so line numbers survive.
  let out = content.replace(/\/\*[\s\S]*?\*\//g, (m) => m.replace(/[^\n]/g, ' '));
  if (ext !== '.css') {
    // `//` line comments exist in every scanned language except plain CSS.
    out = out.split('\n').map(stripLineComment).join('\n');
  }
  return out;
}

// ─── Raw-literal matchers (deterministic regexes, one line at a time) ────────

const HEX_RE = /#[0-9a-fA-F]{3,8}(?![\w-])/g;
const COLOR_FN_RE = /\b(?:rgba?|hsla?)\(\s*[\d.][^)]*\)/g;
const SWIFT_COLOR_RE = /\bColor\(\s*(?:\.\w+\s*,\s*)?red\s*:[^)]*\)/g;
const DART_COLOR_RE = /\bColor\(\s*0x([0-9a-fA-F]{6,8})\s*\)/g;

const CSS_FONT_RE = /\bfont-size\s*:\s*\d+(?:\.\d+)?px\b/gi;
const JS_FONT_RE = /\bfontSize\s*:\s*['"`]?\d+(?:\.\d+)?(?:px)?/g;
const SWIFT_FONT_RE = /\.font\(\s*\.system\(\s*size:\s*[\d.]+/g;

const SPACING_RE = /\b(?:margin|padding)(?:-?(?:top|right|bottom|left|inline|block|start|end|x|y|horizontal|vertical))?\s*:\s*['"`]?(\d+(?:\.\d+)?px)\b/gi;

const CSS_MOTION_RE = /\b(?:transition|animation)(?:-(?:duration|delay))?\s*:[^;{}]*?\b(\d+(?:\.\d+)?m?s)\b/gi;
const JS_DURATION_RE = /(?<!-)\bduration\s*:\s*['"`]?\d+(?:\.\d+)?(?:ms|s)?/gi;
const DART_DURATION_RE = /\bDuration\(\s*milliseconds:\s*\d+\s*\)/g;
const MOTION_CONTEXT_RE = /anim|transition|motion|ease|tween|curve/i;

function eachMatch(line, regex, fn) {
  regex.lastIndex = 0;
  let m;
  while ((m = regex.exec(line)) !== null) fn(m);
}

function lineFindings(line, ext, { spacingGated }) {
  const out = [];
  // Quotes are stripped from the reported literal — a match can start inside a
  // string (`padding: '12px'`) and an unbalanced quote reads as a typo.
  const push = (kind, literal) => out.push({ kind, literal: literal.replace(/['"`]/g, '').trim() });
  const stylesheet = STYLESHEET_EXTENSIONS.has(ext);
  const colonIdx = line.indexOf(':');

  // ── color ──
  eachMatch(line, HEX_RE, (m) => {
    if (![4, 5, 7, 9].includes(m[0].length)) return; // #rgb/#rgba/#rrggbb/#rrggbbaa only
    if (stylesheet && (colonIdx === -1 || m.index < colonIdx)) return; // selector, not a value
    if (ALLOWLIST_COLORS.has(m[0].toLowerCase())) return;
    push('color', m[0]);
  });
  eachMatch(line, COLOR_FN_RE, (m) => push('color', m[0]));
  if (ext === '.swift') eachMatch(line, SWIFT_COLOR_RE, (m) => push('color', m[0]));
  if (ext === '.dart') {
    eachMatch(line, DART_COLOR_RE, (m) => {
      if (ALLOWLIST_COLORS.has(`0x${m[1].toLowerCase()}`)) return;
      push('color', m[0]);
    });
  }

  // ── font ──
  eachMatch(line, CSS_FONT_RE, (m) => push('font', m[0]));
  if (!stylesheet) eachMatch(line, JS_FONT_RE, (m) => push('font', m[0]));
  if (ext === '.swift') eachMatch(line, SWIFT_FONT_RE, (m) => push('font', m[0]));

  // ── spacing ──
  if (!spacingGated) {
    eachMatch(line, SPACING_RE, (m) => {
      if (ALLOWLIST_SPACING.has(m[1].toLowerCase())) return;
      push('spacing', m[0]);
    });
  }

  // ── motion ──
  eachMatch(line, CSS_MOTION_RE, (m) => {
    if (ALLOWLIST_DURATIONS.has(m[1].toLowerCase())) return;
    push('motion', m[1]);
  });
  if (MOTION_CONTEXT_RE.test(line)) {
    eachMatch(line, JS_DURATION_RE, (m) => push('motion', m[0]));
    eachMatch(line, DART_DURATION_RE, (m) => push('motion', m[0]));
  }

  return out;
}

// ─── Entry point ────────────────────────────────────────────────────────────

function scan(targetDir, slug) {
  try {
    git(targetDir, ['rev-parse', '--git-dir']);
  } catch {
    throw new ScanUnavailableError('not a git repository — the scan diffs HEAD against the sealed baseline');
  }
  const tag = approvedTag(slug);
  try {
    git(targetDir, ['rev-parse', '--verify', '--quiet', `refs/tags/${tag}^{commit}`]);
  } catch {
    throw new ScanUnavailableError(`no approved tag '${tag}' — the scan needs the sealed baseline to diff against`);
  }

  const tokenSet = detectTokenSet(targetDir);

  const files = gitLines(targetDir, ['diff', '--diff-filter=ACMR', '--name-only', tag, 'HEAD'])
    .filter((f) => UI_EXTENSIONS.has(path.extname(f)) && !f.startsWith('.groundwork/') && !isTestFile(f))
    .sort();

  const findings = [];
  const seen = new Set();
  for (const file of files) {
    const content = showAt(targetDir, 'HEAD', file);
    if (content === null || Buffer.byteLength(content) > MAX_FILE_BYTES) continue;
    const ext = path.extname(file);
    // In a stylesheet with no token layer, a margin has nowhere else to live.
    const spacingGated = STYLESHEET_EXTENSIONS.has(ext) && !tokenSet;
    const lines = stripComments(content, ext).split('\n');
    for (let i = 0; i < lines.length; i++) {
      for (const { kind, literal } of lineFindings(lines[i], ext, { spacingGated })) {
        const key = `${file}:${i + 1}:${kind}:${literal}`;
        if (seen.has(key)) continue;
        seen.add(key);
        findings.push({
          kind,
          file,
          line: i + 1,
          literal,
          detail: tokenSet
            ? `raw ${kind} literal where a token set exists (${tokenSet})`
            : `raw ${kind} literal — no token set detected; treat as a tokenization lead`,
        });
      }
    }
  }

  return { clean: findings.length === 0, token_set: tokenSet, findings };
}

module.exports = {
  ScanUnavailableError,
  approvedTag,
  scan,
};
