// A run log naming one test twice, with two outcomes. One test is one result,
// and neither copy is a test nobody discovered.
const verb = process.argv[2];
const suite = 'test/auth.test.mjs';

if (verb === 'discover') {
  process.stdout.write(JSON.stringify({
    schema: 1,
    suites: [{ id: suite, name: 'auth', tests: ['signs in'] }],
  }) + '\n');
} else {
  process.stdout.write(JSON.stringify({
    schema: 1,
    duration_ms: 4,
    tests: [
      { suite, name: 'signs in', outcome: 'pass', duration_ms: 1 },
      { suite, name: 'signs in', outcome: 'fail', duration_ms: 2 },
    ],
  }) + '\n');
}
