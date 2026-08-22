# tallysheet

The helpers behind a small expense tracker. Each module does one job, so the
CLI and the importer can share them.

| Module              | What it does                                        |
|---------------------|-----------------------------------------------------|
| `src/money.ts`      | Amounts as integer minor units, and back to text     |
| `src/dateRange.ts`  | `2024-01-05..2024-01-09` ranges and the days in them |
| `src/categorize.ts` | Guess a category from a description                  |
| `src/summary.ts`    | Totals per category, and the largest entry           |
| `src/receiptId.ts`  | Build and recognise receipt identifiers              |

Amounts are always integers in minor units. Nothing here holds a fractional
number of pence, which keeps the totals exact.

## Requirements

Node 22.18 or newer. It runs the TypeScript sources directly, so there is
nothing to install and no build step.

## Tests

```
node --test "test/*.test.ts"
```

`npm test` runs the same command.
