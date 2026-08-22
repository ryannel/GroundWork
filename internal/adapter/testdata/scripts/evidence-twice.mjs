// An adapter that names one test twice in one suite. Counted twice it would
// look like a test the run never reported.
const verb = process.argv[2];
const suite = 'test/auth.test.mjs';

if (verb === 'discover') {
  process.stdout.write(JSON.stringify({
    schema: 1,
    suites: [{ id: suite, name: 'auth', tests: ['signs in', 'signs in'] }],
  }) + '\n');
} else {
  process.stdout.write(JSON.stringify({
    schema: 1,
    duration_ms: 4,
    tests: [{ suite, name: 'signs in', outcome: 'pass', duration_ms: 1 }],
  }) + '\n');
}
