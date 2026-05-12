# ledgerline

`ledgerline` is a small command-line tool for plain-text money ledgers.

A ledger is a text file. One line is one posting. A line has a date, an
account name, and an amount. Anything after a `#` is a note. Blank lines
are ignored.

```
# january
2026-01-04  groceries  -42.50   # weekly shop
2026-01-05  salary      2500.00
2026-01-06  rent       -1200.00
```

## Install

```
go install github.com/mkerrigan/ledgerline@latest
```

## Use

```
$ ledgerline totals january.ledger
groceries    -42.50
rent       -1200.00
salary      2500.00
TOTAL       1257.50
```

One row per account, then the total. Accounts that net out to zero are
left off, because a loan you paid back is not news. Amounts are held as
whole cents, so nothing rounds oddly.

## Not built yet

Narrowing a ledger to a date range, and checking accounts against
spending limits. The tests for both are in the tree and failing on
purpose. See `PLAN-INTENT.md`.

## Develop

```
go test ./...
```
