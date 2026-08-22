package journal

import (
	"cmp"
	"encoding/json"
	"errors"
	"fmt"
	"os"
	"path/filepath"
	"slices"
)

// hostUsageDir is where the host's own usage sidecar lives, relative to the
// repo root. It is never committed: the driver writes it by hand, from the
// host's out-of-band report, and this package only ever reads it.
const hostUsageDir = ".groundwork/host-usage"

// ErrSidecarMissing says the host-usage sidecar for a session does not
// exist. A missing sidecar must never be read as "nothing to check": the
// caller asked for a cross-check, and the file that check depends on is not
// there.
var ErrSidecarMissing = errors.New("the host-usage sidecar is missing")

// VerifyStatus says what a cross-check found for one sidecar entry.
type VerifyStatus string

const (
	// VerifyOK means the journal holds exactly one dispatch line at that
	// seq, and its tokens.total agrees with the host's figure within
	// tolerance.
	VerifyOK VerifyStatus = "ok"

	// VerifyMismatch means the journal holds exactly one dispatch line at
	// that seq, but its tokens.total disagrees with the host's figure by
	// more than tolerance.
	VerifyMismatch VerifyStatus = "mismatch"

	// VerifyNeverJournaled means the host reported a dispatch at that seq,
	// but the journal holds no dispatch line for it at all. The host
	// claimed a dispatch that was never recorded.
	VerifyNeverJournaled VerifyStatus = "never-journaled"

	// VerifyAmbiguous means the journal holds more than one dispatch line at
	// that seq. The real shape this happens in is two clones sharing a
	// session id, each writing their own seq 1, later merged: the journal
	// then holds two lines that both claim the same seq. There is no
	// principled way to pick one over the other, so this is never read as
	// ok and never silently takes the last line seen. It is its own status,
	// always a failure.
	VerifyAmbiguous VerifyStatus = "ambiguous"
)

// VerifyRow is the outcome of checking one seq: either a sidecar entry
// against the journal, or — for a seq the journal holds more than once but
// the sidecar never mentions — the journal disagreeing with itself.
type VerifyRow struct {
	Seq int

	// HostTokens is the tokens_total the sidecar reports for this seq. It
	// means nothing when HostClaimed is false: a collision the sidecar
	// never claimed still gets its own row, but has no host figure to show.
	HostTokens int64

	// HostClaimed reports whether the sidecar named this seq at all.
	HostClaimed bool

	// JournalTokens holds the tokens.total of every dispatch line the
	// journal holds at this seq, sorted ascending. Empty means the journal
	// holds no such line (VerifyNeverJournaled). More than one entry means
	// the journal holds more than one line at this seq (VerifyAmbiguous):
	// both figures are kept, not just the first or the last one read.
	JournalTokens []int64

	Status VerifyStatus
}

// VerifyResult is the full outcome of a token cross-check for one session.
type VerifyResult struct {
	Session string
	Rows    []VerifyRow

	// Unchecked counts the journal's own dispatch lines for this session
	// that the sidecar says nothing about, and that are not themselves
	// ambiguous. That is expected, not an error: not every dispatch is
	// host-tracked. A seq the journal holds more than once is never counted
	// here, whether or not the sidecar claims it: it gets its own row and
	// its own failure instead of being folded into "the host didn't ask".
	Unchecked int
}

// sidecarFile is the on-disk shape of a host-usage sidecar, exactly as the
// driver writes it.
//
// Dispatches is a pointer so a missing "dispatches" key and an explicit
// "dispatches": null both decode to nil: JSON does not let this package
// tell those two apart, so both are treated the same way, as a malformed
// sidecar. A present empty list decodes to a non-nil pointer to a
// zero-length slice, which is a different, and differently worded, problem:
// the sidecar is well-formed, but it claims nothing to check.
type sidecarFile struct {
	Session    string          `json:"session"`
	Dispatches *[]sidecarEntry `json:"dispatches"`
}

// sidecarEntry is one dispatch the host reported, from the sidecar.
type sidecarEntry struct {
	Seq         int   `json:"seq"`
	TokensTotal int64 `json:"tokens_total"`
}

// VerifyTokens cross-checks one session's host-reported token figures
// against the journal's own dispatch lines.
//
// repoDir may be any directory inside the repo. The sidecar is read from
// <repo root>/.groundwork/host-usage/<session>.json regardless of repoDir,
// because the driver writes it once, at the root, no matter where a later
// command runs from.
//
// tolerance is the largest absolute difference, in tokens, that still
// counts as agreement. Pass 0 to require an exact match.
//
// VerifyTokens always checks at least one sidecar entry when it returns no
// error. A sidecar that names no dispatches at all — an absent
// "dispatches" key, an explicit null, or a present empty list — is refused
// instead: the verb's one job is to have verified something, and reporting
// success over an empty sidecar would not be that.
//
// VerifyTokens is read-only. It does not create the journal ref, write any
// object, or touch the repo's index or working tree. It does not touch the
// sidecar either: that file is the driver's to write, never this package's.
func VerifyTokens(repoDir, session string, tolerance int64) (VerifyResult, error) {
	if err := checkRepo(repoDir); err != nil {
		return VerifyResult{}, err
	}
	// The session becomes half of a file name below. The same charset the
	// write path enforces on a session id keeps that name safe — in
	// particular, it keeps a session id like "../../evil" from ever
	// resolving outside the sidecar directory — and keeps the error the
	// caller sees consistent with every other verb.
	if err := checkSession(session); err != nil {
		return VerifyResult{}, err
	}

	root, err := repoRoot(repoDir)
	if err != nil {
		return VerifyResult{}, err
	}
	path := filepath.Join(root, filepath.FromSlash(hostUsageDir), session+".json")

	raw, err := os.ReadFile(path)
	if err != nil {
		if errors.Is(err, os.ErrNotExist) {
			return VerifyResult{}, fmt.Errorf("%w: %s", ErrSidecarMissing, path)
		}
		return VerifyResult{}, fmt.Errorf("could not read %s: %w", path, err)
	}

	sidecar, err := decodeSidecar(path, raw, session)
	if err != nil {
		return VerifyResult{}, err
	}

	tip, err := resolve(repoDir, Ref)
	if err != nil {
		return VerifyResult{}, err
	}

	journaled, err := sessionDispatchLists(repoDir, tip, session)
	if err != nil {
		return VerifyResult{}, err
	}

	claimed := make(map[int]bool, len(sidecar))
	rows := make([]VerifyRow, 0, len(sidecar))

	for _, entry := range sidecar {
		claimed[entry.Seq] = true

		journalTotals := journaled[entry.Seq]
		row := VerifyRow{
			Seq:           entry.Seq,
			HostTokens:    entry.TokensTotal,
			HostClaimed:   true,
			JournalTokens: journalTotals,
		}

		switch {
		case len(journalTotals) == 0:
			row.Status = VerifyNeverJournaled
		case len(journalTotals) > 1:
			row.Status = VerifyAmbiguous
		case tokensDiffer(journalTotals[0], entry.TokensTotal, tolerance):
			row.Status = VerifyMismatch
		default:
			row.Status = VerifyOK
		}

		rows = append(rows, row)
	}

	// A seq the journal holds more than once is ambiguous whether or not the
	// sidecar ever claimed it: the journal disagrees with itself, which is
	// wrong regardless of what the host thinks. That seq gets its own row
	// rather than being folded into "the host never asked about this one".
	unchecked := 0
	for seq, totals := range journaled {
		if claimed[seq] {
			continue
		}
		if len(totals) > 1 {
			rows = append(rows, VerifyRow{
				Seq:           seq,
				HostClaimed:   false,
				JournalTokens: totals,
				Status:        VerifyAmbiguous,
			})
			continue
		}
		unchecked++
	}

	// Sorted by seq, so the output reads in dispatch order no matter what
	// order the sidecar's own array happened to list them in, and no matter
	// which of the two loops above produced a given row. cmp.Compare, not
	// subtraction: a seq is a plain int, and a subtraction comparator wraps
	// at the extremes the same way the token comparison used to.
	slices.SortFunc(rows, func(a, b VerifyRow) int { return cmp.Compare(a.Seq, b.Seq) })

	return VerifyResult{Session: session, Rows: rows, Unchecked: unchecked}, nil
}

// decodeSidecar parses a sidecar's raw bytes and returns its dispatch
// entries, or an error naming what is wrong with the file.
//
// Every way a sidecar can fail to name a real, checkable claim is refused
// here: bytes that are not JSON, a session that does not match the one
// asked for, a missing or null dispatches list, an empty dispatches list,
// a seq claimed twice, and a negative tokens_total. Each is its own
// sentence, so the message that reaches the caller says which one it was.
func decodeSidecar(path string, raw []byte, session string) ([]sidecarEntry, error) {
	var sidecar sidecarFile
	if err := json.Unmarshal(raw, &sidecar); err != nil {
		return nil, fmt.Errorf("%s is not valid JSON: %w", path, err)
	}
	if sidecar.Session != session {
		return nil, fmt.Errorf(
			"%s names session %q, but --session is %q: this is the wrong file",
			path, sidecar.Session, session)
	}
	if sidecar.Dispatches == nil {
		return nil, fmt.Errorf(`%s has no "dispatches" list`, path)
	}
	entries := *sidecar.Dispatches
	if len(entries) == 0 {
		return nil, fmt.Errorf("%s: the sidecar claims no dispatches", path)
	}

	seen := make(map[int]bool, len(entries))
	for _, entry := range entries {
		if seen[entry.Seq] {
			return nil, fmt.Errorf("%s claims seq %d more than once", path, entry.Seq)
		}
		seen[entry.Seq] = true

		if entry.TokensTotal < 0 {
			return nil, fmt.Errorf("%s claims tokens_total %d at seq %d, which is negative",
				path, entry.TokensTotal, entry.Seq)
		}
	}

	return entries, nil
}

// sessionDispatchLists reads every dispatch line the journal holds for one
// session, at the given tip, and returns each one's tokens.total, keyed by
// seq. A seq the journal holds more than once — two clones sharing a
// session id, each writing their own line at the same seq, later merged —
// comes back with every one of its totals, sorted ascending, rather than
// picking one.
//
// A tip of "" (no journal ref yet) and a session with no events both come
// back as an empty map, not an error: the journal simply has nothing to say
// about that session yet.
func sessionDispatchLists(dir, tip, session string) (map[int][]int64, error) {
	if tip == "" {
		return map[int][]int64{}, nil
	}

	// --full-tree matches every other reader in this package: the path
	// means the same thing no matter what directory the call started from.
	out, err := gitOut(dir, nil, nil,
		"ls-tree", "-r", "-z", "--full-tree", tip, "--", "events/"+session+"/")
	if err != nil {
		return nil, err
	}

	oids, err := treeOIDs(out)
	if err != nil {
		return nil, err
	}
	if len(oids) == 0 {
		return map[int][]int64{}, nil
	}

	totals := map[int][]int64{}

	err = eachObject(dir, oids, func(oid string, data []byte) error {
		var e struct {
			Kind   string `json:"kind"`
			Seq    int    `json:"seq"`
			Tokens tokens `json:"tokens"`
		}
		if err := json.Unmarshal(data, &e); err != nil {
			return fmt.Errorf("journal object %s is not valid JSON: %w", oid, err)
		}
		if e.Kind != "dispatch" {
			return nil
		}
		totals[e.Seq] = append(totals[e.Seq], int64(e.Tokens.Total))

		return nil
	})
	if err != nil {
		return nil, err
	}

	for seq, list := range totals {
		slices.Sort(list)
		totals[seq] = list
	}

	return totals, nil
}

// tokensDiffer reports whether two token totals differ by more than
// tolerance. tolerance is never negative in practice — the CLI refuses one
// before it ever reaches here — but the comparison holds even if it were.
//
// The two values are ordered first, then the difference is taken in uint64
// space rather than int64. That is what makes this safe at the extremes: the
// true difference between any two int64 values always fits in a uint64,
// even when it does not fit in an int64 (zero against math.MinInt64, for
// one). A plain int64 subtraction can wrap there, and a wrapped difference
// can come out negative or small enough to slip under tolerance — which is
// exactly a mismatch reported as ok.
func tokensDiffer(journalTotal, hostTotal, tolerance int64) bool {
	a, b := journalTotal, hostTotal
	if a > b {
		a, b = b, a
	}

	diff := uint64(b) - uint64(a)
	tol := uint64(0)
	if tolerance > 0 {
		tol = uint64(tolerance)
	}

	return diff > tol
}
