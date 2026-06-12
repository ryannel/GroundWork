# inkwell

`inkwell` lays out plain text. It wraps paragraphs, indents blocks,
shortens strings that are too long, and renders small lists. No
dependencies beyond the standard library.

It exists because every terminal program I write ends up growing its own
half-finished version of these four things.

```go
import "github.com/ofenwick/inkwell"

fmt.Println(inkwell.Wrap(notes, 72))
fmt.Println(inkwell.Indent(quote, "> "))
fmt.Println(inkwell.Hang(entry, 72, 4))
fmt.Println(inkwell.Numbered(steps))
fmt.Println(inkwell.TitleCase("the wind in the willows"))
```

## What is here

`Wrap` breaks a paragraph to a width and keeps blank lines between
paragraphs. A word longer than the line gets a line to itself.

`Indent` puts a prefix on every non-blank line. `Hang` wraps and then
indents everything after the first line.

`Truncate` shortens a string and marks the cut with an ellipsis.

`Bullets` and `Numbered` render short lists. `TitleCase` capitalises a
heading and leaves small joining words alone.

The awkward cases are still being worked through: tab widths, cutting on
rune boundaries, and hyphens in headings. See `PLAN-INTENT.md`.

## Install

```
go get github.com/ofenwick/inkwell
```

## Develop

```
go test ./...
```
