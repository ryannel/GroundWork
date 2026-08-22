// An adapter that discovers a test and reports a result under no name. Nothing
// can be reconciled against it, so the seam refuses the run log.
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
    tests: [{ suite, name: '', outcome: 'pass', duration_ms: 1 }],
  }) + '\n');
}
