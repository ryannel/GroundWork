// A run that reports a clean sweep of nothing. An empty run log is not a pass.
process.stdout.write(JSON.stringify({ schema: 1, duration_ms: 5, tests: [] }) + '\n');
