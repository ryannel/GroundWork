// An adapter that discovers fine and cannot run. Half a run tells nobody what
// executed, so the surface is unrunnable rather than a pile of never-runs.
const verb = process.argv[2];

if (verb === 'discover') {
  process.stdout.write(JSON.stringify({
    schema: 1,
    suites: [{ id: 'test/auth.test.mjs', name: 'auth', tests: ['signs in'] }],
  }) + '\n');
} else {
  process.stderr.write('the test runner is not installed\n');
  process.exit(1);
}
