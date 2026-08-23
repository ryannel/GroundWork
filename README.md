# stonecrop

stonecrop is a small library for Node. It has no dependencies and no build
step. The source is plain ES modules under `src/`, and other projects import it.

```js
import { titleCase, parseQuery } from 'stonecrop';
```

Run the tests with `npm test`. That runs Node's built-in test runner, so
nothing needs installing first. Node 22 or newer.

## What it does

- **titleCase** — title-cases a phrase, leaving small joining words such as
  "of" and "the" in lower case unless they start or end the phrase.
- **query** — parses a query string into an object and writes one back out,
  handling escapes, plus signs, and repeated keys.
- **movingAverage** — computes rolling window averages over a series of
  numbers, and the latest window average on its own.
- **backoff** — computes exponential retry delays, the whole schedule of
  delays, and the total wait a schedule costs.
- **bytes** — formats a byte count as a human-readable size, and reads such a
  size back into a number.

## Layout

One file per capability in `src/`, with its tests in `test/`.
