// An adapter that prints half a run log and then hangs. A killed run is
// unrunnable, never the tests it managed to print first (D25).
process.stdout.write('{"schema":1,"duration_ms":5,"tests":[');
process.stdout.write('{"suite":"test/alpha.test.mjs","name":"adds up","outcome":"pass","duration_ms":1}');
setTimeout(() => {}, 60_000);
