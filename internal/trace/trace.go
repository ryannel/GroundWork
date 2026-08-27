// Package trace reads a plan in both directions, and reads the record for the
// artifacts a bet says it stands on.
//
// Backward (R12): every proof carries from: <design-path>#<anchor>, and the
// anchor has to name a heading somebody actually wrote. The plan reader already
// holds the reference's shape and the file's existence — that is the plan row's
// red — so what lands here is the one question nothing else asks: does the
// anchor resolve.
//
// Forward (R12): every id in a bet's facing list is claimed by exactly one of
// its slices, or listed under deferred with a reason. Unclaimed and unrecorded
// is red, and claimed twice is red. This direction exists because of a recorded
// failure: a sealed pattern that belonged to no slice, where every slice was
// individually correct and only this reading saw it.
//
// Beside them (R13): a bet declares premises, the ids of sealed artifacts it
// stands on. Amending or withdrawing one of those marks every bet whose
// premises name it. A mark is loud and never red — nothing in this bet gives a
// marked bet a way to answer, and a red nobody can clear is the friction-waived
// class this design's own risks name.
//
// What this package never does is decide whether a seal is sound. Whether a
// covered path still hashes to what was sealed is the seal-verify row's
// question, and asking it twice would be two rows able to disagree about one
// repo (D54 ruling 1).
package trace

import (
	"errors"
	"fmt"
	"io"
	"io/fs"
	"os"
	"path"
	"path/filepath"
	"regexp"
	"slices"
	"strings"
	"unicode"

	"github.com/ryannel/groundwork/internal/journal"
	"github.com/ryannel/groundwork/internal/plan"
	"github.com/ryannel/groundwork/internal/seal"
)

// MaxDesignBytes caps a design file this row will read.
//
// It is the manifest's cap rather than the plan reader's 64 KiB, and the reason
// is what the file is: a design doc is prose written for people to read, and
// prose runs longer than a page of frontmatter. This repo's own design is around
// 20 KiB, so the cap sits an order of magnitude above the real thing and far
// below what would hurt.
//
// A file past it is refused with its size named. That is the only honest answer:
// the row cannot say whether an anchor resolves in a file it would not read, and
// saying nothing would let one file switch the check off.
const MaxDesignBytes = 256 * 1024

// Note is one thing this reading found, written so a reader can act on it: the
// id or path it is about, and what was found about it.
type Note struct {
	Value string
	Why   string
}

// Report is what one reading came to.
//
// The three red causes are kept in lists of their own rather than folded into
// one. A count that cannot tell one cause from another is one count too few
// (D52 ruling 3), and each of these three is fixed in a different file.
type Report struct {
	// The three subjects, counted. Each is the denominator of the failures
	// below it.
	Proofs   int
	Facing   int
	Premises int

	// Dangling is every proof whose anchor names no heading in the file it
	// comes from, and every proof whose design file could not be read.
	Dangling []Note

	// Unclaimed is every facing id no slice claims and no deferral records.
	Unclaimed []Note

	// Twice is every facing id claimed more than once. A deferral is a claim
	// too — it is the bet saying it does not deliver the item — so an id both
	// claimed and deferred is two answers to one question and lands here.
	Twice []Note

	// Marked is every bet standing on an artifact the record says was amended
	// or withdrawn. One entry per bet, because a bet is what somebody has to go
	// and re-read.
	Marked []Note

	// The two unsealed states, counted apart because their causes differ: a
	// design file no seal covers, and a premise no seal names. Neither is red
	// in this bet. R4 rules why: there is no key in this environment the agents
	// cannot read, so a blocking rule would either put the key inside their
	// reach or stop every run. Both flip when R4's does.
	UnsealedDesign  []Note
	UnsealedPremise []Note
}

// Sound reports whether anything red is standing. Only the three causes R12
// calls red are: the marks and the unsealed states are loud and never blocking.
func (r Report) Sound() bool {
	return len(r.Dangling)+len(r.Unclaimed)+len(r.Twice) == 0
}

// Check reads the plan set against the repo at root.
//
// The set is handed in rather than loaded here, because a plan that will not
// read is the plan row's red and this reading has nothing to say about it.
//
// The error is for what could not be reached at all: git refusing to answer,
// or a journal line nobody can parse. Everything else is a note on the report.
func Check(root string, set plan.Set) (Report, error) {
	held, err := readSeals(root)
	if err != nil {
		return Report{}, err
	}

	var rep Report

	rep.backward(root, set, held)
	rep.forward(set)
	rep.premises(set, held)

	return rep, nil
}

// backward resolves every proof's anchor inside the file the proof names.
//
// The file is read as it sits in the working tree, which is where the plan
// reader read the plan it is being held against. R15 moves committed-content
// reads onto the seal machinery in a later slice; doing half of that here would
// leave one row reading two repos at once.
func (r *Report) backward(root string, set plan.Set, held seals) {
	anchorsAt := map[string]map[string]bool{}
	unread := map[string]string{}
	visited := map[string]bool{}

	for _, slice := range set.Slices {
		for _, proof := range slice.Proofs {
			where, anchor, found := strings.Cut(proof.From, "#")
			if !found || where == "" || anchor == "" {
				// The plan reader refuses this shape before this ever runs, and
				// the plan row is red on it. There is nothing here to resolve.
				continue
			}

			r.Proofs++

			if !visited[where] {
				visited[where] = true

				got, err := anchorsOf(root, where)
				if err != nil {
					unread[where] = err.Error()
				} else {
					anchorsAt[where] = got
				}

				if !held.covers[where] {
					r.UnsealedDesign = append(r.UnsealedDesign,
						Note{Value: where, Why: "carries no seal in this repo"})
				}
			}

			if why, bad := unread[where]; bad {
				r.Dangling = append(r.Dangling, Note{
					Value: where,
					Why:   fmt.Sprintf("was not read for %s: %s", proof.ID, why),
				})

				continue
			}

			if !anchorsAt[where][anchor] {
				r.Dangling = append(r.Dangling, Note{
					Value: where,
					Why:   fmt.Sprintf("the proof %s names #%s, which no heading makes", proof.ID, anchor),
				})
			}
		}
	}
}

// forward reads each bet's facing list against the slices of that bet.
//
// A slice claims for the bet whose directory it sits in. A slice elsewhere
// naming the same id is a reference the plan row already refuses, and reading
// it as a claim here would let one bet's slice quietly answer for another's.
//
// R12 says one slice's proof, and the slice's facing list is the claiming unit:
// a proof carries no facing field, and the slice is the unit that lands (D61
// ruling 2).
//
// So two claims mean two slices. One slice naming an id twice is refused by the
// plan reader, at load, beside every other doubled declaration (D61 ruling 3) —
// a red naming one slice twice tells a reader nothing.
func (r *Report) forward(set plan.Set) {
	claims := map[string]map[string][]string{}
	for _, slice := range set.Slices {
		dir := path.Dir(slice.Path)
		if claims[dir] == nil {
			claims[dir] = map[string][]string{}
		}
		for _, id := range slice.Facing {
			claims[dir][id] = append(claims[dir][id], slice.ID)
		}
	}

	for _, bet := range set.Bets {
		held := claims[path.Dir(bet.Path)]

		deferred := map[string]bool{}
		for _, one := range bet.Deferred {
			deferred[one.ID] = true
		}

		for _, item := range bet.Facing {
			r.Facing++

			by := held[item.ID]

			switch {
			case len(by) > 1:
				r.Twice = append(r.Twice, Note{
					Value: item.ID,
					Why:   fmt.Sprintf("is claimed by %s and by %s", by[0], by[1]),
				})
			case len(by) == 1 && deferred[item.ID]:
				r.Twice = append(r.Twice, Note{
					Value: item.ID,
					Why:   fmt.Sprintf("is claimed by %s, and the bet defers it", by[0]),
				})
			case len(by) == 0 && !deferred[item.ID]:
				r.Unclaimed = append(r.Unclaimed, Note{
					Value: item.ID,
					Why:   "is claimed by no slice, and the bet does not defer it",
				})
			}
		}
	}
}

// premises reads the record for every artifact a bet stands on.
func (r *Report) premises(set plan.Set, held seals) {
	for _, bet := range set.Bets {
		marked := false

		for _, id := range bet.Premises {
			r.Premises++

			state := held.stateOf(id)

			switch state {
			case noSeal:
				r.UnsealedPremise = append(r.UnsealedPremise,
					Note{Value: id, Why: "has no seal in this repo"})

			case amended, withdrawn:
				// One mark per bet. A bet standing on two moved artifacts is
				// still one bet to go and re-read, and the second artifact
				// changes no verdict — so the first one found is the one named.
				if marked {
					continue
				}

				marked = true

				r.Marked = append(r.Marked, Note{
					Value: bet.ID,
					Why:   fmt.Sprintf("stands on %s, which the record says was %s", id, state),
				})
			}
		}
	}
}

// artifact is what the record holds for one artifact a bet stands on.
type artifact string

const (
	// noSeal: no seal in this repo names it. Loud, never red.
	noSeal artifact = "unsealed"

	// standing: a seal names it and the record says nothing moved it.
	standing artifact = "standing"

	// amended: the record holds a revoked line for it, and a grant after that.
	// The artifact moved, and the bets on it stand on moved ground.
	amended artifact = "amended"

	// withdrawn: the record holds a revoked line and nothing granted after it.
	// That is a seal taken back, and the dying-amend shape lands here too.
	withdrawn artifact = "withdrawn"
)

// seals is what this repo's tags and its record say about its seals.
type seals struct {
	// covers is every path some seal names.
	covers map[string]bool

	// tagsOf is the seal tags each subject id wears, and acts is what the
	// journal says happened to each tag, oldest first.
	tagsOf map[string][]string
	acts   map[string][]string
}

// readSeals reads the repo's seals and the record of what happened to them.
//
// The tags are read through the seal package's own verify rather than by a
// second walk of refs/tags. One reader of what a seal is, in the package that
// owns it (D54 ruling 1).
func readSeals(root string) (seals, error) {
	held := seals{
		covers: map[string]bool{},
		tagsOf: map[string][]string{},
		acts:   map[string][]string{},
	}

	rep, err := seal.Verify(root)
	if err != nil {
		return seals{}, err
	}

	for _, res := range rep.Results {
		for _, one := range res.Covered {
			held.covers[one.Path] = true
		}
		held.claim(res.Tag)
	}

	lines, err := journal.Seals(root)
	if err != nil {
		return seals{}, err
	}

	for _, line := range lines {
		if !held.claim(line.Tag) {
			// A seal line naming something that is not a seal tag. The journal's
			// own writer cannot make one, and a forger who did would be naming a
			// subject nobody can look up.
			//
			// This skip decides no verdict, and saying so is better than
			// implying otherwise. What a premise reads is tagsOf, and claim
			// files only real seal tag names into it. So an action recorded
			// under any other name would never be looked up. Blanking this line
			// changes no answer; it is here to keep the map to seal tag names.
			continue
		}

		held.acts[line.Tag] = append(held.acts[line.Tag], line.Action)
	}

	return held, nil
}

// claim files one tag under the subject it names, and says whether the name is
// a seal tag's at all.
func (s seals) claim(tag string) bool {
	subject, ok := seal.SubjectOf(tag)
	if !ok {
		return false
	}

	// One entry per tag, however many lines the record holds about it. This
	// decides no verdict either — stateOf reads every tag a subject wears and
	// answers the same for a list that repeats one — so blanking it changes no
	// answer. It keeps the list the size of the seals rather than the size of
	// the record.
	if !slices.Contains(s.tagsOf[subject], tag) {
		s.tagsOf[subject] = append(s.tagsOf[subject], tag)
	}

	return true
}

// stateOf says what the record holds for one artifact id.
//
// A subject may wear more than one seal — the kinds are four, and one artifact
// can be sealed under several. Any one of them moving is the artifact moving,
// so the first that moved is the answer.
func (s seals) stateOf(id string) artifact {
	tags := s.tagsOf[id]
	if len(tags) == 0 {
		return noSeal
	}

	for _, tag := range tags {
		acts := s.acts[tag]
		if !slices.Contains(acts, "revoked") {
			continue
		}

		if acts[len(acts)-1] != "granted" {
			return withdrawn
		}

		return amended
	}

	return standing
}

// anchorsOf returns every anchor the file at where makes.
//
// Three things are refused before a byte is read, and what each one guards is
// worth stating plainly, because the guard that was written here first claimed
// more than it did (F94).
//
// The plan reader's checkPath keeps the written path inside the repo: down from
// the root, with no empty, dot or dot-dot element, no drive letter and no
// backslash. What it cannot do is keep the read inside the repo. A committed
// symlink sits at a path that passes every one of those rules and points
// wherever it likes — at /dev/zero, at a file on the machine nobody reviewed.
//
// So two rules answer symlinks, and it took both. The file itself is refused
// when it is one, which is the honesty scan's own rule applied where this row
// reads. And the whole path is resolved and held inside the repo, because a
// symlink at any directory along the way walks the read out of it just as
// surely — the last element is the one a first fix guarded, and F98 is the
// escape that left.
//
// Anything that is not a regular file is refused for a plainer reason: a read of
// a named pipe never returns, and a row that hangs is a battery that hangs.
//
// And the size is capped. Every other reader in this repo caps, and this one
// reads a file any commit can grow: without a cap, one committed file takes the
// whole process down and there is no summary, no journal line and no row.
//
// The cap is one gate, and it sits on the read rather than on the size the file
// claims. A stat can be out of date the moment it returns, and a file can lie
// about its size; what is read is what has to be bounded. The size the file
// claims is used for the number in the message, where being out of date costs a
// reader nothing.
//
// The error keeps the reason and drops the absolute path the operating system
// puts in front of it. A line of evidence is read on a machine that is not the
// one that wrote it, and a directory from that machine says nothing there.
func anchorsOf(root, where string) (map[string]bool, error) {
	at := filepath.Join(root, filepath.FromSlash(where))

	info, err := os.Lstat(at)
	if err != nil {
		return nil, reasonOnly(err)
	}

	switch {
	case info.Mode()&fs.ModeSymlink != 0:
		return nil, errors.New("is a symlink, and a design file is read as a file")
	case !info.Mode().IsRegular():
		return nil, errors.New("is not a regular file")
	}

	if err := inside(root, at); err != nil {
		return nil, err
	}

	file, err := os.Open(at)
	if err != nil {
		return nil, reasonOnly(err)
	}
	defer file.Close()

	raw, err := io.ReadAll(io.LimitReader(file, MaxDesignBytes+1))
	if err != nil {
		return nil, reasonOnly(err)
	}
	if len(raw) > MaxDesignBytes {
		return nil, fmt.Errorf("is %d bytes, over the limit of %d bytes",
			max(info.Size(), int64(len(raw))), MaxDesignBytes)
	}

	return anchorsIn(string(raw)), nil
}

// outsideTheRepo is what a path that leaves the repo comes back as.
//
// It is a constant because the contract page quotes it and a test holds the two
// together. A page describing a refusal in its own words is a page that drifts
// from the refusal, which is the class F94 and F98 both sit in.
const outsideTheRepo = "resolves outside this repo"

// inside says whether the file at a path is one this repo really holds.
//
// Both sides are resolved before they are compared. The path is resolved because
// that is the whole point: every element of it is somebody's committed name, and
// a symlink at any one of them walks the read out of the repo. The root is
// resolved for the opposite reason — a repo sitting under a symlinked home or a
// symlinked temporary directory is an ordinary repo, and comparing a resolved
// path against an unresolved root would refuse to read anything in it.
//
// The message names no path. It is read on a machine that is not the one that
// wrote it, and the directory this file resolved to is that machine's business.
func inside(root, at string) error {
	realRoot, err := filepath.EvalSymlinks(root)
	if err != nil {
		return reasonOnly(err)
	}

	realAt, err := filepath.EvalSymlinks(at)
	if err != nil {
		return reasonOnly(err)
	}

	rel, err := filepath.Rel(realRoot, realAt)
	if err != nil {
		return errors.New(outsideTheRepo)
	}
	if rel == ".." || strings.HasPrefix(rel, ".."+string(filepath.Separator)) {
		return errors.New(outsideTheRepo)
	}

	return nil
}

// reasonOnly strips the operation and the path off a file error, leaving why it
// failed.
func reasonOnly(err error) error {
	var pathErr *fs.PathError
	if errors.As(err, &pathErr) {
		return pathErr.Err
	}

	return err
}

// anchorsIn returns every anchor a markdown document makes.
//
// The rule is the one the renderers use, and the one anybody clicking a heading
// link in a browser gets: lowercase the heading, drop what is not a letter, a
// digit, a dash or an underscore, and turn each space into a dash. Nothing is
// collapsed, so an em dash between two spaces leaves two dashes behind. The
// second heading of one name takes a -1, the third a -2.
//
// A heading is an ATX heading: one to six #s and a space. An underlined heading
// is not read, and the contract page says so — a design file that uses one has
// anchors this cannot resolve, which is a limit worth stating rather than a
// guess worth making.
func anchorsIn(text string) map[string]bool {
	out := map[string]bool{}
	seen := map[string]int{}

	fence := ""

	for _, line := range strings.Split(text, "\n") {
		line = strings.TrimRight(line, " \t\r")

		if mark := fenceMark(line); mark != "" {
			switch {
			case fence == "":
				fence = mark
			case fence == mark:
				fence = ""
			}

			continue
		}
		if fence != "" {
			// A # inside a fenced block is somebody showing markdown, not
			// writing a heading. No renderer makes an anchor for it.
			continue
		}

		heading, ok := headingOf(line)
		if !ok {
			continue
		}

		slug := slugOf(heading)
		if slug == "" {
			continue
		}

		if n := seen[slug]; n > 0 {
			out[fmt.Sprintf("%s-%d", slug, n)] = true
		} else {
			out[slug] = true
		}

		seen[slug]++
	}

	return out
}

// fenceMark returns the run of backticks or tildes a fence line opens with, or
// nothing when the line is not a fence.
func fenceMark(line string) string {
	line = strings.TrimLeft(line, " ")

	for _, mark := range []string{"```", "~~~"} {
		if strings.HasPrefix(line, mark) {
			return mark
		}
	}

	return ""
}

// inlineLink matches a markdown inline link: the text in brackets, then the
// target in parentheses.
var inlineLink = regexp.MustCompile(`\[([^\]]*)\]\(([^)]*)\)`)

// linkText is a heading's text as a renderer shows it, with a link's target
// taken out and its words kept.
//
// A renderer turns [words](somewhere) into a link whose text is the words, and
// the anchor is built from the text — so the target never reaches the slug. Left
// in, a heading citing a URL made an anchor holding half that URL, and no
// reference anybody wrote by clicking the heading would ever match it (F97).
//
// Inline links only, and two limits go with that. A reference-style link and an
// image are not read. And this runs inside a code span too, where a renderer
// would leave the brackets alone — so a heading reading "## The `[a](b)` form"
// slugs one way here and another on GitHub. Both limits fail the same way, as an
// anchor nobody can resolve and a name on the row's line, and the contract page
// states them rather than leaving them to be found.
func linkText(heading string) string {
	return inlineLink.ReplaceAllString(heading, "$1")
}

// headingOf returns the text of an ATX heading, and whether the line is one.
func headingOf(line string) (string, bool) {
	line = strings.TrimLeft(line, " ")

	hashes := 0
	for hashes < len(line) && line[hashes] == '#' {
		hashes++
	}

	const deepest = 6

	if hashes == 0 || hashes > deepest {
		return "", false
	}
	if hashes == len(line) || line[hashes] != ' ' {
		return "", false
	}

	// A closed ATX heading ends in its own run of hashes, and they are
	// decoration rather than text.
	return linkText(strings.TrimSpace(strings.TrimRight(line[hashes:], "# "))), true
}

// slugOf turns one heading's text into the anchor it makes.
func slugOf(heading string) string {
	var b strings.Builder

	for _, r := range strings.ToLower(heading) {
		switch {
		case unicode.IsSpace(r):
			b.WriteRune('-')
		case r == '-' || r == '_':
			b.WriteRune(r)
		case unicode.IsLetter(r) || unicode.IsDigit(r):
			b.WriteRune(r)
		}
	}

	return b.String()
}
