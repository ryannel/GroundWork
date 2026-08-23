// Good JSON, bad exit code. The protocol needs both.
process.stdout.write(JSON.stringify({ schema: 1, suites: [] }) + '\n');
process.exit(3);
