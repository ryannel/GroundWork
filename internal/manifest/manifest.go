// Package manifest reads the capability manifest: the committed file where a
// project declares what it is and what proves it.
//
// The manifest holds three things (proof.md, D25):
//
//   - Surfaces. Each product surface gets a topology profile from the spec's
//     closed list — server, web, desktop, CLI, mobile, library — and the stack
//     its tests are written in. A repo may carry more than one surface; a
//     monorepo registers once and maps each surface to a profile.
//   - Capabilities. Each names the surface it belongs to and the suites that
//     prove it. A capability with no proof is a fail-closed placeholder, never
//     a skip.
//   - Adapters. For every stack that is not Go, the command that speaks the
//     out-of-process adapter protocol. Go runs in process and declares nothing.
//
// The file is written by the project, not by this tool, so it is read the way
// every foreign input in this repo is read (D18): one shape is accepted and
// every other shape is refused by name. A manifest that half-parsed would let
// a project declare a capability the battery then silently ignored, which is
// the green-but-wrong failure the whole battery exists to catch.
package manifest

import (
	"bytes"
	"encoding/json"
	"errors"
	"fmt"
	"io"
	"io/fs"
	"os"
	"path"
	"path/filepath"
	"slices"
	"strings"

	"github.com/ryannel/groundwork/internal/journal"
)

// File is the committed manifest, named from the repo root.
//
// The spec names the capability manifest but not its path, so this is a
// recorded default: it sits under .groundwork/ beside the waivers D24 puts
// there, and it is JSON like the battery lock file.
const File = ".groundwork/manifest.json"

// Schema is the only manifest schema this tool reads. A file declaring
// anything else is refused rather than guessed at.
const Schema = 1

// maxBytes caps the manifest. A capability manifest for a large monorepo is
// still a few hundred lines; a file past this cap is a mistake or an attack,
// and either way it is refused before anything is parsed out of it.
const maxBytes = 256 * 1024

// maxNameBytes caps a surface, capability, or stack name. These names are
// printed in row evidence, which the journal caps, so a runaway name would
// push the rest of a line off the end.
const maxNameBytes = 64

// GoStack is the stack that runs in process. D25: Go goes through go/ast and
// go test -json, and every other stack goes out of process through a declared
// command.
const GoStack = "go"

// profiles is the spec's closed list of topology profiles (proof.md).
var profiles = []string{"server", "web", "desktop", "cli", "mobile", "library"}

// Manifest is one project's capability manifest.
type Manifest struct {
	Schema       int               `json:"schema"`
	Surfaces     []Surface         `json:"surfaces"`
	Capabilities []Capability      `json:"capabilities"`
	Adapters     map[string]Runner `json:"adapters,omitempty"`
}

// Surface is one product surface: a profile, the stack it is written in, and
// where it lives in the repo.
type Surface struct {
	Name    string `json:"name"`
	Profile string `json:"profile"`
	Stack   string `json:"stack"`
	Root    string `json:"root"`
}

// Capability is one thing the product must do, and what proves it.
type Capability struct {
	Name    string `json:"name"`
	Surface string `json:"surface"`

	// Proof names the suites that prove this capability.
	//
	// An entry is a suite id as that surface's adapter reports it: a path
	// relative to the surface's root, written with forward slashes. The exact
	// form is the stack's own. Go names a package directory, so internal/battery
	// is a suite and internal is not. A node project names a test file, such as
	// test/auth.test.mjs. Matching is exact — no prefixes, no subtrees — so one
	// entry names one suite.
	//
	// An empty list is allowed and means exactly one thing: nothing proves this
	// capability yet. proof.md calls that a fail-closed placeholder, so the
	// battery row turns red on it. The key itself is required. A capability that
	// forgot to say is not making the same claim as one that says nothing
	// proves it.
	Proof []string `json:"proof"`
}

// Runner is the command an out-of-process adapter runs.
type Runner struct {
	Command []string `json:"command"`
}

// Surface returns the surface with the given name.
func (m Manifest) Surface(name string) (Surface, bool) {
	for _, s := range m.Surfaces {
		if s.Name == name {
			return s, true
		}
	}

	return Surface{}, false
}

// Path returns the absolute path of the manifest for the repo dir sits in.
// dir may be any directory inside the repo: the manifest lives at the root.
func Path(dir string) (string, error) {
	root, err := journal.RepoRoot(dir)
	if err != nil {
		return "", err
	}

	return filepath.Join(root, filepath.FromSlash(File)), nil
}

// Load reads and checks the manifest of the repo dir sits in.
//
// Every error names the file, because the reader's next move is to open it.
func Load(dir string) (Manifest, error) {
	p, err := Path(dir)
	if err != nil {
		return Manifest{}, err
	}

	raw, err := os.ReadFile(p)
	if err != nil {
		// Only the reason is kept, not the absolute path: this error becomes a
		// battery row's evidence, and evidence is capped.
		return Manifest{}, fmt.Errorf("could not read the manifest %s: %w", File, reasonOnly(err))
	}

	m, err := Parse(raw)
	if err != nil {
		return Manifest{}, fmt.Errorf("the manifest %s: %w", File, err)
	}

	return m, nil
}

// Parse reads a manifest from the bytes of the file.
func Parse(raw []byte) (Manifest, error) {
	if len(raw) > maxBytes {
		return Manifest{}, fmt.Errorf("is %d bytes, over the limit of %d bytes", len(raw), maxBytes)
	}
	if len(bytes.TrimSpace(raw)) == 0 {
		return Manifest{}, errors.New("is empty")
	}

	// The shape is checked over the token stream first, before any value is
	// decoded. Two things hide from the struct decoder. One is a top-level
	// value that is not an object: null decodes into a struct without
	// complaint. The other is a key written twice, where the decoder quietly
	// keeps the last one. Either would let a file say one thing and mean
	// another.
	if err := checkShape(raw); err != nil {
		return Manifest{}, fmt.Errorf("is not valid JSON holding one object: %w", err)
	}

	dec := json.NewDecoder(bytes.NewReader(raw))
	dec.DisallowUnknownFields()

	var m Manifest
	if err := dec.Decode(&m); err != nil {
		return Manifest{}, fmt.Errorf("is not valid JSON holding a manifest: %w", err)
	}

	// The decoder stops at the end of the first value and leaves the rest of
	// the file behind it, so a good object followed by anything at all would
	// parse green while the reader saw something else.
	if dec.More() {
		return Manifest{}, errors.New("holds more than one thing: it must be one JSON object and nothing after it")
	}

	if err := m.check(); err != nil {
		return Manifest{}, err
	}

	return m, nil
}

// check refuses a manifest this tool cannot act on.
func (m Manifest) check() error {
	if m.Schema != Schema {
		return fmt.Errorf("declares the schema %d, and this tool reads schema %d", m.Schema, Schema)
	}

	if len(m.Surfaces) == 0 {
		return errors.New("declares no surfaces, so it says nothing about what this project is")
	}

	seen := map[string]bool{}
	for _, s := range m.Surfaces {
		if err := checkName("surface", s.Name); err != nil {
			return err
		}
		if seen[s.Name] {
			return fmt.Errorf("declares the surface %q twice", s.Name)
		}
		seen[s.Name] = true

		if !slices.Contains(profiles, s.Profile) {
			return fmt.Errorf("gives the surface %q the profile %q, which is not one of: %s",
				s.Name, s.Profile, strings.Join(profiles, ", "))
		}
		if err := checkName("stack", s.Stack); err != nil {
			return fmt.Errorf("the surface %q: %w", s.Name, err)
		}
		if err := checkPath(s.Root); err != nil {
			return fmt.Errorf("gives the surface %q a root that %w", s.Name, err)
		}
	}

	if len(m.Capabilities) == 0 {
		return errors.New("declares no capabilities, so it proves nothing")
	}

	named := map[string]bool{}
	for _, c := range m.Capabilities {
		if err := checkName("capability", c.Name); err != nil {
			return err
		}
		if named[c.Name] {
			return fmt.Errorf("declares the capability %q twice", c.Name)
		}
		named[c.Name] = true

		if c.Surface == "" {
			return fmt.Errorf("puts the capability %q on no surface", c.Name)
		}
		if _, ok := m.Surface(c.Surface); !ok {
			return fmt.Errorf("puts the capability %q on the surface %q, which is not declared",
				c.Name, c.Surface)
		}
		if c.Proof == nil {
			return fmt.Errorf("gives the capability %q no proof key: write an empty list to say nothing proves it yet",
				c.Name)
		}
		for _, proof := range c.Proof {
			if err := checkPath(proof); err != nil {
				return fmt.Errorf("gives the capability %q a proof that %w", c.Name, err)
			}
		}
	}

	for name, runner := range m.Adapters {
		if err := checkName("adapter", name); err != nil {
			return err
		}
		if name == GoStack {
			return fmt.Errorf("declares a command for the %s stack, which runs in process and needs none", GoStack)
		}
		if len(runner.Command) == 0 {
			return fmt.Errorf("gives the %q adapter no command to run", name)
		}
		for _, word := range runner.Command {
			if strings.TrimSpace(word) == "" {
				return fmt.Errorf("gives the %q adapter a command holding an empty word", name)
			}
		}
	}

	return nil
}

// checkName refuses a name outside the charset.
//
// The charset is the battery row id's: lowercase letters, digits and dashes.
// These names are printed in tables and matched against stack names, so one
// spelling per name is what keeps two files agreeing.
func checkName(what, name string) error {
	if name == "" {
		return fmt.Errorf("declares a %s with no name", what)
	}
	if len(name) > maxNameBytes {
		return fmt.Errorf("declares a %s name of %d bytes, over the limit of %d bytes",
			what, len(name), maxNameBytes)
	}

	for _, r := range name {
		switch {
		case r >= 'a' && r <= 'z':
		case r >= '0' && r <= '9':
		case r == '-':
		default:
			return fmt.Errorf("declares the %s name %q, which holds %q: names are lowercase letters, digits and dashes",
				what, name, r)
		}
	}

	return nil
}

// checkPath refuses a path that is empty, absolute, or climbs out of the
// project it is written in. Both a surface root and a proof entry are read as
// a place inside the repo, and a manifest must not be able to point the tools
// at the rest of the disk.
func checkPath(p string) error {
	if strings.TrimSpace(p) == "" {
		return errors.New("is empty")
	}
	if path.IsAbs(p) || filepath.IsAbs(p) || strings.HasPrefix(p, "\\") {
		return fmt.Errorf("is absolute: %q", p)
	}
	if strings.ContainsRune(p, 0) {
		return fmt.Errorf("holds a zero byte: %q", p)
	}

	clean := path.Clean(strings.ReplaceAll(p, "\\", "/"))
	if clean == ".." || strings.HasPrefix(clean, "../") {
		return fmt.Errorf("climbs out of the project: %q", p)
	}

	return nil
}

// checkShape walks the JSON token stream to refuse two shapes the struct
// decoder would accept: a top-level value that is not an object, and any
// object with the same key twice.
func checkShape(raw []byte) error {
	dec := json.NewDecoder(bytes.NewReader(raw))
	dec.UseNumber()

	first, err := dec.Token()
	if err != nil {
		return err
	}
	if delim, ok := first.(json.Delim); !ok || delim != '{' {
		return fmt.Errorf("the file starts with %v, not an object", first)
	}

	return walkObject(dec)
}

// walkObject reads one object's keys, refusing a repeat, and recurses into
// whatever the values hold. The opening brace has already been read.
func walkObject(dec *json.Decoder) error {
	seen := map[string]bool{}

	for {
		tok, err := dec.Token()
		if err != nil {
			return err
		}
		if delim, ok := tok.(json.Delim); ok && delim == '}' {
			return nil
		}

		key, ok := tok.(string)
		if !ok {
			return fmt.Errorf("expected a key, found %v", tok)
		}
		if seen[key] {
			return fmt.Errorf("the key %q is written twice in one object", key)
		}
		seen[key] = true

		if err := walkValue(dec); err != nil {
			return err
		}
	}
}

// walkValue reads one value, recursing through objects and lists.
func walkValue(dec *json.Decoder) error {
	tok, err := dec.Token()
	if err != nil {
		return err
	}

	delim, ok := tok.(json.Delim)
	if !ok {
		return nil
	}

	switch delim {
	case '{':
		return walkObject(dec)
	case '[':
		for {
			// Peeking is what tells a closing bracket from another value, and
			// the decoder has no peek: More reports whether one is left.
			if !dec.More() {
				if _, err := dec.Token(); err != nil {
					return err
				}

				return nil
			}
			if err := walkValue(dec); err != nil {
				return err
			}
		}
	default:
		return fmt.Errorf("found %v where a value should be", delim)
	}
}

// reasonOnly strips the operation and the path off a file error, leaving why
// it failed.
func reasonOnly(err error) error {
	var pathErr *fs.PathError
	if errors.As(err, &pathErr) {
		return pathErr.Err
	}
	if errors.Is(err, io.EOF) {
		return errors.New("the file is empty")
	}

	return err
}
