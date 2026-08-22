// An adapter that discovers a suite and then reports a clean sweep of nothing.
// The run executed zero tests, which is red — not a run that failed.
const verb = process.argv[2];

if (verb === 'discover') {
  process.stdout.write(JSON.stringify({
    schema: 1,
    suites: [{ id: 'test/auth.test.mjs', name: 'auth', tests: ['signs in'] }],
  }) + '\n');
} else {
  process.stdout.write(JSON.stringify({ schema: 1, duration_ms: 5, tests: [] }) + '\n');
}
