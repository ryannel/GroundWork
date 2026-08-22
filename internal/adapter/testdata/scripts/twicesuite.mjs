// An adapter that reports one suite id twice. Whichever entry lost would be a
// suite nothing reconciles against, so the seam refuses the pair.
const suite = { id: 'test/auth.test.mjs', name: 'auth', tests: ['signs in'] };
process.stdout.write(JSON.stringify({ schema: 1, suites: [suite, suite] }) + '\n');
