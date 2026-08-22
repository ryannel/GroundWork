package battery

import (
	"bytes"
	"fmt"
	"io/fs"
	"os"
	"path/filepath"
	"strings"

	"github.com/ryannel/groundwork/internal/journal"
	"github.com/ryannel/groundwork/internal/manifest"
)

// The three scan rows — honesty, wiring, token — read the project's own source
// instead of running it. What they share sits here: where they are allowed to
// look, what they must never read, and how a hit is written down.
//
// Four rules hold across all three.
//
// The manifest says where to look. A scan walks the surface roots the project
// declared and nothing else, so a scan can never wander into a directory the
// project never claimed.
//
// A symlink is never followed. A link can point anywhere on the machine, and a
// scan that read through one would be judging code this project does not ship.
// filepath.WalkDir already refuses to descend a linked directory; this adds the
// other half, which is the linked file.
//
// A generated file is not somebody's work, so it is not judged. Go's own
// convention names them: a line matching "Code generated ... DO NOT EDIT."
// before the package clause. The same marker is honoured in every language a
// scan reads, because every generator that writes it means the same thing by
// it.
//
// Nothing is skipped in silence. Every file a scan declines to read is counted
// and printed in the row's own evidence, green or red. A skip nobody can see is
// how a scan comes to check less than the reader believes.

// scanned is what a scan row works out before it opens a single file: the repo
// root, and the surfaces the project declared.
type scanned struct {
	root string
	m    manifest.Manifest
}

// openScan reads the manifest and finds the repo root, or returns the result
// the row reports instead.
//
// A manifest that will not load leaves a scan unrunnable rather than red. The
// manifest row is the one that judges the manifest, and one unreadable file
// must not print as four separate defects — but it must not print as green
// either, so unrunnable is the honest answer: this row could not reach the
// thing it checks.
func openScan(row string, c Context) (scanned, Result, bool) {
	m, err := manifest.Load(c.RepoDir)
	if err != nil {
		return scanned{}, Result{
			Outcome:  Unrunnable,
			Evidence: fmt.Sprintf("the %s scan does not know what to read: %v", row, err),
		}, false
	}

	root, err := journal.RepoRoot(c.RepoDir)
	if err != nil {
		return scanned{}, Result{
			Outcome:  Unrunnable,
			Evidence: fmt.Sprintf("the %s scan could not find the repository: %v", row, err),
		}, false
	}

	return scanned{root: root, m: m}, Result{}, true
}

// dir returns the absolute directory of one surface.
func (s scanned) dir(surface manifest.Surface) string {
	return filepath.Join(s.root, filepath.FromSlash(surface.Root))
}

// rel names a path the way evidence does: from the repo root, with forward
// slashes, so the same hit reads the same on every machine.
func (s scanned) rel(path string) string {
	got, err := filepath.Rel(s.root, path)
	if err != nil {
		return filepath.ToSlash(path)
	}

	return filepath.ToSlash(got)
}

// skipDirs are the directories no scan walks into. testdata is Go's own
// fixture convention and its tooling ignores it; the rest are other people's
// code or build output. Directories whose name starts with a dot go too.
var skipDirs = []string{"testdata", "vendor", "node_modules"}

// skipDir reports whether a directory is one no scan enters.
func skipDir(name string) bool {
	if strings.HasPrefix(name, ".") {
		return true
	}

	for _, skip := range skipDirs {
		if name == skip {
			return true
		}
	}

	return false
}

// scanNotes counts what a scan declined to read. Every scan prints these,
// whatever its outcome, so a reader can tell a clean scan from a narrow one.
type scanNotes struct {
	generated  int
	symlinks   int
	unreadable int
}

// add folds one scan's notes into another's.
func (n *scanNotes) add(other scanNotes) {
	n.generated += other.generated
	n.symlinks += other.symlinks
	n.unreadable += other.unreadable
}

// String renders the notes as a tail for a line of evidence, empty when there
// is nothing to say.
func (n scanNotes) String() string {
	var said []string
	if n.generated > 0 {
		said = append(said, fmt.Sprintf("%s skipped", counted(n.generated, "generated file was", "generated files were")))
	}
	if n.symlinks > 0 {
		said = append(said, fmt.Sprintf("%s not followed", counted(n.symlinks, "symlink was", "symlinks were")))
	}
	if n.unreadable > 0 {
		said = append(said, fmt.Sprintf("%s not read", counted(n.unreadable, "file was", "files were")))
	}
	if len(said) == 0 {
		return ""
	}

	return "; " + strings.Join(said, "; ")
}

// fileState says what a scan is allowed to do with one file.
type fileState int

const (
	// fileSkipped: the scan must not read this file at all.
	fileSkipped fileState = iota

	// fileGenerated: nobody wrote this file, so nothing in it is anyone's
	// work. A scan judges nothing here. The wiring scan still reads its
	// references, because generated code wires real code up.
	fileGenerated

	// fileRead: read it and judge it.
	fileRead
)

// openFile reads one file a scan wants, applying the rules every scan shares.
//
// It returns the bytes and what the scan may do with them. A file it turns
// away is never an error: it is a fact, counted in the notes, that the row
// prints in its evidence.
func openFile(path string, d fs.DirEntry, notes *scanNotes) ([]byte, fileState) {
	if d.Type()&fs.ModeSymlink != 0 {
		notes.symlinks++

		return nil, fileSkipped
	}
	if !d.Type().IsRegular() {
		return nil, fileSkipped
	}

	src, err := os.ReadFile(path)
	if err != nil {
		// A file the walk just listed and cannot be read now is a permission or
		// a race, and neither is this row's subject. It counts as a skip so it
		// still shows up in the evidence rather than vanishing.
		notes.unreadable++

		return nil, fileSkipped
	}
	if isGenerated(src) {
		notes.generated++

		return src, fileGenerated
	}

	return src, fileRead
}

// generatedHeadLines is how far into a file the generated marker is looked
// for. Go's rule is that the line comes before the package clause; other
// languages put a licence header above it, so a few lines of slack are given.
const generatedHeadLines = 10

// isGenerated reports whether a file carries the generated-code marker.
//
// The two halves are matched separately, because the middle of the line is the
// generator's own name and every generator writes a different one.
func isGenerated(src []byte) bool {
	head := src
	for range generatedHeadLines {
		cut := bytes.IndexByte(head, '\n')
		if cut < 0 {
			break
		}
		line := head[:cut]
		if bytes.Contains(line, []byte("Code generated")) && bytes.Contains(line, []byte("DO NOT EDIT.")) {
			return true
		}
		head = head[cut+1:]
	}

	return false
}

// hit is one thing a scan found, named so a reader can act on it without
// asking anything else: the file from the repo root, the line, what it is
// about, and what is wrong with it.
type hit struct {
	file    string
	line    int
	subject string
	shape   string
}

// String renders one hit for a line of evidence.
func (h hit) String() string {
	if h.subject == "" {
		return fmt.Sprintf("%s:%d %s", h.file, h.line, h.shape)
	}

	return fmt.Sprintf("%s:%d %s %s", h.file, h.line, h.subject, h.shape)
}

// hitEvidence renders a red row's evidence: what the scan found, then as many
// hits as fit whole, then how many it left out.
//
// The journal's cap is respected here rather than left to the journal's own
// trimming. A line the journal cut would end mid-word, halfway through a file
// name, and a reader cannot act on half a path. So the row decides what to
// drop and says how much it dropped, and the line that reaches the record is
// made of whole hits.
func hitEvidence(prefix string, all []hit, tail string) string {
	for shown := len(all); shown > 1; shown-- {
		line := prefix + hitsOf(all, shown) + tail
		if len(line) <= journal.MaxTextBytes {
			return line
		}
	}

	return prefix + hitsOf(all, 1) + tail
}

// hitsOf renders the first few hits, in the order they were found, and says
// how many it left out.
func hitsOf(all []hit, shown int) string {
	said := make([]string, 0, shown)
	for _, h := range all[:shown] {
		said = append(said, h.String())
	}

	line := strings.Join(said, "; ")
	if left := len(all) - shown; left > 0 {
		line += fmt.Sprintf(" and %d more", left)
	}

	return line
}
