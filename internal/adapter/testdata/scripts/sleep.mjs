// An adapter that never answers. The runner must kill it and call the run
// unrunnable, not wait on it.
setTimeout(() => {}, 60_000);
