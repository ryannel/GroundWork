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
ledgerline totals january.ledger
```

That prints one line per account, then a total.

## Develop

```
go test ./...
```
