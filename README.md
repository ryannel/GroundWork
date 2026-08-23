# quarrytools

quarrytools is a Go **library**. It is meant to be imported by other projects.
There is no command and no main package. Every package stands alone, depends
only on the standard library, and can be used on its own.

```
go get github.com/holdout/quarrytools
```

Run the tests with `go test ./...`.

## What it does

- **slug** — turns free text into a URL-safe slug, and shortens a slug to a
  length without cutting a word in half.
- **wordwrap** — breaks plain text into lines of a fixed width, and indents a
  block of text with a prefix.
- **romanize** — converts an integer to a Roman numeral and back, rejecting
  strings that are not well formed.
- **chunk** — splits a slice into batches of a fixed size, and reports how many
  batches a length will produce.
- **csvlite** — parses and writes one comma-separated line at a time, handling
  quoted fields and doubled quotes.
- **stats** — computes the mean, median, and population standard deviation of a
  slice of float64.

## Layout

Each capability is one package in its own directory. Tests live beside the code
they cover, as `*_test.go`.
