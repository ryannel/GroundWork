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
```

## Install

```
go get github.com/ofenwick/inkwell
```

## Develop

```
go test ./...
```
