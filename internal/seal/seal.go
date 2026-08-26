// Package seal builds, reads and checks GroundWork's seals.
//
// A seal is an annotated git tag named seal/<kind>/<subject-id>. Its message
// names the kind, the subject, and every path the seal covers with that path's
// blob hash at the sealed commit. The battery version pair rides as trailers on
// the same tag. R3 rules all of that, and docs/derivation-contract.md section 2
// writes the shape down.
//
// Verify recomputes each covered path's blob hash at HEAD and names every path
// that moved. That makes "does the work still match what was sealed" a hash
// comparison rather than a reading.
//
// Two limits are recorded here rather than papered over.
//
// There is no signing key the agents cannot read, so this package never holds
// or creates one. It only verifies, against a committed allowed-signers file.
// A seal it grants is unsigned, and every line it prints says so: unsigned is
// loud, and it is never human authority (R4).
//
// And the host's git proxy refuses pushes outside refs/heads, so a seal tag
// cannot travel as a tag. Each tag's raw object bytes are mirrored as a blob on
// a branch, and Restore rehydrates them byte for byte (R5). The branch is a
// mirror. The tag stays the thing the tools read.
package seal

import (
	"fmt"
	"regexp"
	"slices"
	"sort"
	"strings"
	"unicode"
	"unicode/utf8"
)

// Branch is the mirror branch. Each seal tag's own bytes live on it, because
// the host will not carry a tag ref.
const Branch = "groundwork-seals"

// The three places the mirror writes, named from the root of that branch.
const (
	// TagDir holds one file per tag, named for the tag, holding its raw bytes.
	TagDir = "tags/"

	// PriorDir holds the tags an amendment replaced, filed under the tag name
	// and then the object id they had.
	PriorDir = "prior/"

	// IndexFile lists the tags the mirror holds: one line of "<oid> <tag>".
	IndexFile = "index.txt"
)

// AllowedSignersFile is the committed file a signature is checked against,
// named from the repo root. It is committed so a fresh clone can verify with no
// keyring setup.
const AllowedSignersFile = ".groundwork/allowed-signers"

// tagPrefix opens every seal tag's name.
const tagPrefix = "seal/"

// The caps, all of them. Each is far above what a person writes and far below
// what would make an error message unreadable.
const (
	// MaxMessageBytes caps a whole tag message.
	MaxMessageBytes = 65536

	// MaxPathBytes caps one covered path.
	MaxPathBytes = 300

	// MaxSubjectBytes caps a subject id.
	MaxSubjectBytes = 64
)

// blobHash is what a covered path's hash has to look like: git's own object id,
// lowercase.
var blobHash = regexp.MustCompile(`^[0-9a-f]{40}$`)

// batteryPair is D23's version shape: a declared MAJOR.MINOR, a plus, and the
// digest of the row manifest.
var batteryPair = regexp.MustCompile(`^[0-9]+\.[0-9]+\+r[0-9a-f]{7}$`)

// batteryRunID is the run id shape the battery makes.
var batteryRunID = regexp.MustCompile(`^run-[0-9]{8}T[0-9]{6}Z-[0-9a-f]{4}$`)

// coveredPath is what a covered path may be spelled with. The contract page
// states the rule; this is the same rule, and D52.7 is the ruling that there is
// only one of them.
//
// It is tighter than what git will store, on purpose. A covered path is handed
// straight back to git as a pathspec, and pathspec magic — a leading colon, a
// glob — would turn one path into a different question. A leading dash would
// turn it into an option. This charset admits none of the three, and it is
// wide enough for every path this repo or any ordinary project holds.
var coveredPath = regexp.MustCompile(`^[A-Za-z0-9.][A-Za-z0-9._/-]*$`)

// subjectID is the id charset: the same one the plan files use, so a subject
// can name a slice, a bet or a program without being respelled.
var subjectID = regexp.MustCompile(`^[a-z0-9_]+$`)

// kinds is the closed vocabulary for a seal's kind. R3 fixes it at four, and
// the journal's seal_kind is closed to the same four.
var kinds = []string{"design", "acceptance", "birth", "adoption"}

// Kinds returns the kinds a seal may carry.
func Kinds() []string {
	return slices.Clone(kinds)
}

// Covered is one path a seal covers, with that path's blob hash at the sealed
// commit.
type Covered struct {
	Blob string
	Path string
}

// Message is what a seal tag says.
type Message struct {
	Kind    string
	Subject string

	// Covered is every path the seal covers, sorted by path. Composition is a
	// longer list here, never a second tag (R3).
	Covered []Covered

	// Battery and BatteryRun are D23's trailers: the version pair the seal was
	// granted under, and the run that produced it.
	Battery    string
	BatteryRun string
}

// TagName returns the tag one seal lives at: seal/<kind>/<subject-id>.
//
// It checks both halves, because the result is a ref name. A kind or subject
// carrying a slash, a dash at the front, or anything outside the charset would
// name something other than the seal that was asked for.
func TagName(kind, subject string) (string, error) {
	if err := checkKind(kind); err != nil {
		return "", err
	}
	if err := checkSubject(subject); err != nil {
		return "", err
	}

	return tagPrefix + kind + "/" + subject, nil
}

// Render writes a message in the shape the contract fixes.
//
// The covered paths are sorted here rather than trusted in the order they
// arrived, so two grants over the same set produce the same bytes — and the tag
// object id becomes a function of what was sealed.
func (m Message) Render() (string, error) {
	if err := checkKind(m.Kind); err != nil {
		return "", err
	}
	if err := checkSubject(m.Subject); err != nil {
		return "", err
	}

	covered := slices.Clone(m.Covered)
	sort.Slice(covered, func(i, j int) bool { return covered[i].Path < covered[j].Path })

	if err := checkCovered(covered); err != nil {
		return "", err
	}
	if err := checkTrailers(m.Battery, m.BatteryRun); err != nil {
		return "", err
	}

	var b strings.Builder
	fmt.Fprintf(&b, "seal: %s %s\n\ncovers:\n", m.Kind, m.Subject)
	for _, one := range covered {
		fmt.Fprintf(&b, "  %s %s\n", one.Blob, one.Path)
	}
	fmt.Fprintf(&b, "\nBattery: %s\nBattery-Run: %s\n", m.Battery, m.BatteryRun)

	text := b.String()
	if len(text) > MaxMessageBytes {
		return "", fmt.Errorf("the message is %d bytes, over the limit of %d", len(text), MaxMessageBytes)
	}

	return text, nil
}

// ParseMessage reads a tag message back.
//
// Every shape that is not the one the contract fixes is refused by name, and
// none of it is guessed at. A tag message is written by whoever can write a
// tag, which in this environment is any agent, so a lenient reader here would
// be a way to say something the shape does not allow.
func ParseMessage(text string) (Message, error) {
	if len(text) > MaxMessageBytes {
		return Message{}, fmt.Errorf("the message is %d bytes, over the limit of %d",
			len(text), MaxMessageBytes)
	}
	if strings.TrimSpace(text) == "" {
		return Message{}, fmt.Errorf("the message is empty, and a seal says what it covers")
	}

	lines := strings.Split(strings.TrimRight(text, "\n"), "\n")

	var m Message
	var err error

	m.Kind, m.Subject, err = parseSealLine(lines[0])
	if err != nil {
		return Message{}, err
	}

	if len(lines) < 2 || lines[1] != "" {
		return Message{}, fmt.Errorf("the line under %q is not blank, and the contract puts a blank line there",
			clip(lines[0]))
	}
	if len(lines) < 3 || lines[2] != "covers:" {
		return Message{}, fmt.Errorf("the third line is %q, and the contract puts %q there",
			clip(lineAt(lines, 2)), "covers:")
	}

	at := 3
	for ; at < len(lines) && lines[at] != ""; at++ {
		one, err := parseCoveredLine(lines[at])
		if err != nil {
			return Message{}, err
		}
		m.Covered = append(m.Covered, one)
	}
	if err := checkCovered(m.Covered); err != nil {
		return Message{}, err
	}

	// The loop above stops on the end of the message or on a blank line. Which
	// one it stopped on is not asked here: a message that ends with its covers
	// list has no trailers either, and trailerAt refuses it by name one step
	// later. Two guards over one rule leave one of them with no test that can
	// reach it, which the deletion sweep finds as a survivor.
	at++

	m.Battery, err = trailerAt(lines, at, "Battery: ", batteryPair)
	if err != nil {
		return Message{}, err
	}
	m.BatteryRun, err = trailerAt(lines, at+1, "Battery-Run: ", batteryRunID)
	if err != nil {
		return Message{}, err
	}

	if rest := at + 2; rest < len(lines) {
		return Message{}, fmt.Errorf("the message says %q after its trailers, and a seal ends there",
			clip(lines[rest]))
	}

	return m, nil
}

// parseSealLine reads the first line: "seal: <kind> <subject>".
func parseSealLine(line string) (string, string, error) {
	rest, found := strings.CutPrefix(line, "seal: ")
	if !found {
		return "", "", fmt.Errorf("the first line is %q, and a seal message opens with %q",
			clip(line), "seal: ")
	}

	kind, subject, found := strings.Cut(rest, " ")
	if !found {
		return "", "", fmt.Errorf("the %q line is %q, and it names a kind and a subject",
			"seal:", clip(line))
	}
	if strings.Contains(subject, " ") {
		return "", "", fmt.Errorf("the %q line is %q, and it names a kind and a subject and nothing else",
			"seal:", clip(line))
	}
	if err := checkKind(kind); err != nil {
		return "", "", err
	}
	if err := checkSubject(subject); err != nil {
		return "", "", err
	}

	return kind, subject, nil
}

// parseCoveredLine reads one line of the covers list: two spaces, the blob
// hash, one space, the path.
func parseCoveredLine(line string) (Covered, error) {
	rest, found := strings.CutPrefix(line, "  ")
	if !found {
		return Covered{}, fmt.Errorf("the covered line %q does not open with two spaces", clip(line))
	}

	blob, path, found := strings.Cut(rest, " ")
	if !found {
		return Covered{}, fmt.Errorf("the covered line %q is not a blob hash and a path", clip(line))
	}
	if !blobHash.MatchString(blob) {
		return Covered{}, fmt.Errorf("the covered line %q does not open with a blob hash", clip(line))
	}
	if err := checkPath(path); err != nil {
		return Covered{}, err
	}

	return Covered{Blob: blob, Path: path}, nil
}

// trailerAt reads one trailer, checks its shape, and says which one is wrong.
//
// The trailers are read at fixed places rather than searched for. A search
// would let a second Battery line further down decide the answer, and which of
// the two won would be an accident of the reader.
func trailerAt(lines []string, at int, head string, shape *regexp.Regexp) (string, error) {
	if at >= len(lines) {
		return "", fmt.Errorf("the message has no %s trailer", strings.TrimSuffix(head, " "))
	}

	value, found := strings.CutPrefix(lines[at], head)
	if !found {
		return "", fmt.Errorf("the line %q is not the %s trailer the contract puts there",
			clip(lines[at]), strings.TrimSuffix(head, " "))
	}
	if !shape.MatchString(value) {
		return "", fmt.Errorf("the %s trailer says %q, which is not the shape D23 fixes",
			strings.TrimSuffix(head, " "), clip(value))
	}

	return value, nil
}

// lineAt returns one line, or an empty string when the message is shorter than
// the reader expected. F53 was a walk that read past its own slice.
func lineAt(lines []string, at int) string {
	if at < 0 || at >= len(lines) {
		return ""
	}

	return lines[at]
}

// checkKind rejects a kind outside the four.
func checkKind(kind string) error {
	if kind == "" {
		return fmt.Errorf("a seal has no kind, and it must be one of: %s", strings.Join(kinds, ", "))
	}
	if !slices.Contains(kinds, kind) {
		return fmt.Errorf("the seal kind %q is not one of: %s", clip(kind), strings.Join(kinds, ", "))
	}

	return nil
}

// checkSubject rejects a subject id that would name the wrong ref.
func checkSubject(subject string) error {
	if subject == "" {
		return fmt.Errorf("a seal has no subject, and a seal names what it seals")
	}
	if len(subject) > MaxSubjectBytes {
		return fmt.Errorf("the subject is %d bytes, over the limit of %d", len(subject), MaxSubjectBytes)
	}
	if !subjectID.MatchString(subject) {
		return fmt.Errorf("the subject %q is not lowercase letters, digits and underscores", clip(subject))
	}

	return nil
}

// checkPath rejects a covered path that is not written plainly.
func checkPath(path string) error {
	if len(path) > MaxPathBytes {
		return fmt.Errorf("a covered path is %d bytes, over the limit of %d", len(path), MaxPathBytes)
	}
	if !coveredPath.MatchString(path) {
		return fmt.Errorf("the covered path %q must open with a letter, a digit or a dot, then hold only letters, digits, dots, dashes, underscores and slashes",
			clip(path))
	}
	for _, part := range strings.Split(path, "/") {
		if part == "" || part == "." || part == ".." {
			return fmt.Errorf("the covered path %q does not name one file under the repo root", clip(path))
		}
	}

	return nil
}

// checkCovered rejects a covers list that names nothing, names one path twice,
// or is out of order.
//
// Sorted, because the order is part of the bytes and the bytes are the tag's
// id. Two grants over the same set must produce the same tag.
func checkCovered(covered []Covered) error {
	if len(covered) == 0 {
		return fmt.Errorf("the covers list names no path, and a seal that covers nothing seals nothing")
	}

	for i, one := range covered {
		if i == 0 {
			continue
		}
		if one.Path == covered[i-1].Path {
			return fmt.Errorf("the covers list names %q twice", clip(one.Path))
		}
		if one.Path < covered[i-1].Path {
			return fmt.Errorf("the covers list is not sorted: %q comes after %q",
				clip(one.Path), clip(covered[i-1].Path))
		}
	}

	return nil
}

// checkTrailers rejects a battery pair that is not the shape D23 fixes.
func checkTrailers(battery, run string) error {
	if !batteryPair.MatchString(battery) {
		return fmt.Errorf("the Battery trailer says %q, which is not the shape D23 fixes", clip(battery))
	}
	if !batteryRunID.MatchString(run) {
		return fmt.Errorf("the Battery-Run trailer says %q, which is not a run id", clip(run))
	}

	return nil
}

// clip renders one value off a tag safe and short enough to sit in an error.
//
// Safe first: a tag message is written by whoever can write a tag. Then short:
// an error the size of a tag is not one anybody reads.
//
// A value, not a whole sentence. An error built from clipped values and fixed
// words is bounded already, and clipping it again would cut the words that say
// what is wrong.
func clip(text string) string {
	const most = 60

	return clipTo(text, most)
}

// say renders a whole sentence from somewhere else safe to print. Git's own
// words about a ref it could not read land here.
func say(text string) string {
	const most = 200

	return clipTo(text, most)
}

// clipTo makes text printable and no longer than most bytes, cutting at a rune
// boundary and saying where it was cut.
func clipTo(text string, most int) string {
	text = printable(text)
	if len(text) <= most {
		return text
	}

	const mark = "..."

	if most <= len(mark) {
		return ""
	}

	kept := text[:most-len(mark)]
	for len(kept) > 0 && !valid(kept) {
		kept = kept[:len(kept)-1]
	}

	return kept + mark
}

// printable renders somebody else's text safe to put in a message.
//
// Every character that is not printable becomes a space. A newline in a tag's
// message would otherwise draw a row of its own in the verify table, and a run
// that prints a forged row is worse than one that prints nothing. A space
// rather than nothing, so two words never run together into a third.
//
// This is D38 ruling 4, applied where D49 ruling 2 says to apply it: to every
// value a line takes off a tag.
func printable(text string) string {
	return strings.Map(func(r rune) rune {
		if unicode.IsPrint(r) {
			return r
		}

		return ' '
	}, strings.ToValidUTF8(text, ""))
}

// valid reports whether a string is whole UTF-8. Cutting text to a byte count
// can leave half a rune behind, and half a rune is not text.
func valid(text string) bool {
	return utf8.ValidString(text)
}
