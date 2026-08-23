package battery

import (
	"bytes"
	"crypto/rand"
	"encoding/hex"
	"encoding/json"
	"errors"
	"fmt"
	"io/fs"
	"os"
	"path/filepath"
	"strings"
	"time"
	"unicode"
	"unicode/utf8"

	"github.com/ryannel/groundwork/internal/journal"
)

// A waiver is a person's claim that a check is wrong. D24 rules its shape: one
// committed file per waiver under .groundwork/waivers, its own commit touching
// only waiver files, an expiry at most thirty days out, and a journal line when
// it is granted and when it is used.
//
// Three rules hold the whole mechanism up.
//
// A waiver never turns a row green. Waived is its own outcome, counted on its
// own and printed on its own, so a waived row can never be read as a row that
// passed.
//
// A waiver that cannot stand waives nothing. An expired one, one that outran
// the thirty days, one nobody committed, one that rode in with a feature diff:
// every one of them leaves the row exactly as the check found it, and gets a
// line saying it was ignored. That direction is the safe one — the row stays
// red — and it is the one D24 asks for.
//
// The authority is the commit whose content governs, which is the most recent
// commit that changed the file — not the one that created it (D38). A waiver
// born honestly and rewritten inside a feature diff is a hijacked waiver, and
// the birth commit says nothing about what the file holds now. A rewrite in a
// commit of its own is a re-grant, and D24's letter allows it.
//
// Nothing in the waiver directory is read past in silence, and nothing in it
// blanks the report either (D38). A file the run cannot read as a waiver is
// named in the run's own notes and fails the run; every row still runs, and
// the table and the journal still render. D17's rule is what this is: a
// verifier may never pass on nothing.
//
// Committed content is attacker-controlled content. A reason or a file name
// holding a control character could forge a row in the printed table. So both
// are held to printable characters, refused at the grant and refused again at
// the run. Nothing a run says about a waiver is echoed unrendered either.

// WaiverDir is where committed waivers live, named from the repo root.
const WaiverDir = ".groundwork/waivers"

// waiverDate is how a waiver writes a date. Dates, not instants: a waiver is
// granted and expires on a day, and a person writes days.
const waiverDate = "2006-01-02"

// waiverDays is the furthest a waiver's expiry may sit from its grant. D24
// fixes it at thirty.
const waiverDays = 30

// waiverSchema is the version this build writes and reads.
const waiverSchema = 1

// maxWaiverReasonBytes caps a waiver's reason. The reason is printed on the waived
// row's own line, which the journal caps, so the cap here is what makes that
// line fit by arithmetic rather than by luck.
const maxWaiverReasonBytes = 100

// maxWaiverBytes caps a waiver file. A waiver is one short object, and a file
// far bigger than that is not one — so it is refused on its size, before
// anything reads a megabyte of somebody's guess into memory.
const maxWaiverBytes = 8 << 10

// maxWaiverNameBytes caps a waiver file's name, for the same reason: the name
// goes on the row's line too. A granted name is about sixty bytes.
const maxWaiverNameBytes = 64

// waiverStamp dates a granted waiver's file name.
const waiverStamp = "20060102"

// waiverIDBytes is how many random bytes a granted file name carries, printed
// as hex. Two waivers of one row on one day must not collide, and two branches
// must not collide either.
const waiverIDBytes = 2

// What a run did with one waiver.
const (
	// WaiverUsed: the waiver stood, and a red row was waived by it.
	WaiverUsed = "used"

	// WaiverIgnored: the waiver could not stand, so it waived nothing.
	WaiverIgnored = "ignored"

	// WaiverUnused: the waiver stands, and the row it names was not red.
	WaiverUnused = "unused"

	// WaiverUnreadable: the file is not a waiver this tool can read, so it
	// names no row at all. It fails the run on its own.
	WaiverUnreadable = "unreadable"
)

// WaiverNote is what one waiver file did in one run.
type WaiverNote struct {
	// File is the waiver, named from the repo root.
	File string

	// Row is the row it names.
	Row string

	// Reason and Expires are the waiver's own words, when they could be read.
	// An ignored waiver may have neither.
	Reason  string
	Expires string

	// Status is one of WaiverUsed, WaiverIgnored, WaiverUnused or
	// WaiverUnreadable.
	Status string

	// Why says why the status is what it is.
	Why string
}

// waiverFile is the shape of a committed waiver file.
type waiverFile struct {
	V       int    `json:"v"`
	Row     string `json:"row"`
	Reason  string `json:"reason"`
	Granted string `json:"granted"`
	Expires string `json:"expires"`
}

// waiverEntry is one thing found in the waiver directory, in the order the
// directory gave it.
//
// A file that read as a waiver naming a row carries its body, and whether it
// stands is a separate question. A file that did not carries why instead, and
// there is nothing further to ask of it.
type waiverEntry struct {
	// file is the path from the repo root, and name is its last part. Both are
	// as the directory gave them, because git is asked about this file by the
	// name it really has. Rendering for a person to read happens at the note,
	// which is the only place the name is printed.
	file string
	name string

	body waiverFile
	why  string
}

// readable reports whether the entry read as a waiver naming a row.
func (e waiverEntry) readable() bool {
	return e.why == ""
}

// waiverSet is what one run knows about the repo's waivers: a note per file,
// and where to find the one that stands over each row.
type waiverSet struct {
	notes []WaiverNote
	live  map[string]int
}

// Grant writes one waiver file and records the grant in the journal. It
// returns the new file's path, from the repo root.
//
// It never commits. The commit is the person's own act, and the git
// attribution it carries is the whole authority of a waiver this bet — so the
// caller is told to make that commit, and to put nothing else in it.
func Grant(repoDir, rowID, reason, expires string) (string, error) {
	root, err := journal.RepoRoot(repoDir)
	if err != nil {
		return "", err
	}

	if !Default().holds(rowID) {
		return "", fmt.Errorf("no row in this battery has the id %q", rowID)
	}
	if err := checkReason(reason); err != nil {
		return "", fmt.Errorf("the %w", err)
	}

	today := onlyDate(time.Now().UTC())

	if expires == "" {
		return "", errors.New("a waiver needs an expiry date, at most 30 days out")
	}
	last, err := time.Parse(waiverDate, expires)
	if err != nil {
		return "", fmt.Errorf("the expiry %q is not a date of the form YYYY-MM-DD", short(expires))
	}
	if last.Before(today) {
		return "", fmt.Errorf("the expiry %s is in the past", expires)
	}
	if last.After(today.AddDate(0, 0, waiverDays)) {
		return "", fmt.Errorf("the expiry %s is more than %d days out", expires, waiverDays)
	}

	if err := noLiveWaiverYet(root, rowID, today); err != nil {
		return "", err
	}

	path, err := writeWaiver(root, waiverFile{
		V:       waiverSchema,
		Row:     rowID,
		Reason:  reason,
		Granted: today.Format(waiverDate),
		Expires: expires,
	})
	if err != nil {
		return "", err
	}

	_, err = journal.WriteWaiver(repoDir, journal.Waiver{
		Action:  "granted",
		Row:     rowID,
		File:    path,
		Reason:  reason,
		Expires: expires,
	})
	if err != nil {
		// A waiver is the file and the lines together. A file nobody can find
		// a grant for is worse than no waiver at all, so the file goes with
		// the failed line.
		if removeErr := os.Remove(filepath.Join(root, filepath.FromSlash(path))); removeErr != nil {
			return "", fmt.Errorf("could not journal the grant: %w, and the waiver file was left behind: %w",
				err, removeErr)
		}

		return "", fmt.Errorf("could not journal the grant, so no waiver was written: %w", err)
	}

	return path, nil
}

// holds reports whether the registry holds a row with this id.
func (r *Registry) holds(id string) bool {
	return r.seen[id]
}

// checkReason rejects a reason a waived row's line could not carry, or could
// not carry safely.
//
// The words read as a fragment — "reason is ..." — because both callers put
// them after a subject: the grant says "the reason ...", and a run's note says
// "its reason ...".
func checkReason(reason string) error {
	if reason == "" {
		return errors.New("reason is empty, and a waiver is a claim somebody has to stand behind")
	}
	if len(reason) > maxWaiverReasonBytes {
		return fmt.Errorf("reason is %d bytes, over the limit of %d", len(reason), maxWaiverReasonBytes)
	}
	if reason != printable(reason) {
		return errors.New("reason holds a control character, which would forge a row in the printed table")
	}

	return nil
}

// noLiveWaiverYet refuses a second live waiver for one row. Two of them refuse
// each other at the next run, and a grant that walked into that would be
// handing the person a waiver that cannot work.
func noLiveWaiverYet(root, rowID string, today time.Time) error {
	parsed, err := readWaivers(root)
	if err != nil {
		return err
	}

	for _, e := range parsed {
		// A file that is not a waiver names no row, so it can be nobody's
		// duplicate. The run says what is wrong with it.
		if !e.readable() || e.body.Row != rowID {
			continue
		}

		last, err := time.Parse(waiverDate, e.body.Expires)
		if err != nil || today.After(last) {
			continue
		}

		return fmt.Errorf("the row %q is already waived by %s, until %s", rowID, e.name, e.body.Expires)
	}

	return nil
}

// writeWaiver puts one waiver file in the waiver directory and returns its
// path from the repo root.
func writeWaiver(root string, body waiverFile) (string, error) {
	raw := make([]byte, waiverIDBytes)
	if _, err := rand.Read(raw); err != nil {
		return "", fmt.Errorf("generate a waiver name: %w", err)
	}

	granted, err := time.Parse(waiverDate, body.Granted)
	if err != nil {
		return "", fmt.Errorf("the grant date %q is not a date", short(body.Granted))
	}

	name := fmt.Sprintf("%s-%s-%s.json", body.Row, granted.Format(waiverStamp), hex.EncodeToString(raw))
	path := WaiverDir + "/" + name
	full := filepath.Join(root, filepath.FromSlash(path))

	if err := os.MkdirAll(filepath.Dir(full), 0o750); err != nil {
		return "", fmt.Errorf("could not make %s: %w", WaiverDir, reasonOnly(err))
	}

	line, err := json.Marshal(body)
	if err != nil {
		return "", fmt.Errorf("build the waiver: %w", err)
	}
	line = append(line, '\n')

	// O_EXCL, so a name that somehow already exists is never written over. A
	// waiver is a record, and a record that replaced another silently would be
	// the tampering waivers exist to replace.
	file, err := os.OpenFile(full, os.O_WRONLY|os.O_CREATE|os.O_EXCL, 0o600)
	if err != nil {
		return "", fmt.Errorf("could not write %s: %w", path, reasonOnly(err))
	}
	if _, err := file.Write(line); err != nil {
		file.Close()

		return "", fmt.Errorf("could not write %s: %w", path, reasonOnly(err))
	}
	if err := file.Close(); err != nil {
		return "", fmt.Errorf("could not write %s: %w", path, reasonOnly(err))
	}

	return path, nil
}

// loadWaivers reads the repo's waivers and judges each one against the rows
// this run holds.
//
// Every entry in the directory comes back as a note, in directory order. The
// ones that stand come back live as well, keyed by the row they waive.
func loadWaivers(repoDir string, reg *Registry, now time.Time) (waiverSet, error) {
	set := waiverSet{live: map[string]int{}}

	root, err := journal.RepoRoot(repoDir)
	if err != nil {
		return set, err
	}

	entries, err := readWaivers(root)
	if err != nil {
		return set, err
	}
	if len(entries) == 0 {
		return set, nil
	}

	j, err := newWaiverJudge(root, reg, now)
	if err != nil {
		return set, err
	}

	// Two passes. The first asks of each waiver on its own whether it stands.
	// The second asks whether two of them stand over one row, which is a
	// question no single waiver can answer.
	for _, e := range entries {
		note := WaiverNote{File: say(e.file), Status: WaiverUnreadable, Why: say(e.why)}
		if e.readable() {
			why, err := j.refuse(e)
			if err != nil {
				return waiverSet{live: map[string]int{}}, err
			}

			note.Row = e.body.Row
			note.Status, note.Why = WaiverUnused, ""
			if e.body.Reason != "" && checkReason(e.body.Reason) == nil {
				note.Reason = e.body.Reason
			}
			if _, err := time.Parse(waiverDate, e.body.Expires); err == nil {
				note.Expires = e.body.Expires
			}
			if why != "" {
				note.Status, note.Why = WaiverIgnored, say(why)
			}
		}

		set.notes = append(set.notes, note)
	}

	refuseDuplicates(&set)

	for i, note := range set.notes {
		if note.Status == WaiverUnused {
			set.live[note.Row] = i
			set.notes[i].Why = fmt.Sprintf("it stands, and the row %s did not go red", note.Row)
		}
	}

	return set, nil
}

// refuseDuplicates turns down every waiver of a row that two waivers stand
// over. Two live waivers are a record that disagrees with itself about why a
// row is waived, and picking one of them would be the tool choosing which
// claim the person meant.
func refuseDuplicates(set *waiverSet) {
	byRow := map[string][]int{}
	for i, note := range set.notes {
		if note.Status == WaiverUnused {
			byRow[note.Row] = append(byRow[note.Row], i)
		}
	}

	for row, found := range byRow {
		if len(found) < 2 {
			continue
		}

		names := make([]string, len(found))
		for n, i := range found {
			names[n] = set.notes[i].File
		}

		why := say(fmt.Sprintf("%d waivers stand over the row %s at once: %s",
			len(found), row, strings.Join(names, ", ")))
		for _, i := range found {
			set.notes[i].Status, set.notes[i].Why = WaiverIgnored, why
		}
	}
}

// waiverJudge holds what every waiver is judged against: the rows this run
// holds, what git says about the waiver directory, and today's date.
type waiverJudge struct {
	root    string
	rows    map[string]bool
	tracked map[string]bool
	changed map[string]string
	today   time.Time
}

// newWaiverJudge asks git its two questions about the whole directory at once,
// rather than once per waiver.
func newWaiverJudge(root string, reg *Registry, now time.Time) (waiverJudge, error) {
	j := waiverJudge{
		root:    root,
		rows:    map[string]bool{},
		tracked: map[string]bool{},
		today:   onlyDate(now),
	}

	for _, row := range reg.Rows() {
		j.rows[row.ID] = true
	}

	tracked, err := journal.TrackedFiles(root, WaiverDir)
	if err != nil {
		return waiverJudge{}, err
	}
	for _, path := range tracked {
		j.tracked[path] = true
	}

	j.changed, err = journal.ChangedFiles(root, WaiverDir)
	if err != nil {
		return waiverJudge{}, err
	}

	return j, nil
}

// refuse returns why a waiver does not stand, or an empty string when it does.
// The error it can return is git's, not the waiver's.
func (j waiverJudge) refuse(e waiverEntry) (string, error) {
	why, last := j.refuseOnItsFace(e)
	if why != "" {
		return why, nil
	}

	return j.refuseOnItsHistory(e, last)
}

// refuseOnItsFace judges a waiver by what it says about itself. It hands back
// the expiry it read, so the caller does not parse the same field twice.
func (j waiverJudge) refuseOnItsFace(e waiverEntry) (string, time.Time) {
	if err := checkReason(e.body.Reason); err != nil {
		return "its " + err.Error(), time.Time{}
	}

	granted, err := time.Parse(waiverDate, e.body.Granted)
	if err != nil {
		return fmt.Sprintf("its granted field is not a date of the form YYYY-MM-DD: %q",
			short(e.body.Granted)), time.Time{}
	}
	last, err := time.Parse(waiverDate, e.body.Expires)
	if err != nil {
		return fmt.Sprintf("its expires field is not a date of the form YYYY-MM-DD: %q",
			short(e.body.Expires)), time.Time{}
	}

	if last.Before(granted) {
		return fmt.Sprintf("it expires on %s, before the %s it was granted on",
			e.body.Expires, e.body.Granted), last
	}
	if last.After(granted.AddDate(0, 0, waiverDays)) {
		return fmt.Sprintf("it expires on %s, more than %d days after the %s it was granted on",
			e.body.Expires, waiverDays, e.body.Granted), last
	}
	if granted.After(j.today) {
		return fmt.Sprintf("it was granted on %s, which is in the future", e.body.Granted), last
	}
	if !j.rows[e.body.Row] {
		return fmt.Sprintf("no row in this battery has the id %q", e.body.Row), last
	}

	return "", last
}

// refuseOnItsHistory judges a waiver by what git says about it: that it was
// committed, that it has not been touched since, and that the commit whose
// content governs it touched nothing but waivers.
//
// That governing commit is the most recent one to change the file (D38). A
// waiver's birth says nothing about what the file holds now, and the review
// that forced this rule proved it with an ordinary feature commit.
func (j waiverJudge) refuseOnItsHistory(e waiverEntry, last time.Time) (string, error) {
	if !j.tracked[e.file] {
		return "it is not committed, so nothing attributes it to anybody", nil
	}
	if code, held := j.changed[e.file]; held {
		// Staged is not committed. git tracks a staged file, so the plain
		// "tracked" question above says yes about one, and a waiver waiting in
		// the index carries no more attribution than one nobody added at all.
		if strings.HasPrefix(code, "A") {
			return "it is staged but not committed, so nothing attributes it to anybody", nil
		}

		return "it changed since it was committed, so the committed waiver is not the one on disk", nil
	}

	commit, err := journal.LastChanged(j.root, e.file)
	if err != nil {
		return "", err
	}
	if commit == "" {
		return j.sayNoHistory("no commit in this clone changes it")
	}

	parents, err := journal.ParentsOf(j.root, commit)
	if err != nil {
		return "", err
	}

	// A commit with no parents is either this repo's first commit or the edge
	// of a shallow clone. At the edge the whole tree hangs off one grafted
	// commit, so its diff is not what anybody committed, and blaming the
	// waiver for touching every file in the repo would be a false statement.
	if len(parents) == 0 {
		why, err := j.sayNoHistory(fmt.Sprintf(
			"the commit that governs it, %s, sits at the edge of this clone", commit[:7]))
		if err != nil || why != "" {
			return why, err
		}
	}

	// D40: a merge is not a granting act, so a merge never governs a waiver.
	// A merge that changed the file is a person editing it where two branches
	// met, which is the feature-diff hijack wearing a merge's clothes — and an
	// evil merge, changing a file neither side changed, is exactly that.
	//
	// This is refused on the shape of the commit rather than on its diff. A
	// merge's diff depends on which parent it is read against, so "what this
	// commit touched" has no one answer for a merge, and a rule resting on one
	// would be resting on a choice nobody made. The way through is a re-grant
	// in a commit of its own on the merged branch.
	if len(parents) > 1 {
		return fmt.Sprintf(
			"the commit that governs it, %s, is a merge: a merge is not a granting act, so re-grant it in a commit of its own",
			commit[:7]), nil
	}

	strays, err := j.straysIn(commit)
	if err != nil {
		return "", err
	}
	if len(strays) > 0 {
		return fmt.Sprintf("the commit that governs it, %s, also touched %s: a waiver lands in a commit of its own",
			commit[:7], strings.Join(strays, ", ")), nil
	}

	// Expiry is judged last, because every other fault is a fault whether the
	// waiver has run out or not, and the reader would rather hear that one.
	if j.today.After(last) {
		return fmt.Sprintf("it expired on %s", e.body.Expires), nil
	}

	return "", nil
}

// sayNoHistory turns a missing piece of history into a sentence, saying so
// plainly when the clone is the reason it is missing. A shallow clone is the
// usual reason, and the fix is a full fetch rather than a new waiver.
//
// It returns an empty string when the history is all here and the caller can
// carry on: only a shallow clone makes a parentless commit untrustworthy.
func (j waiverJudge) sayNoHistory(what string) (string, error) {
	shallow, err := journal.Shallow(j.root)
	if err != nil {
		return "", err
	}
	if shallow {
		return what + ", which is shallow: fetch the full history to judge this waiver", nil
	}
	if strings.HasPrefix(what, "no commit") {
		return what, nil
	}

	return "", nil
}

// straysIn names the files in a commit that are not waivers. It names at most
// three: the line has a cap, and the reader only needs to know the commit was
// not a waiver commit.
func (j waiverJudge) straysIn(commit string) ([]string, error) {
	files, err := journal.FilesIn(j.root, commit)
	if err != nil {
		return nil, err
	}

	const most = 3

	var strays []string
	for _, path := range files {
		if strings.HasPrefix(path, WaiverDir+"/") {
			continue
		}

		strays = append(strays, path)
		if len(strays) == most {
			break
		}
	}

	return strays, nil
}

// readWaivers reads every entry in the waiver directory, in the order the
// directory gives them.
//
// An entry it cannot read as a waiver comes back carrying why, not as an
// error: D38 rules that a file that is not a waiver must not blank the report.
// It fails the run, loudly, with every row still on the table. The one error
// here is a directory the tool cannot list at all, which is not a fact about
// any one file. No directory, and an empty one, both mean the same honest
// thing: this repo waives nothing.
func readWaivers(root string) ([]waiverEntry, error) {
	dir := filepath.Join(root, filepath.FromSlash(WaiverDir))

	entries, err := os.ReadDir(dir)
	if errors.Is(err, fs.ErrNotExist) {
		return nil, nil
	}
	if err != nil {
		return nil, fmt.Errorf("could not read %s: %w", WaiverDir, reasonOnly(err))
	}

	var found []waiverEntry
	for _, entry := range entries {
		name := entry.Name()
		here := waiverEntry{file: WaiverDir + "/" + name, name: name}

		switch {
		case !entry.Type().IsRegular():
			here.why = "it is not a file, and this directory holds waiver files only"
		case !strings.HasSuffix(name, ".json"):
			here.why = "it is not a .json file, and this directory holds waiver files only"
		case len(name) > maxWaiverNameBytes:
			here.why = fmt.Sprintf("its name is %d bytes, over the limit of %d",
				len(name), maxWaiverNameBytes)
		case name != printable(name):
			here.why = "its name holds a control character, which would forge a row in this table"
		default:
			body, err := readWaiver(filepath.Join(dir, name))
			if err != nil {
				here.why = err.Error()
			}
			here.body = body
		}

		found = append(found, here)
	}

	return found, nil
}

// readWaiver reads one waiver file into its fields.
//
// It is as strict as the lock file's reader, and for the same reason: the file
// is written by hand and committed, so every shape a hand can produce is
// refused plainly rather than believed.
func readWaiver(path string) (waiverFile, error) {
	raw, err := os.ReadFile(path)
	if err != nil {
		return waiverFile{}, fmt.Errorf("could not read it: %w", reasonOnly(err))
	}
	if len(raw) > maxWaiverBytes {
		return waiverFile{}, fmt.Errorf("it is %d bytes, over the limit of %d: a waiver is one short object",
			len(raw), maxWaiverBytes)
	}

	dec := json.NewDecoder(bytes.NewReader(raw))
	dec.DisallowUnknownFields()

	var body waiverFile
	if err := dec.Decode(&body); err != nil {
		return waiverFile{}, fmt.Errorf("it is not one JSON object holding v, row, reason, granted and expires: %w", err)
	}
	if dec.More() {
		return waiverFile{}, errors.New("it holds more than one thing: a waiver is one JSON object and nothing after it")
	}

	if body.V != waiverSchema {
		return waiverFile{}, fmt.Errorf("it declares the schema version %d, and this build reads version %d",
			body.V, waiverSchema)
	}
	if err := checkRowID(body.Row); err != nil {
		return waiverFile{}, fmt.Errorf("it names a row this tool cannot read: %w", err)
	}

	return body, nil
}

// useWaiver applies the waiver that stands over a red row, if one does. It
// returns the line the waived row records, or an empty string when no waiver
// stands.
//
// The row's own red words go on the waiver's journal line. They are the check's
// verdict, and a waiver sets a verdict aside rather than erasing it.
func useWaiver(repoDir, runID, rowID string, red Result, set *waiverSet) (string, error) {
	i, held := set.live[rowID]
	if !held {
		return "", nil
	}

	note := &set.notes[i]
	note.Status = WaiverUsed
	note.Why = "it stands, and this row went red"

	evidence := waivedEvidence(*note)

	_, err := journal.WriteWaiver(repoDir, journal.Waiver{
		Action:   WaiverUsed,
		Row:      note.Row,
		File:     note.File,
		Reason:   note.Reason,
		Expires:  note.Expires,
		RunID:    runID,
		Evidence: red.Evidence,
	})
	if err != nil {
		return "", fmt.Errorf("could not journal the waiver %s: %w", note.File, err)
	}

	return evidence, nil
}

// journalIgnoredWaivers records every waiver the run refused, before any row
// runs. A waiver that waived nothing is still something that happened, and the
// journal is where the repeat-waiver counting D24 asks for will read from.
//
// A file that is not a waiver goes on the record too, and it names no row: it
// could not say which row it meant, and a made-up one would be worse than
// none.
func journalIgnoredWaivers(repoDir, runID string, set waiverSet) error {
	for _, note := range set.notes {
		if note.Status != WaiverIgnored && note.Status != WaiverUnreadable {
			continue
		}

		_, err := journal.WriteWaiver(repoDir, journal.Waiver{
			Action:   WaiverIgnored,
			Row:      note.Row,
			File:     note.File,
			Reason:   note.Reason,
			Expires:  note.Expires,
			RunID:    runID,
			Evidence: note.Why,
		})
		if err != nil {
			return fmt.Errorf("could not journal the refused waiver %s: %w", note.File, err)
		}
	}

	return nil
}

// waivedEvidence is the line a waived row records.
//
// It replaces the row's own words on that line, and the row's words go on the
// waiver's journal line instead. What a reader of a waived row needs first is
// which waiver waived it and when that runs out.
//
// The file's name is used rather than its whole path, so the line fits the
// journal's cap by arithmetic: the caps on a waiver's name and reason are what
// make that true, and a test does the sum.
func waivedEvidence(note WaiverNote) string {
	return fmt.Sprintf("waived by %s until %s: %s", filepath.Base(note.File), note.Expires, note.Reason)
}

// printable renders somebody else's text safe to print on a line of a table.
//
// Every character that is not printable becomes a space. A newline in a reason
// or a file name would otherwise draw a row of its own, and a run that prints
// a forged row is worse than one that prints nothing. A space rather than
// nothing, so two words never run together into a third.
//
// This is the rendering half of D38 ruling 4. The refusing half is in
// checkReason and readWaivers: a waiver holding one of these never stands.
func printable(text string) string {
	return strings.Map(func(r rune) rune {
		if unicode.IsPrint(r) {
			return r
		}

		return ' '
	}, strings.ToValidUTF8(text, ""))
}

// say renders a sentence a run makes about a waiver: printable, and short
// enough for the journal to hold.
func say(sentence string) string {
	return cut(printable(sentence))
}

// onlyDate cuts a moment down to the UTC day it falls on. A waiver is granted
// and expires on a day, so every comparison is between days.
func onlyDate(t time.Time) time.Time {
	t = t.UTC()

	return time.Date(t.Year(), t.Month(), t.Day(), 0, 0, 0, 0, time.UTC)
}

// short cuts a value read from a file down to something an error can carry.
func short(value string) string {
	const most = 40

	value = strings.ToValidUTF8(value, "")
	if len(value) <= most {
		return value
	}

	// Only a partial rune can be invalid here, so this backs off at most three
	// bytes.
	kept := value[:most]
	for len(kept) > 0 && !utf8.ValidString(kept) {
		kept = kept[:len(kept)-1]
	}

	return kept + "..."
}
