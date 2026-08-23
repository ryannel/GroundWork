// A run log holding a result nothing can be reconciled against.
process.stdout.write(JSON.stringify({
  schema: 1,
  duration_ms: 5,
  tests: [{ suite: '', name: '', outcome: 'pass', duration_ms: 1 }],
}) + '\n');
