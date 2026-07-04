'use strict';

// The COMPUTABLE half of the built-but-never-wired audit (escape class d):
// interactive elements that exist in code but can't be reached in use, found
// in source files changed since the bet's sealed baseline
// (`bet/<slug>/approved`). Two checks, each honest about its own limits:
//
//   * empty actions — interactive bindings whose handler body is empty or
//     contains only TODO/FIXME comments (regex over known framework shapes:
//     JSX props / addEventListener, SwiftUI Button / .onTapGesture, Flutter
//     onPressed:-style named callbacks; solid where a pattern matches,
//     silent where none does);
//   * unreachable handlers — functions with handler naming shapes
//     (handleX / onX / _onTapX) defined in changed files with zero references
//     anywhere in tracked non-test source beyond their own definition (a
//     word-grep heuristic, capped and labelled `[best-effort]`).
//
// Every finding is a LEAD for the review wave, never a verdict — a matched
// no-op can be a deliberate placeholder, and the word-grep cannot see a
// handler reached via reflection or string dispatch. Unrecognized file types
// skip silently — never fake precision. Shares the sealed-baseline git
// plumbing with `honesty scan` (../bet-honesty/git). Dependency-free: Node
// built-ins + git.

const fs = require('fs');
const path = require('path');
const {
  approvedTag, gitLines, showAt, ensureScannable, isTestFile, escapeRegExp,
} = require('../bet-honesty/git');

const BEST_EFFORT_CAP = 20;
const MAX_FILE_BYTES = 512 * 1024;

// File types the checks understand. Anything else skips silently.
const WIRING_LANG = {
  '.js': 'js', '.mjs': 'js', '.cjs': 'js', '.jsx': 'js', '.ts': 'js', '.tsx': 'js',
  '.swift': 'swift',
  '.dart': 'dart',
};

// ─── Check 1: empty actions (pattern-solid where a shape matches) ───────────
// Each pattern captures (1) the binding's name and (2) the handler body — a
// body is hollow when stripping comments leaves nothing executable. Bodies
// with nested braces never match `[^{}]*`, which fails safe: real code is
// never mistaken for an empty closure.

const EMPTY_ACTION_PATTERNS = {
  js: [
    // JSX/React Native props: onClick={() => {}}, onPress={async (e) => { /* TODO */ }}
    /\b(on[A-Z]\w*)\s*=\s*\{\s*(?:async\s*)?\([^()]*\)\s*=>\s*\{([^{}]*)\}\s*\}/g,
    // addEventListener('click', () => {}) — arrow or function expression
    /\b(addEventListener)\(\s*['"][\w-]+['"]\s*,\s*(?:function\s*\([^()]*\)|(?:async\s*)?\([^()]*\)\s*=>)\s*\{([^{}]*)\}/g,
  ],
  swift: [
    // SwiftUI Button("Save") { } / Button { } — empty trailing closure
    /\b(Button)(?:\s*\([^()]*\))?\s*\{([^{}]*)\}/g,
    // .onTapGesture { } / .onTapGesture(count: 2) { }
    /\.(onTapGesture)\s*(?:\([^()]*\))?\s*\{([^{}]*)\}/g,
  ],
  dart: [
    // Flutter named callbacks: onPressed: () {}, onTap: (details) async {}
    /\b(on[A-Z]\w*)\s*:\s*\([^()]*\)\s*(?:async\s*)?\{([^{}]*)\}/g,
  ],
};

// A hollow body: 'empty' (nothing at all), 'todo' (only TODO/FIXME comments),
// or null (has executable content — not a finding).
function hollowBody(body) {
  const stripped = body
    .replace(/\/\*[\s\S]*?\*\//g, '')
    .replace(/\/\/[^\n]*/g, '')
    .trim();
  if (stripped !== '') return null;
  if (body.trim() === '') return 'empty';
  return /\b(TODO|FIXME)\b/i.test(body) ? 'todo' : 'empty';
}

function emptyActions(cwd, tag) {
  const findings = [];
  for (const file of changedSourceFiles(cwd, tag)) {
    const patterns = EMPTY_ACTION_PATTERNS[WIRING_LANG[path.extname(file)]];
    const content = showAt(cwd, 'HEAD', file);
    if (content === null) continue;
    for (const re of patterns) {
      re.lastIndex = 0;
      let m;
      while ((m = re.exec(content)) !== null) {
        const kind = hollowBody(m[2]);
        if (!kind) continue;
        findings.push({
          check: 'empty-action',
          file,
          symbol: m[1],
          detail: kind === 'todo'
            ? `interactive binding '${m[1]}' has a handler containing only TODO/FIXME — wiring deferred, control shipped`
            : `interactive binding '${m[1]}' has an empty handler body — a control that does nothing when used`,
        });
      }
    }
  }
  return findings;
}

// ─── Check 2: unreachable handlers (best-effort, capped) ────────────────────

const HANDLER_NAME = '_?(?:handle|on)[A-Z]\\w*';

const HANDLER_DEF_PATTERNS = {
  js: [
    new RegExp(`\\bfunction\\s+(${HANDLER_NAME})\\s*\\(`, 'g'),
    new RegExp(`\\b(?:const|let|var)\\s+(${HANDLER_NAME})\\s*=`, 'g'),
    // class-method / object-shorthand definitions at the start of a line
    new RegExp(`^\\s*(?:public\\s+|private\\s+|protected\\s+)?(?:async\\s+)?(${HANDLER_NAME})\\s*\\([^()]*\\)\\s*\\{`, 'gm'),
  ],
  swift: [new RegExp(`\\bfunc\\s+(${HANDLER_NAME})\\s*\\(`, 'g')],
  dart: [new RegExp(`\\b(?:void|Future<[^>]*>|\\w+)\\s+(${HANDLER_NAME})\\s*\\([^()]*\\)\\s*(?:async\\s*)?\\{`, 'g')],
};

function changedSourceFiles(cwd, tag) {
  // Source files changed since the tag, excluding tests and .groundwork/.
  // Unrecognized file types skip silently — never fake precision.
  return gitLines(cwd, ['diff', '--diff-filter=ACMR', '--name-only', tag, 'HEAD']).filter((f) => {
    if (f.startsWith('.groundwork/')) return false;
    if (isTestFile(f)) return false;
    return !!WIRING_LANG[path.extname(f)];
  });
}

// Handler definitions in a file: symbol → how many definition sites name it
// (needed to tell a same-file reference from the definition itself).
function handlerDefs(lang, content) {
  const defs = new Map();
  for (const re of HANDLER_DEF_PATTERNS[lang]) {
    re.lastIndex = 0;
    let m;
    while ((m = re.exec(content)) !== null) defs.set(m[1], (defs.get(m[1]) || 0) + 1);
  }
  return defs;
}

function countWord(content, word) {
  word.lastIndex = 0;
  let n = 0;
  while (word.exec(content) !== null) n++;
  return n;
}

function unreachableHandlers(cwd, tag) {
  const candidates = changedSourceFiles(cwd, tag);
  if (!candidates.length) return [];

  // Reference corpus: every tracked, non-test source file, read once. Working
  // tree content (== HEAD after committed slices); oversized files skipped.
  const corpus = [];
  for (const f of gitLines(cwd, ['ls-files'])) {
    if (!WIRING_LANG[path.extname(f)] || f.startsWith('.groundwork/') || isTestFile(f)) continue;
    try {
      const full = path.join(cwd, f);
      if (fs.statSync(full).size > MAX_FILE_BYTES) continue;
      corpus.push({ file: f, content: fs.readFileSync(full, 'utf8') });
    } catch { /* unreadable → skip */ }
  }

  const findings = [];
  for (const file of candidates) {
    if (findings.length >= BEST_EFFORT_CAP) break;
    const content = showAt(cwd, 'HEAD', file);
    if (content === null) continue;
    const lang = WIRING_LANG[path.extname(file)];
    for (const [symbol, defCount] of handlerDefs(lang, content)) {
      if (findings.length >= BEST_EFFORT_CAP) break;
      const word = new RegExp(`\\b${escapeRegExp(symbol)}\\b`, 'g');
      // Wired if the name appears in its own file beyond its definition sites
      // (a JSX prop, a callback registration) or anywhere else in the corpus.
      if (countWord(content, word) > defCount) continue;
      if (corpus.some((c) => c.file !== file && countWord(c.content, word) > 0)) continue;
      findings.push({
        check: 'unreachable-handler',
        file,
        symbol,
        detail: `[best-effort] handler-shaped function '${symbol}' has no reference beyond its definition (word-grep over tracked non-test sources) — a handler wired to nothing?`,
      });
    }
  }
  return findings;
}

// ─── Entry point ────────────────────────────────────────────────────────────

function scan(targetDir, slug) {
  const tag = ensureScannable(targetDir, slug);
  const findings = [
    ...emptyActions(targetDir, tag),
    ...unreachableHandlers(targetDir, tag),
  ];
  return { clean: findings.length === 0, findings };
}

module.exports = {
  approvedTag,
  scan,
};
