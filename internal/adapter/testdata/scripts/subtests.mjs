// A run log holding subtests under one parent, for the collapsing rule.
process.stdout.write(JSON.stringify({
  schema: 1,
  duration_ms: 9,
  tests: [
    { suite: 'test/a.test.mjs', name: 'table/one', outcome: 'pass', duration_ms: 1 },
    { suite: 'test/a.test.mjs', name: 'table/two', outcome: 'fail', duration_ms: 2 },
    { suite: 'test/a.test.mjs', name: 'alone', outcome: 'pass', duration_ms: 3 },
  ],
}) + '\n');
