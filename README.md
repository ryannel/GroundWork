# fieldkit

Small helpers for cleaning up text fields during data imports.

Every import we run hits the same handful of chores: turn a title into a URL
slug, wrap a description to a fixed column, split a hand-edited CSV line,
read a quantity like `12kg`, title-case a name, check an account number.
Each of those lives in its own package here so callers can take only what
they need.

## Packages

| Package    | What it does                                          |
|------------|-------------------------------------------------------|
| `slug`     | URL-safe identifiers from free text                    |
| `wrap`     | Greedy word wrapping to a column width                 |
| `csvline`  | Split one CSV record, honouring quotes                 |
| `quantity` | Parse a number with a trailing unit                    |
| `titlecase`| Title-case names, keeping small words lowercase        |
| `checksum` | Luhn check-digit validation                            |

## Install

```
go get example.com/fieldkit
```

## Tests

```
go test ./...
```

Everything is standard library only, so there is nothing to install first.
