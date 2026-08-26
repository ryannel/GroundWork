package seal

import (
	"errors"
	"fmt"

	"github.com/ryannel/groundwork/internal/journal"
)

// ErrNoSeal says a seal that was asked for is not in this repo. R4 calls that
// state missing, and missing is red: a seal nobody can find proves nothing.
var ErrNoSeal = errors.New("this repo holds no such seal")

// Signature is what a seal's signature came to.
type Signature string

// The signature states. Only Verified is human authority. R4 names verified,
// unsigned and missing; Unverified is the fourth shape a real tag can take, and
// it is kept apart from Unsigned because a signature that does not check out is
// a different thing from no signature at all. Neither is authority, and neither
// is red in this bet.
const (
	// Verified: a good signature by a key the committed allowed-signers file
	// lists. This is the only state that is anybody's authority.
	Verified Signature = "verified"

	// Unsigned: the tag carries no signature. Every seal this tool grants is
	// unsigned, because it holds no key.
	Unsigned Signature = "unsigned"

	// Unverified: the tag carries a signature, and it did not check out — a bad
	// signature, a key nobody listed, or a machine with no verifier on it.
	Unverified Signature = "unverified"
)

// PathState is what became of one covered path.
type PathState string

// The three things a covered path can be at HEAD.
const (
	// Held: the path is there, and its blob hash is the one the seal named.
	Held PathState = "held"

	// Moved: the path is there, and it hashes to something else.
	Moved PathState = "moved"

	// Gone: HEAD holds no file at that path. It is the loudest kind of moved,
	// never "nothing to compare".
	Gone PathState = "gone"
)

// PathResult is one covered path, checked at HEAD.
type PathResult struct {
	Path   string
	Sealed string
	Now    string
	State  PathState
}

// Result is one seal, checked.
type Result struct {
	Tag     string
	Kind    string
	Subject string

	// Target is the commit the tag names.
	Target string

	Signature     Signature
	Signer        string
	SignatureNote string

	Covered []PathResult

	// Battery and BatteryRun are the tag's own trailers.
	Battery    string
	BatteryRun string

	// JournalBattery and JournalBatteryRun are what the journal's seal line
	// says about the same tag. They are empty when no line backs it.
	JournalBattery    string
	JournalBatteryRun string

	// BatteryNote says why the cross-check did not run, when it did not.
	BatteryNote string

	// Problems is every reason this seal is red, in reading order.
	Problems []string
}

// Sound reports whether this seal has nothing wrong with it. An unsigned seal
// is sound: in this bet unsigned is loud, not blocking (R4).
func (r Result) Sound() bool {
	return len(r.Problems) == 0
}

// Authority reports whether this seal is a person's sign-off. Only a good
// signature by a listed key is, and nothing else in this tool may read as one.
func (r Result) Authority() bool {
	return r.Signature == Verified
}

// MovedPaths returns the covered paths that no longer match what was sealed.
func (r Result) MovedPaths() []PathResult {
	var moved []PathResult
	for _, one := range r.Covered {
		if one.State != Held {
			moved = append(moved, one)
		}
	}

	return moved
}

// Report is every seal in one repo, checked.
type Report struct {
	Results []Result

	// The counts a reader needs first. D33: words give way, counts never do.
	Seals int
	Paths int
	Moved int

	// Unsigned is the seals carrying no signature at all. Unverified is the
	// seals carrying one that did not check out. They are counted apart, and
	// there is no field holding the two added together — D52.3, because the
	// field that did hold that is what let a forged block print as unsigned.
	Unsigned   int
	Unverified int

	Problems int
}

// NoAuthority is how many seals are nobody's word: everything that is not
// verified. It is a sum a caller asks for, never a count kept beside the two it
// is made of.
func (r Report) NoAuthority() int {
	return r.Unsigned + r.Unverified
}

// FirstProblem returns the first problem any seal reported, in the order the
// seals were read. It is empty when there is none.
func (r Report) FirstProblem() string {
	for _, res := range r.Results {
		if len(res.Problems) > 0 {
			return res.Problems[0]
		}
	}

	return ""
}

// Verify checks every seal in the repo at repoDir.
//
// It recomputes each covered path's blob hash at HEAD and names every path that
// moved. It also holds each tag's battery trailers against the journal's own
// seal line for that tag, which is the check D23 asked a later bet for.
//
// A repo that holds no seal tag comes back empty. It states no seal, so it can
// misstate none.
func Verify(repoDir string) (Report, error) {
	dir, err := root(repoDir)
	if err != nil {
		return Report{}, err
	}

	tags, err := sealTags(dir)
	if err != nil {
		return Report{}, err
	}

	rep := Report{}
	if len(tags) == 0 {
		return rep, nil
	}

	lines, err := journal.Seals(dir)
	if err != nil {
		return Report{}, err
	}

	keys, put, err := openSigners(dir)
	if err != nil {
		return Report{}, err
	}
	defer put()

	for _, tag := range tags {
		res := checkOne(dir, tag, keys, lines)

		rep.Results = append(rep.Results, res)
		rep.Seals++
		rep.Paths += len(res.Covered)
		rep.Moved += len(res.MovedPaths())
		rep.Problems += len(res.Problems)

		switch res.Signature {
		case Unsigned:
			rep.Unsigned++
		case Unverified:
			rep.Unverified++
		}
	}

	return rep, nil
}

// VerifyTag checks one seal by tag name.
//
// A tag that is not there comes back as ErrNoSeal. That is R4's missing state,
// and it is the one signature state that is red.
func VerifyTag(repoDir, tag string) (Result, error) {
	dir, err := root(repoDir)
	if err != nil {
		return Result{}, err
	}

	at, err := resolve(dir, "refs/tags/"+tag)
	if err != nil {
		return Result{}, err
	}
	if at == "" {
		return Result{}, fmt.Errorf("%w: %s is missing", ErrNoSeal, clip(tag))
	}

	lines, err := journal.Seals(dir)
	if err != nil {
		return Result{}, err
	}

	keys, put, err := openSigners(dir)
	if err != nil {
		return Result{}, err
	}
	defer put()

	return checkOne(dir, tag, keys, lines), nil
}

// checkOne checks one seal tag from end to end.
//
// It never returns an error. Everything that can be wrong with a seal is a
// problem on the record rather than a stop: a tag that cannot be read is
// exactly what somebody scribbling on a seal produces, and stopping there would
// hide the other seals.
func checkOne(dir, tag string, keys signers, lines []journal.SealLine) Result {
	res := Result{Tag: tag}

	target, err := resolve(dir, "refs/tags/"+tag+"^{commit}")
	if err == nil {
		res.Target = target
	}

	raw, err := rawTag(dir, tag)
	if err != nil {
		res.Signature = Unsigned
		res.SignatureNote = "this tag could not be read, so it carries no signature anybody can check"
		res.Problems = append(res.Problems, err.Error())

		return res
	}

	message, signature := splitTag(raw)
	res.Signature, res.Signer, res.SignatureNote = checkSignature(dir, tag, signature, keys)

	m, err := ParseMessage(message)
	if err != nil {
		res.Problems = append(res.Problems, fmt.Sprintf("%s: %s", clip(tag), err.Error()))

		return res
	}

	res.Kind, res.Subject = m.Kind, m.Subject
	res.Battery, res.BatteryRun = m.Battery, m.BatteryRun

	// The name and the message have to agree. A seal whose message names some
	// other subject would answer for work it does not sit on.
	if named, err := TagName(m.Kind, m.Subject); err != nil || named != tag {
		res.Problems = append(res.Problems, fmt.Sprintf(
			"the tag %s carries the name %s in its message, and the two must be one name",
			clip(tag), clip(tagPrefix+m.Kind+"/"+m.Subject)))
	}

	res.Covered, res.Problems = checkPaths(dir, tag, m.Covered, res.Problems)
	res.Problems = checkBattery(&res, tag, lines)

	return res
}

// checkPaths recomputes every covered path's blob hash at HEAD.
func checkPaths(dir, tag string, covered []Covered, problems []string) ([]PathResult, []string) {
	paths := make([]string, 0, len(covered))
	for _, one := range covered {
		paths = append(paths, one.Path)
	}

	at, err := blobsAt(dir, "HEAD", paths)
	if err != nil {
		return nil, append(problems, err.Error())
	}

	results := make([]PathResult, 0, len(covered))
	for _, one := range covered {
		now, held := at[one.Path]

		state := Held
		switch {
		case !held:
			state = Gone
		case now != one.Blob:
			state = Moved
		}

		results = append(results, PathResult{
			Path: one.Path, Sealed: one.Blob, Now: now, State: state,
		})

		switch state {
		// The line names the path and the seal, and not the two hashes. A
		// reader acts on which path moved under which seal; the hashes are on
		// the result for whoever wants to see them, and two of them would spend
		// the whole line.
		case Gone:
			problems = append(problems, fmt.Sprintf("%s is gone at HEAD, and %s seals it",
				clip(one.Path), clip(tag)))
		case Moved:
			problems = append(problems, fmt.Sprintf("%s moved under %s", clip(one.Path), clip(tag)))
		}
	}

	return results, problems
}

// checkBattery holds the tag's trailers against the journal's seal line for the
// same tag. D23 asked a later bet for this check, and this is it.
//
// No line behind the tag is not a fault. A seal restored into a fresh clone has
// no journal line, because the journal is a different ref and may not have
// travelled. The result says the cross-check did not run, and never claims it
// passed.
func checkBattery(res *Result, tag string, lines []journal.SealLine) []string {
	line, found := newestLine(tag, lines)
	if !found {
		res.BatteryNote = "no seal line in this journal names this tag, so the battery pair was not cross-checked"

		return res.Problems
	}

	res.JournalBattery, res.JournalBatteryRun = line.Battery, line.BatteryRun

	// What the record last said happened to this tag, before what version it
	// was granted under. A revoked line carries the same battery pair the grant
	// did, so comparing pairs alone read a revoked seal as sound — F68. The
	// dying-amend shape lands here: revoked written, and the granted line that
	// was meant to follow it never arrived.
	if line.Action != "granted" {
		return append(res.Problems, fmt.Sprintf(
			"%s stands, and the newest thing the journal says about it is %s",
			clip(tag), clip(line.Action)))
	}

	if line.Battery == "" || line.BatteryRun == "" {
		res.BatteryNote = "the seal line carries no battery pair, so there was nothing to cross-check"

		return res.Problems
	}

	if line.Battery != res.Battery || line.BatteryRun != res.BatteryRun {
		return append(res.Problems, fmt.Sprintf(
			"%s carries the battery %s from %s, and its seal line says %s from %s",
			clip(tag), clip(res.Battery), clip(res.BatteryRun),
			clip(line.Battery), clip(line.BatteryRun)))
	}

	return res.Problems
}

// newestLine returns the newest seal line for one tag, whatever its action.
//
// Whatever its action, per D52.9. An amendment writes revoked and then granted,
// and reading only granted lines meant an amendment that died between its two
// writes left the old grant answering for a tag the record had already revoked.
// The lines arrive oldest first, so this walks backwards.
func newestLine(tag string, lines []journal.SealLine) (journal.SealLine, bool) {
	for i := len(lines) - 1; i >= 0; i-- {
		if lines[i].Tag == tag {
			return lines[i], true
		}
	}

	return journal.SealLine{}, false
}

// checkSignature says what a tag's signature came to, and why.
//
// Every path out of here that is not Verified says so in its own words, because
// "not verified" covers three different situations and a reader has to know
// which one they are in.
func checkSignature(dir, tag, signature string, keys signers) (Signature, string, string) {
	if signature == "" {
		return Unsigned, "", "this tag carries no signature, so it is no one's authority"
	}

	if !keys.present {
		return Unverified, "", fmt.Sprintf(
			"HEAD holds no %s, so nothing here could check this signature", AllowedSignersFile)
	}

	signer, said, err := verifySignature(dir, tag, keys.path)
	if err != nil {
		return Unverified, "", whyNotVerified(said)
	}

	if signer == "" {
		return Verified, "", fmt.Sprintf("a good signature by a key %s lists", AllowedSignersFile)
	}

	return Verified, signer, fmt.Sprintf("a good signature by %s, listed in %s", signer, AllowedSignersFile)
}
