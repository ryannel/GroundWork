package plan

import (
	"fmt"
	"strings"
)

// The frontmatter this package reads is a small, strict subset of YAML,
// written out in docs/derivation-contract.md section 1. It is a subset rather
// than the whole language because this module takes no dependencies, and the
// fields R2 names need three shapes and no more: a line of text, a list of
// lines, and a list of blocks.
//
// Strict means every doubt is refused rather than guessed at. A tab in the
// indentation, a key written twice, a key nobody reads, a field with no value:
// each one stops the read and names the line. The reason is the lock file's
// reason (D28): a typo that was quietly ignored leaves the real field empty,
// and the writer is looking at a file that seems right.
//
// One limit is worth stating rather than finding later. A list entry whose
// first word is a bare key followed by a colon reads as a block, so a line of
// text that begins that way cannot be written as a list entry. Rephrase it.

// The caps. A plan file is a handful of fields; every one of these is far
// above what a person writes and far below what would make an error message
// unreadable.
const (
	maxFileBytes   = 64 * 1024
	maxScalarBytes = 1000
	maxIDBytes     = 64
	maxPathBytes   = 300
	maxKeyBytes    = 40
	maxDepth       = 3
)

// fence opens and closes the frontmatter.
const fence = "---"

// nodeKind is what one parsed value is.
type nodeKind int

const (
	scalarNode nodeKind = iota
	listNode
	blockNode
)

// node is one parsed value: a line of text, a list, or a block of fields.
type node struct {
	kind   nodeKind
	text   string
	items  []node
	keys   []string
	fields map[string]node
	line   int
}

// describe names a node's shape in the words an error message uses.
func describe(n node) string {
	switch n.kind {
	case listNode:
		return "a list"
	case blockNode:
		return "a block of fields"
	default:
		return "a line of text"
	}
}

// rawLine is one line of the frontmatter, with its indentation measured and
// its original line number kept for the error messages.
type rawLine struct {
	indent int
	text   string
	n      int
}

// parseFrontmatter reads the frontmatter block at the top of a plan file.
//
// Everything below the closing fence is prose and is never read. R1 turns on
// that: a parser that read prose would break every time somebody rewrote a
// sentence.
func parseFrontmatter(file string, raw []byte) (node, error) {
	if len(raw) > maxFileBytes {
		return node{}, fmt.Errorf("%s is %d bytes, over the limit of %d bytes for a plan file",
			file, len(raw), maxFileBytes)
	}

	all := strings.Split(strings.ReplaceAll(string(raw), "\r\n", "\n"), "\n")
	if len(all) == 0 || all[0] != fence {
		return node{}, fmt.Errorf("%s does not open with a frontmatter block: its first line must be %s", file, fence)
	}

	end := -1
	for i := 1; i < len(all); i++ {
		if all[i] == fence {
			end = i
			break
		}
	}
	if end < 0 {
		return node{}, fmt.Errorf("%s has frontmatter that never closes: there is no second %s line", file, fence)
	}

	var lines []rawLine
	for i := 1; i < end; i++ {
		text := all[i]
		if strings.TrimSpace(text) == "" {
			continue
		}

		indent := 0
		for indent < len(text) && text[indent] == ' ' {
			indent++
		}
		if indent < len(text) && text[indent] == '\t' {
			return node{}, fmt.Errorf("%s line %d is indented with a tab, and frontmatter is indented with spaces", file, i+1)
		}

		lines = append(lines, rawLine{indent: indent, text: strings.TrimRight(text[indent:], " "), n: i + 1})
	}

	root, used, err := parseBlock(file, lines, 0, 0, 0)
	if err != nil {
		return node{}, err
	}
	if used < len(lines) {
		return node{}, lineErr(file, lines[used], "this line is indented further than the block it sits in")
	}

	return root, nil
}

// parseBlock reads the fields sitting at one indentation, and returns how many
// lines it used.
func parseBlock(file string, lines []rawLine, i, indent, depth int) (node, int, error) {
	if depth > maxDepth {
		return node{}, i, fmt.Errorf("%s nests deeper than %d levels", file, maxDepth)
	}

	out := node{kind: blockNode, fields: map[string]node{}}
	if i < len(lines) {
		out.line = lines[i].n
	}

	for i < len(lines) {
		line := lines[i]
		if line.indent < indent {
			break
		}
		if line.indent > indent {
			return node{}, i, lineErr(file, line, "this line is indented further than the field above it")
		}

		key, rest, found := strings.Cut(line.text, ":")
		if !found {
			return node{}, i, lineErr(file, line,
				fmt.Sprintf("%q is not a field: a field is a name, a colon, and its value", clip(line.text)))
		}
		if err := checkKey(file, line, key); err != nil {
			return node{}, i, err
		}
		if _, twice := out.fields[key]; twice {
			return node{}, i, lineErr(file, line, fmt.Sprintf("the field %q is written twice", key))
		}

		rest = strings.TrimSpace(rest)
		i++

		var value node
		switch {
		case rest == "[]":
			value = node{kind: listNode, line: line.n}
		case rest != "":
			if err := checkScalarSize(file, line, rest); err != nil {
				return node{}, i, err
			}
			value = node{kind: scalarNode, text: rest, line: line.n}
			if i < len(lines) && lines[i].indent > indent {
				return node{}, i, lineErr(file, lines[i],
					fmt.Sprintf("the field %q already holds a value, and this line is indented under it", key))
			}
		default:
			if i >= len(lines) || lines[i].indent <= indent {
				return node{}, i, lineErr(file, line, fmt.Sprintf("the field %q has no value", key))
			}

			var err error
			if strings.HasPrefix(lines[i].text, "-") {
				value, i, err = parseList(file, lines, i, lines[i].indent, depth+1)
			} else {
				value, i, err = parseBlock(file, lines, i, lines[i].indent, depth+1)
			}
			if err != nil {
				return node{}, i, err
			}
		}

		out.keys = append(out.keys, key)
		out.fields[key] = value
	}

	return out, i, nil
}

// parseList reads the entries of one list. An entry is a line of text, or the
// first line of a block whose remaining fields sit under it.
func parseList(file string, lines []rawLine, i, indent, depth int) (node, int, error) {
	if depth > maxDepth {
		return node{}, i, fmt.Errorf("%s nests deeper than %d levels", file, maxDepth)
	}

	out := node{kind: listNode, line: lines[i].n}

	for i < len(lines) {
		line := lines[i]
		if line.indent < indent {
			break
		}
		if line.indent > indent {
			return node{}, i, lineErr(file, line, "this line is indented further than the list entry above it")
		}
		if !strings.HasPrefix(line.text, "-") {
			break
		}
		if !strings.HasPrefix(line.text, "- ") {
			return node{}, i, lineErr(file, line, "a list entry is a dash, a space, and what the entry holds")
		}

		inner := strings.TrimSpace(line.text[2:])
		if inner == "" {
			return node{}, i, lineErr(file, line, "a list entry holds nothing")
		}

		if isFieldStart(inner) {
			rest := make([]rawLine, 0, len(lines)-i)
			rest = append(rest, rawLine{indent: indent + 2, text: inner, n: line.n})
			rest = append(rest, lines[i+1:]...)

			item, used, err := parseBlock(file, rest, 0, indent+2, depth+1)
			if err != nil {
				return node{}, i, err
			}

			out.items = append(out.items, item)
			i += used

			continue
		}

		if err := checkScalarSize(file, line, inner); err != nil {
			return node{}, i, err
		}

		out.items = append(out.items, node{kind: scalarNode, text: inner, line: line.n})
		i++
	}

	return out, i, nil
}

// isFieldStart reports whether a list entry opens a block rather than holding
// a line of text. It is the one place the subset guesses, and the guess is
// narrow: a bare key, a colon, and then the end of the line or a space.
func isFieldStart(s string) bool {
	key, rest, found := strings.Cut(s, ":")
	if !found || key == "" {
		return false
	}
	for _, r := range key {
		if !(r >= 'a' && r <= 'z' || r >= '0' && r <= '9' || r == '_') {
			return false
		}
	}

	return rest == "" || strings.HasPrefix(rest, " ")
}

// checkKey refuses a field name outside the charset the shapes are written in.
func checkKey(file string, line rawLine, key string) error {
	if key == "" {
		return lineErr(file, line, "this line opens with a colon, so it names no field")
	}
	if len(key) > maxKeyBytes {
		return lineErr(file, line, fmt.Sprintf("a field name of %d bytes is over the limit of %d bytes",
			len(key), maxKeyBytes))
	}

	for _, r := range key {
		switch {
		case r >= 'a' && r <= 'z':
		case r >= '0' && r <= '9':
		case r == '_':
		default:
			return lineErr(file, line, fmt.Sprintf("the field name %q holds %q, and a field name is lowercase letters, digits and underscores",
				clip(key), r))
		}
	}

	return nil
}

// checkScalarSize refuses a value long enough to make every message that
// carries it unreadable.
func checkScalarSize(file string, line rawLine, value string) error {
	if len(value) > maxScalarBytes {
		return lineErr(file, line, fmt.Sprintf("this value is %d bytes, over the limit of %d bytes",
			len(value), maxScalarBytes))
	}

	return nil
}

// lineErr builds the one error shape a reader of a plan file meets: the file
// from the repo root, the line, and what is wrong with it.
func lineErr(file string, line rawLine, message string) error {
	return fmt.Errorf("%s line %d: %s", file, line.n, message)
}

// clip shortens a piece of somebody's file so it can sit inside a message. It
// cuts on runes, so a file written in another script is shortened rather than
// turned into rubble.
func clip(text string) string {
	const most = 60

	runes := []rune(text)
	if len(runes) <= most {
		return text
	}

	return string(runes[:most]) + "..."
}
