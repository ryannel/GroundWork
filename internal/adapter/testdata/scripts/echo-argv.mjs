// Answers with the arguments it was called with, so the protocol's own shape
// can be proved.
const argv = process.argv.slice(2);
process.stdout.write(JSON.stringify({
  schema: 1,
  suites: [{ id: argv[0], name: 'argv', tests: argv.slice(1) }],
}) + '\n');
