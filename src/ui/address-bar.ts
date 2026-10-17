/** The entry the browser keeps for this page. The DOM types it as any; here it is unknown, to be checked. */
export function historyState(): unknown {
  // type-coverage:ignore-next-line
  return globalThis.history.state;
}

/** Puts a new address in the bar without adding an entry, and keeps the entry's state. */
export function replaceAddress(url: URL): void {
  globalThis.history.replaceState(historyState(), '', url);
}
