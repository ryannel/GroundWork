package battery

import (
	"bytes"
	"fmt"
	"io/fs"
	"os"
	"path/filepath"
	"strings"
	"unicode/utf8"

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
//
// name is how the row calls itself in its own evidence, noun and all — "honesty
// scan", "run-evidence row". The row-shaped machinery below is not only the
// scans' any more, and a row that runs the project calling itself a scan would
// be telling the reader the wrong thing about what it just did.
func openScan(name string, c Context) (scanned, Result, bool) {
	m, err := manifest.Load(c.RepoDir)
	if err != nil {
		return scanned{}, Result{
			Outcome:  Unrunnable,
			Evidence: fmt.Sprintf("the %s does not know what to read: %v", name, err),
		}, false
	}

	root, err := journal.RepoRoot(c.RepoDir)
	if err != nil {
		return scanned{}, Result{
			Outcome:  Unrunnable,
			Evidence: fmt.Sprintf("the %s could not find the repository: %v", name, err),
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

// maxReasonBytes caps one tool's complaint inside a line of evidence. The
// journal caps the whole line, and a runaway message from a tool would push
// the row's own words off the end of it.
const maxReasonBytes = 70

// reason renders another tool's error for a line of evidence: the machine's
// own directories taken out, and the length capped.
//
// The absolute path is what has to go. A row's evidence is read on a different
// machine from the one that wrote it, and /tmp/TestSomething3141592/001 says
// nothing there — the same reason ReadLock keeps only the reason off a file
// error rather than the path os put in front of it.
func (s scanned) reason(err error) string {
	return s.said(err.Error())
}

// said is reason for words that did not come back as an error. A panic's own
// message is one, and it is read on the same far-away machine.
func (s scanned) said(said string) string {
	said = s.tidy(said)

	if len(said) <= maxReasonBytes {
		return said
	}

	kept := said[:maxReasonBytes-3]
	for len(kept) > 0 && !utf8.ValidString(kept) {
		kept = kept[:len(kept)-1]
	}

	return kept + "..."
}

// tidy is said without the cap: the machine's own directories taken out and the
// whitespace collapsed, so one message reads the same wherever it is printed.
//
// It is split out for the caller that wants the end of a message rather than the
// start. A compiler puts the package path first and the thing to fix last, so a
// row quoting one has to be able to cap it from the other end — and doing that
// after said had already cut the front would quote the middle of the message and
// nothing else.
func (s scanned) tidy(said string) string {
	said = strings.ReplaceAll(said, s.root+string(filepath.Separator), "")
	said = strings.ReplaceAll(said, s.root, ".")

	return strings.Join(strings.Fields(said), " ")
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

// items renders the notes as one entry per thing the scan declined to read.
func (n scanNotes) items() []string {
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

	return said
}

// String renders the notes as a tail for a line of evidence, empty when there
// is nothing to say.
func (n scanNotes) String() string {
	return tailOf(n.clauses())
}

// clauses renders the notes as one clause of a row's tail, or none at all.
func (n scanNotes) clauses() []string {
	said := n.items()
	if len(said) == 0 {
		return nil
	}

	return []string{strings.Join(said, "; ")}
}

// tailOf renders a row's trailing clauses for a line of evidence: nothing at
// all when there are none, and each clause after a semicolon otherwise.
//
// A clause is one whole statement the row adds about itself — what it declared,
// what it could not reach, what it declined to read. They stay a list rather
// than a string because a red line has to be able to give one up to make room
// for the name of a hit, and a joined string cannot be taken apart again
// without cutting a sentence in half.
func tailOf(clauses []string) string {
	if len(clauses) == 0 {
		return ""
	}

	return "; " + strings.Join(clauses, "; ")
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
// It returns the bytes, what the scan may do with them, and — for a file it
// turned away — why. A file it turns away is never an error: it is a fact,
// counted in the notes, that the row prints in its evidence.
//
// The reason is there for the row whose verdict rests on the file having been
// read. Most rows judge each file on its own and only need the count; the
// wiring row on a library profile needs to name the file it could not sweep.
func openFile(path string, d fs.DirEntry, notes *scanNotes) ([]byte, fileState, string) {
	if d.Type()&fs.ModeSymlink != 0 {
		notes.symlinks++

		return nil, fileSkipped, "is a symlink, which no scan follows"
	}
	if !d.Type().IsRegular() {
		// Counted as unread, not left silent. A named pipe or a device where a
		// source file should be is rare, but a scan that passed over one
		// without saying so would be checking less than the reader believes.
		notes.unreadable++

		return nil, fileSkipped, "is not a regular file"
	}

	src, err := os.ReadFile(path)
	if err != nil {
		// A file the walk just listed and cannot be read now is a permission or
		// a race, and neither is this row's subject. It counts as a skip so it
		// still shows up in the evidence rather than vanishing.
		notes.unreadable++

		return nil, fileSkipped, "could not be read"
	}
	if isGenerated(src) {
		notes.generated++

		return src, fileGenerated, ""
	}

	return src, fileRead, ""
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

// hit is one thing a row found, named so a reader can act on it without
// asking anything else: where it is, what it is about, and what is wrong with
// it.
//
// The three scans put a file and a line in it, because their hits are places in
// source. A row whose hit is not a place in a file — the id of a test that
// never ran, the name of a surface — leaves the line at zero and writes what it
// found in file.
type hit struct {
	file    string
	line    int
	subject string
	shape   string
}

// String renders one hit for a line of evidence.
func (h hit) String() string {
	where := h.file
	if h.line > 0 {
		where = fmt.Sprintf("%s:%d", h.file, h.line)
	}
	if h.subject == "" {
		return where + " " + h.shape
	}

	return where + " " + h.subject + " " + h.shape
}

// hitEvidence renders a red row's evidence: what the scan found, then as many
// hits as fit whole, then how many it left out, then what the row has to add
// about itself.
//
// The journal's cap is respected here rather than left to the journal's own
// trimming. A line the journal cut would end mid-word, halfway through a file
// name, and a reader cannot act on half a path. So the row decides what to
// drop and says how much it dropped, and the line that reaches the record is
// made of whole pieces.
//
// What a reader can act on outranks what the row says about itself. A hit names
// a file, a line and a thing somebody has to go and look at; a clause of the
// tail explains the scan. So the tail gives way first, one whole clause at a
// time from the front — which is why a row orders its clauses with the most
// droppable first and the count of what it declined to read last. A clause is
// only dropped when there are no bytes left for it.
func hitEvidence(prefix string, all []hit, clauses []string) string {
	for drop := 0; drop <= len(clauses); drop++ {
		for shown := len(all); shown > 0; shown-- {
			line := prefix + hitsOf(all, shown) + tailOf(clauses[drop:])
			if len(line) <= journal.MaxTextBytes {
				return line
			}
		}
	}

	// Not even one whole hit fits, which means one hit is longer than a line of
	// evidence. What is left of the budget still goes on what a reader can act
	// on: the name of the first hit and where it sits, as much of it as fits.
	// The alternative is a line the journal cuts mid-path, and half a path is
	// worse than none.
	ladder := firstOf(all[0])
	for _, first := range ladder {
		for drop := 0; drop <= len(clauses); drop++ {
			line := prefix + first + tailOf(clauses[drop:])
			if len(line) <= journal.MaxTextBytes {
				return line
			}
		}
	}

	// The prefix alone has filled the line, which takes a count no row will
	// reach. Trimming is all that is left.
	return cutTo(prefix+ladder[len(ladder)-1], journal.MaxTextBytes)
}

// firstOf is the ladder a red climbs down when not one whole hit fits on a
// line: the first hit named and placed, then placed by its file's own name,
// then the place alone.
//
// For a hit that is a place in a file, what is wrong with it gives way first,
// because a reader holding the name and the line can go and see that much for
// themselves.
//
// A hit that is not a place in a file has no path for anybody to open, and it
// climbs a different first rung. D57 ruling 6: there the reason outranks the
// value. What the row concluded is the line's own contribution, and the value
// it concluded it about can be fetched from the commit the line already names.
// Only a hit that carries both a subject and no line takes that rung — a hit
// with neither has nothing but its value, and giving that up would leave the
// line saying nothing at all.
func firstOf(h hit) []string {
	place := func(file string) string {
		if h.line > 0 {
			return fmt.Sprintf("%s:%d", file, h.line)
		}

		return file
	}

	var said []string
	base := filepath.Base(h.file)

	if h.line == 0 && h.subject != "" && h.shape != "" {
		said = append(said, "the first "+h.subject+" "+h.shape)
	}
	if h.subject != "" {
		said = append(said, "the first is "+h.subject+" at "+place(h.file))
		if base != h.file {
			said = append(said, "the first is "+h.subject+" at "+place(base))
		}
	}
	said = append(said, "the first is in "+h.file)
	if base != h.file {
		said = append(said, "the first is in "+base)
	}

	return said
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
