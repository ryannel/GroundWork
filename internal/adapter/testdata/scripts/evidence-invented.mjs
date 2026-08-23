// An adapter that invents a result: the run names a test discovery never saw.
// That is a defect in discovery, and the run-evidence row says so.
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
      { suite, name: 'invented', outcome: 'pass', duration_ms: 1 },
    ],
  }) + '\n');
}
