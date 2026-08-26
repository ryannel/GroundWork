package plan

import (
	"fmt"
	"strings"
)

// The keys each shape holds. They are closed lists: a key outside them is a
// typo, and a typo that was ignored would leave the real field empty while the
// writer looked at a file that seems right.
//
// A field with no reader in this bet is not here at all. R1 rules that, and
// D28 is why: a field nobody reads is a field two slices will fill two ways.
var (
	programKeys   = []string{"id", "title", "goal", "done", "ladder"}
	ladderKeys    = []string{"id", "line", "proof_sketch"}
	betKeys       = []string{"id", "title", "program", "design", "milestones", "slices", "facing", "deferred", "premises"}
	milestoneKeys = []string{"id", "title"}
	betSliceKeys  = []string{"id", "milestone"}
	facingKeys    = []string{"id", "line"}
	deferralKeys  = []string{"id", "reason"}
	sliceKeys     = []string{"id", "bet", "milestone", "proofs", "fixtures", "real", "faked", "facing", "records", "data"}
	proofKeys     = []string{"id", "marker", "from", "headline", "retire_at_close"}
	dataKeys      = []string{"reversibility", "runtime_class", "fixture_provenance"}
)

// contractSection is the heading of the derivation-contract section this
// slice's parser implements. R17 makes that page the one place these shapes
// are written down, and a test holds the page and the parser together.
const contractSection = "## 1. The plan files"

// fieldNames returns every field the parser reads, by the shape that holds it.
// The unknown-key check reads it, and so does the test that holds the
// derivation contract to it: one list, two readers, no second spelling.
func fieldNames() map[string][]string {
	return map[string][]string{
		"program":      programKeys,
		"ladder entry": ladderKeys,
		"bet":          betKeys,
		"milestone":    milestoneKeys,
		"bet slice":    betSliceKeys,
		"facing item":  facingKeys,
		"deferral":     deferralKeys,
		"slice plan":   sliceKeys,
		"proof":        proofKeys,
		"data block":   dataKeys,
	}
}

// optionalFields returns the fields a shape may leave out. Every other field
// the shape names has to be written. A shape absent from this map has no
// optional field at all.
//
// One list, two readers, the same way fieldNames has two. A test drives the
// parser with every one of these left out and expects the file to still read,
// and the derivation contract's own test holds the page to the same list. A
// field that changed status in the parser and not on the page shows up as a
// failure rather than as prose nobody checked (F44).
func optionalFields() map[string][]string {
	return map[string][]string{
		"bet":        {"premises", "facing", "deferred"},
		"slice plan": {"facing", "records", "data"},
	}
}

// binder pulls typed fields out of one parsed block and keeps the first thing
// that was wrong with it.
//
// The first problem is kept rather than all of them, because a file whose
// first field is broken produces nonsense for every field after it. The reader
// reads whole files, and Load counts the files (plan.go).
type binder struct {
	file  string
	shape string
	n     node
	errp  *error
}

// newBinder starts a binder over one block, and checks the block holds no key
// this shape does not read.
func newBinder(file, shape string, n node, keys []string) *binder {
	var err error
	b := &binder{file: file, shape: shape, n: n, errp: &err}
	b.unknown(keys)

	return b
}

// sub starts a binder over a block inside this one, sharing the same first
// error.
func (b *binder) sub(n node, shape string, keys []string) *binder {
	s := &binder{file: b.file, shape: shape, n: n, errp: b.errp}
	s.unknown(keys)

	return s
}

// err returns the first thing that was wrong, or nil.
func (b *binder) err() error {
	return *b.errp
}

// fail records a problem, keeping the first.
func (b *binder) fail(line int, format string, args ...any) {
	if *b.errp != nil {
		return
	}

	message := fmt.Sprintf(format, args...)
	if line > 0 {
		*b.errp = fmt.Errorf("%s line %d: %s", b.file, line, message)

		return
	}

	*b.errp = fmt.Errorf("%s: %s", b.file, message)
}

// unknown refuses a key this shape does not read.
func (b *binder) unknown(keys []string) {
	for _, key := range b.n.keys {
		if !holds(keys, key) {
			b.fail(b.n.fields[key].line, "the field %q is not one of the fields a %s holds: %s",
				key, b.shape, strings.Join(keys, ", "))
		}
	}
}

// get returns one field of the block.
func (b *binder) get(key string) (node, bool) {
	value, ok := b.n.fields[key]

	return value, ok
}

// missing records a required field that is not there.
func (b *binder) missing(key string) {
	b.fail(b.n.line, "the field %q is not there, and a %s needs it", key, b.shape)
}

// scalar reads one line of text.
func (b *binder) scalar(key string, required bool) string {
	value, ok := b.get(key)
	if !ok {
		if required {
			b.missing(key)
		}

		return ""
	}
	if value.kind != scalarNode {
		b.fail(value.line, "the field %q holds %s where a line of text was wanted", key, describe(value))

		return ""
	}

	return value.text
}

// id reads one line of text and holds it to the id rule.
func (b *binder) id(key string) string {
	raw := b.scalar(key, true)
	if raw == "" {
		return ""
	}
	if err := CheckID(raw); err != nil {
		b.fail(b.n.fields[key].line, "the field %q holds the id %q, which %s", key, clip(raw), err)

		return ""
	}

	return raw
}

// flag reads one field that must say true or false.
func (b *binder) flag(key string) bool {
	raw := b.scalar(key, true)
	switch raw {
	case "true":
		return true
	case "false":
		return false
	case "":
		return false
	}

	b.fail(b.n.fields[key].line, "the field %q holds %q, and it must say true or false", key, clip(raw))

	return false
}

// lines reads a list of lines of text. A list may be written empty as [].
func (b *binder) lines(key string, required bool) []string {
	value, ok := b.get(key)
	if !ok {
		if required {
			b.missing(key)
		}

		return nil
	}
	if value.kind != listNode {
		b.fail(value.line, "the field %q holds %s where a list was wanted", key, describe(value))

		return nil
	}

	out := make([]string, 0, len(value.items))
	for _, item := range value.items {
		if item.kind != scalarNode {
			b.fail(item.line, "the field %q holds %s where a list of lines was wanted", key, describe(item))

			return nil
		}
		out = append(out, item.text)
	}

	return out
}

// empty records a list that is there and holds nothing, where the shape needs
// at least one entry.
func (b *binder) empty(key string) {
	value, ok := b.get(key)
	if !ok {
		return
	}

	b.fail(value.line, "the field %q holds no entries, and a %s needs at least one", key, b.shape)
}

// each runs a check over every line of a list, so the message names the entry
// that was wrong rather than the list that held it.
func (b *binder) each(key string, required bool, check func(string) error) []string {
	out := b.lines(key, required)

	value, ok := b.get(key)
	if !ok {
		return out
	}

	for i, raw := range out {
		if err := check(raw); err != nil {
			b.fail(value.items[i].line, "the field %q holds %q, which %s", key, clip(raw), err)

			return nil
		}
	}

	return out
}

// ids reads a list of ids.
func (b *binder) ids(key string, required bool) []string {
	return b.each(key, required, CheckID)
}

// paths reads a list of paths, each written from the repo root.
func (b *binder) paths(key string, required bool) []string {
	return b.each(key, required, checkPath)
}

// blocks reads a list of blocks, each holding the keys of one shape.
func (b *binder) blocks(key, shape string, keys []string, required bool) []*binder {
	value, ok := b.get(key)
	if !ok {
		if required {
			b.missing(key)
		}

		return nil
	}
	if value.kind != listNode {
		b.fail(value.line, "the field %q holds %s where a list was wanted", key, describe(value))

		return nil
	}

	out := make([]*binder, 0, len(value.items))
	for _, item := range value.items {
		if item.kind != blockNode {
			b.fail(item.line, "the field %q holds %s where a list of %s entries was wanted",
				key, describe(item), shape)

			return nil
		}
		out = append(out, b.sub(item, shape, keys))
	}

	return out
}

// atLeastOneBlock reads a list of blocks that may not be empty.
func (b *binder) atLeastOneBlock(key, shape string, keys []string) []*binder {
	out := b.blocks(key, shape, keys, true)
	if len(out) == 0 {
		b.empty(key)
	}

	return out
}

// holds reports whether a closed list holds a name.
func holds(all []string, name string) bool {
	for _, one := range all {
		if one == name {
			return true
		}
	}

	return false
}

// CheckID holds an id to R1's rule: lowercase letters, digits and underscore.
//
// It is exported because the board reads slice ids off commit trailers, and an
// id has to mean one thing whether it was written in a plan file or in a commit
// message (D54 ruling 1). The error says what is wrong with the id and nothing
// about where it came from, so each caller can say that in its own words.
//
// The charset is not the row ids' charset (D28), and that is deliberate. A row
// id uses dashes; a proof id has to sit inside a Go test name, so it uses
// underscores. Neither charset admits the other's separator, so the two can
// never be read as one spelling of the same thing.
func CheckID(id string) error {
	if id == "" {
		return fmt.Errorf("is empty")
	}
	if len(id) > maxIDBytes {
		return fmt.Errorf("is %d bytes, over the limit of %d bytes", len(id), maxIDBytes)
	}

	for _, r := range id {
		switch {
		case r >= 'a' && r <= 'z':
		case r >= '0' && r <= '9':
		case r == '_':
		default:
			return fmt.Errorf("holds %q, which is not a lowercase letter, a digit or an underscore", r)
		}
	}

	return nil
}

// checkPath holds a path to the one shape a plan file may name: down from the
// repo root, with forward slashes.
//
// An absolute path is refused because it is true on one machine only, and a
// plan file is read on every machine that clones the repo.
func checkPath(path string) error {
	if path == "" {
		return fmt.Errorf("is empty")
	}
	if len(path) > maxPathBytes {
		return fmt.Errorf("is %d bytes, over the limit of %d bytes", len(path), maxPathBytes)
	}
	if strings.HasPrefix(path, "/") {
		return fmt.Errorf("is an absolute path, and a plan file names paths from the repo root")
	}
	if strings.Contains(path, `\`) {
		return fmt.Errorf("holds a backslash, and a path in a plan file is written with forward slashes")
	}
	if strings.Contains(path, ":") {
		return fmt.Errorf("holds a colon, so it is not a path inside this repo")
	}

	for _, part := range strings.Split(path, "/") {
		if part == "" || part == "." || part == ".." {
			return fmt.Errorf("holds the element %q, and a plan file's paths only go down from the repo root", part)
		}
	}

	return nil
}
