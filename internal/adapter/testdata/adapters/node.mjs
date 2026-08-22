// A GroundWork adapter for projects tested with node --test.
//
// This is the worked example of the out-of-process seam (D25). It is plain
// .mjs with nothing to install, because the projects it has to run in may have
// no dependencies at all.
//
// It speaks the protocol and nothing else:
//
//   node node.mjs discover <project>
//   node node.mjs run      <project>
//   node node.mjs mutants  <project> <file>
//
// One JSON object on stdout, under {"schema":1}, and nothing after it.
// Anything this script wants to say to a human goes to stderr.
//
// A project uses it by declaring it in the capability manifest:
//
//   "adapters": {"node": {"command": ["node", "tools/groundwork-node.mjs"]}}

import { readFileSync, readdirSync, statSync } from 'node:fs';
import { join, relative, sep } from 'node:path';
import { run } from 'node:test';

const SCHEMA = 1;

// Directories no discovery walks into.
const SKIP = new Set(['node_modules', 'dist', 'build', 'coverage']);

// A test file is one node --test would pick up.
const TEST_FILE = /\.(test|spec)\.(m|c)?js$/;

// test('name', …) and it('name', …), single or double quoted. A regex is
// enough for discovery: names are literals in every project this adapter is
// meant for, and a name it cannot read shows up as a missing test rather than
// as a wrong one.
const TEST_NAME = /(?:^|[\s;{(])(?:test|it)\s*\(\s*(['"])((?:\\.|(?!\1).)*)\1/g;

// A function declaration: export, default, async and generator all optional.
const FUNCTION = /(?:^|[\s;}])(?:export\s+)?(?:default\s+)?(?:async\s+)?function\s*\*?\s*([A-Za-z_$][\w$]*)\s*\(/g;

function fail(message) {
  process.stderr.write(`${message}\n`);
  process.exit(1);
}

// walk lists every file under dir, as project-relative paths with forward
// slashes.
function walk(dir, project, found = []) {
  for (const entry of readdirSync(dir)) {
    if (entry.startsWith('.') || SKIP.has(entry)) continue;

    const path = join(dir, entry);
    if (statSync(path).isDirectory()) {
      walk(path, project, found);
    } else {
      found.push(relative(project, path).split(sep).join('/'));
    }
  }

  return found;
}

function testFiles(project) {
  return walk(project, project).filter((path) => TEST_FILE.test(path)).sort();
}

function testNames(project, file) {
  const source = readFileSync(join(project, file), 'utf8');
  const names = [];

  TEST_NAME.lastIndex = 0;
  let match;
  while ((match = TEST_NAME.exec(source)) !== null) {
    names.push(match[2]);
  }

  return names;
}

function discover(project) {
  return {
    schema: SCHEMA,
    suites: testFiles(project).map((file) => ({
      id: file,
      name: file.split('/').pop().replace(TEST_FILE, ''),
      tests: testNames(project, file),
    })),
  };
}

async function runTests(project) {
  const files = testFiles(project).map((file) => join(project, file));
  const started = Date.now();
  const tests = [];

  for await (const event of run({ files, concurrency: 1 })) {
    if (event.type !== 'test:pass' && event.type !== 'test:fail') continue;

    const data = event.data;
    // Only the leaves are reported. A suite's own pass or fail is the sum of
    // its tests, and counting it as a test would inflate the tally.
    if (data.nesting !== 0) continue;

    const skipped = data.skip === true;
    tests.push({
      suite: relative(project, data.file ?? '').split(sep).join('/'),
      name: data.name,
      outcome: skipped ? 'skip' : event.type === 'test:pass' ? 'pass' : 'fail',
      duration_ms: (data.details && data.details.duration_ms) || 0,
    });
  }

  return { schema: SCHEMA, duration_ms: Date.now() - started, tests };
}

// bodyOf finds the braces of the function body that starts after the argument
// list at index open, skipping the strings and comments that hold braces of
// their own.
function bodyOf(source, open) {
  let depth = 0;
  let start = -1;

  for (let i = open; i < source.length; i += 1) {
    const c = source[i];

    if (c === '/' && source[i + 1] === '/') {
      i = source.indexOf('\n', i);
      if (i === -1) return null;
      continue;
    }
    if (c === '/' && source[i + 1] === '*') {
      i = source.indexOf('*/', i);
      if (i === -1) return null;
      i += 1;
      continue;
    }
    if (c === '"' || c === "'" || c === '`') {
      i += 1;
      while (i < source.length && source[i] !== c) {
        if (source[i] === '\\') i += 1;
        i += 1;
      }
      continue;
    }

    if (c === '{') {
      if (depth === 0) start = i;
      depth += 1;
    } else if (c === '}') {
      depth -= 1;
      if (depth === 0) return { start, end: i };
      if (depth < 0) return null;
    }
  }

  return null;
}

function mutants(project, file) {
  if (!file) fail('mutants needs a file');

  const source = readFileSync(join(project, file), 'utf8');
  const found = [];

  FUNCTION.lastIndex = 0;
  let match;
  while ((match = FUNCTION.exec(source)) !== null) {
    const body = bodyOf(source, match.index + match[0].length);
    if (body === null) continue;

    const inside = source.slice(body.start + 1, body.end).trim();
    // A body with nothing in it is already blank, and a mutant identical to
    // the original can only look like a suite that failed to notice.
    if (inside === '') continue;

    found.push({
      file,
      symbol: match[1],
      line: source.slice(0, match.index).split('\n').length,
      content: `${source.slice(0, body.start)}{\n  return undefined;\n}${source.slice(body.end + 1)}`,
    });
  }

  return { schema: SCHEMA, mutants: found };
}

const [call, project, argument] = process.argv.slice(2);

if (!call || !project) fail('usage: node.mjs discover|run|mutants <project> [file]');

let answer;
switch (call) {
  case 'discover':
    answer = discover(project);
    break;
  case 'run':
    answer = await runTests(project);
    break;
  case 'mutants':
    answer = mutants(project, argument);
    break;
  default:
    fail(`unknown call: ${call}`);
}

process.stdout.write(`${JSON.stringify(answer)}\n`);
