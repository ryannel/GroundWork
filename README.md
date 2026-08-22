# tallysheet

The helpers behind a small expense tracker.

Amounts are always integers in minor units. Nothing here holds a fractional
number of pence, which keeps the totals exact.

## Requirements

Node 22.18 or newer. It runs the TypeScript sources directly, so there is
nothing to install and no build step.

## Tests

```
node --test "test/*.test.ts"
```
