package journal

import (
	"cmp"
	"crypto/sha256"
	"encoding/hex"
	"encoding/json"
	"errors"
	"fmt"
	"slices"
	"strings"
	"unicode/utf8"
)

// The chain is what makes a deleted or rewritten line show up. Every line
// carries the sha256 of the line before it in its own session, so the lines of
// one session hang together and a reader can walk them.
//
// Per session, not repo-global. Sessions are independent, and D15's union merge
// works because of that: two clones each write their own session, and the merged
// ref holds two chains that both still hold. A repo-global chain would conflict
// on every merge.
//
// What the chain proves: deletion and rewriting become evident to anyone who
// reads the ref. What it does not prove: it cannot stop an agent with write
// access from rewriting the chain forward. Only a signature with the key outside
// can do that. chainrow.go names what that leaves open.

// MaxWhyBytes caps the reason a break carries.
//
// A caller building a line of evidence has to know how much room the reason can
// take, so the cap lives here rather than being guessed at the other end.
// breakAt holds every reason to it, so the cap is true by construction and not
// by hope.
const MaxWhyBytes = 76

// ChainBreak is one place a session's chain does not hold.
//
// Seq is the seq the break is at: the line whose prev is wrong, or the seq no
// line is stored at. It is zero when the break is on a line nobody can read a
// seq off, and a caller must not print it then — naming seq 0 would name a seq
// no line ever has (D49 ruling 4).
//
// Why is one plain clause saying what is wrong, no wider than MaxWhyBytes.
type ChainBreak struct {
	Session string
	Seq     int
	Why     string
}

// ChainResult is what one walk of the journal found.
type ChainResult struct {
	// HasRef reports whether the journal ref exists at all. A repo that never
	// wrote a line has no ref, which is not a break and not an error. Spend
	// reports the same thing the same way.
	HasRef bool

	// Sessions is how many sessions the journal holds lines for.
	Sessions int

	// Lines is how many event lines were read.
	Lines int

	// Unchained counts the lines written before the chain existed: envelope
	// version 1, which carries no prev. They cannot be checked, so they are
	// counted and named. They are never breaks.
	Unchained int

	// UnchainedSessions is how many sessions hold nothing but those lines.
	//
	// A whole session invented in the v1 shape costs a forger no hashing at
	// all, and this walk cannot tell one from a genuine prefix. D49 ruling 3
	// accepts that until the seal lands, and puts this count on the row's line
	// so a reader watches the number instead of trusting it.
	UnchainedSessions int

	// Breaks is every place the chain does not hold, sorted by session and
	// then by seq, so the same journal reports the same first break every run.
	Breaks []ChainBreak
}

// CheckChain walks every session in the journal of the repo at repoDir and
// reports where the chain does not hold.
//
// repoDir may be any directory inside the repo. A line is grouped by the session
// it names, not by the directory it sits in, so moving a line between session
// directories hides nothing.
//
// CheckChain is read-only. It does not create the ref, write any object, or
// touch the repo's index or working tree.
func CheckChain(repoDir string) (ChainResult, error) {
	if err := checkRepo(repoDir); err != nil {
		return ChainResult{}, err
	}

	tip, err := resolve(repoDir, Ref)
	if err != nil {
		return ChainResult{}, err
	}
	if tip == "" {
		return ChainResult{}, nil
	}

	res := ChainResult{HasRef: true}
	sessions := map[string][]chainLine{}

	err = eachLine(repoDir, tip, func(path string, data []byte) error {
		res.Lines++

		var e struct {
			V       int    `json:"v"`
			Session string `json:"session"`
			Seq     int    `json:"seq"`
			Prev    string `json:"prev"`
		}
		if err := json.Unmarshal(data, &e); err != nil {
			// A line nobody can parse has been rewritten, whatever else it is.
			// It is a break rather than an error, because an error here would
			// leave the row unrunnable — and unrunnable never fails a run, so
			// one unparseable line would silence the whole check (F43's shape).
			res.Breaks = append(res.Breaks,
				breakAt(sessionOfPath(path), 0, whyNotJSON(err)))

			return nil
		}

		sum := sha256.Sum256(data)
		hash := hex.EncodeToString(sum[:])

		// The path is a claim about the content: a line is stored at the sha256
		// of its own bytes. Checking that claim costs nothing and closes the
		// rewrite-in-place forgery, where a line is edited and left where it
		// was (D49 ruling 3).
		if hashOfPath(path) != hash {
			res.Breaks = append(res.Breaks, breakAt(sessionOfPath(path), e.Seq,
				"this line does not hash to the path it is stored at"))
		}

		// A line with no session of its own belongs to no chain. Grouping it
		// under the empty string would make a session out of nothing and read
		// green (D49 ruling 4).
		if e.Session == "" {
			res.Breaks = append(res.Breaks, breakAt(sessionOfPath(path), e.Seq,
				"this line is stored here and names no session of its own"))

			return nil
		}

		sessions[e.Session] = append(sessions[e.Session], chainLine{
			seq:  e.Seq,
			v:    e.V,
			prev: e.Prev,
			hash: hash,
		})

		return nil
	})
	if err != nil {
		return ChainResult{}, err
	}

	res.Sessions = len(sessions)

	for session, lines := range sessions {
		unchained, breaks := walkSession(session, lines)
		res.Unchained += unchained
		if unchained == len(lines) {
			res.UnchainedSessions++
		}
		res.Breaks = append(res.Breaks, breaks...)
	}

	slices.SortFunc(res.Breaks, func(a, b ChainBreak) int {
		if by := cmp.Compare(a.Session, b.Session); by != 0 {
			return by
		}

		return cmp.Compare(a.Seq, b.Seq)
	})

	return res, nil
}

// chainLine is one line as the chain reads it. hash is the sha256 of the line's
// own bytes — the same hash its path is named for, computed from what the blob
// actually holds rather than trusted from where it sits.
type chainLine struct {
	seq  int
	v    int
	prev string
	hash string
}

// walkSession reads one session's lines in seq order. It returns how many of
// them were written before the chain, and every place the chain does not hold.
//
// The seqs are checked first. Past a gap or a repeat the chain says nothing:
// which line should have followed which is exactly what is missing, so the walk
// names the seq and stops rather than reporting every link after it as broken
// too.
func walkSession(session string, lines []chainLine) (int, []ChainBreak) {
	slices.SortFunc(lines, func(a, b chainLine) int {
		if by := cmp.Compare(a.seq, b.seq); by != 0 {
			return by
		}

		return cmp.Compare(a.hash, b.hash)
	})

	unchained := 0
	for _, line := range lines {
		if line.v < version {
			unchained++
		}
	}

	// A seq below 1 is its own break, and it is checked before the run of seqs
	// is. Left in, it shifts every later line one place along and makes the gap
	// message name a seq that is sitting right there (D49 ruling 4).
	if lines[0].seq < 1 {
		return unchained, []ChainBreak{
			breakAt(session, 0, whySeqBelowOne(lines[0].seq)),
		}
	}

	// From here the seqs run 1, 2, 3 or they do not. Every line before the one
	// that breaks the run carries exactly its own place, so a line that is
	// neither a repeat of the one before it nor its own place sits above a seq
	// nothing holds.
	for i, line := range lines {
		if line.seq == i+1 {
			continue
		}
		if i > 0 && line.seq == lines[i-1].seq {
			return unchained, []ChainBreak{
				breakAt(session, line.seq, "this session holds this seq twice"),
			}
		}

		return unchained, []ChainBreak{
			breakAt(session, i+1, "this session stores no line at this seq"),
		}
	}

	var breaks []ChainBreak
	chained := false

	for i, line := range lines {
		switch {
		case line.v < version:
			// A line before the chain began is the unchained prefix, and it is
			// never blamed. One after the chain began is the cheapest forgery
			// there is: drop out of the chain, and nothing has to hash.
			if chained {
				breaks = append(breaks, breakAt(session, line.seq,
					"this is a v1 line written after the chain began"))
			}
		case i == 0:
			chained = true
			if line.prev != "" {
				breaks = append(breaks, breakAt(session, line.seq,
					"the first line of a session carries a prev"))
			}
		default:
			chained = true
			if line.prev != lines[i-1].hash {
				breaks = append(breaks, breakAt(session, line.seq,
					"this line's prev is not the line before it"))
			}
		}
	}

	return unchained, breaks
}

// breakAt builds one break.
//
// Every reason goes through here, so MaxWhyBytes is enforced in one place
// rather than trusted at each call site. A caller sizes its line against that
// cap, and a reason that outgrew it would push the line past the journal's own
// cap instead of being cut here.
func breakAt(session string, seq int, why string) ChainBreak {
	if len(why) > MaxWhyBytes {
		why = why[:MaxWhyBytes]
		for len(why) > 0 && !utf8.ValidString(why) {
			why = why[:len(why)-1]
		}
	}

	return ChainBreak{Session: session, Seq: seq, Why: why}
}

// whyNotJSON says a line cannot be read, and where reading it stopped.
//
// The byte, never a seq: a line nobody can parse has no seq to name, and
// borrowing zero would print a seq no line ever has (D49 ruling 4).
func whyNotJSON(err error) string {
	var syntax *json.SyntaxError
	if errors.As(err, &syntax) {
		return fmt.Sprintf("this line is not JSON, from byte %d", syntax.Offset)
	}

	var typed *json.UnmarshalTypeError
	if errors.As(err, &typed) {
		return fmt.Sprintf("this line holds the wrong kind of value, at byte %d", typed.Offset)
	}

	return "this line cannot be read as an event"
}

// whySeqBelowOne says a line carries a seq no session ever starts at.
func whySeqBelowOne(seq int) string {
	return fmt.Sprintf("this line carries the seq %d, and a seq starts at 1", seq)
}

// eachLine hands every event line at a tip to fn, along with the path it is
// stored at.
//
// The path is where a line sits; the bytes are what it says. The chain reads the
// bytes, and holds the path to them.
func eachLine(dir, tip string, fn func(path string, data []byte) error) error {
	// --full-tree matches every other reader here: the path means the same
	// thing whatever directory the call started from.
	out, err := gitOut(dir, nil, nil,
		"ls-tree", "-r", "-z", "--full-tree", tip, "--", "events/")
	if err != nil {
		return err
	}

	paths, oids, err := treeEntries(out)
	if err != nil {
		return err
	}
	if len(oids) == 0 {
		return nil
	}

	// cat-file --batch answers in the order it was asked, so the nth object
	// belongs to the nth path.
	at := 0

	return eachObject(dir, oids, func(oid string, data []byte) error {
		if at >= len(paths) {
			return fmt.Errorf("git cat-file gave more objects than the %d asked for", len(paths))
		}
		path := paths[at]
		at++

		return fn(path, data)
	})
}

// sessionOfPath reads the session a line is filed under out of its path. A line
// is stored at events/<session>/<sha256-of-the-line>.json.
func sessionOfPath(path string) string {
	rest, found := strings.CutPrefix(path, "events/")
	if !found {
		return ""
	}

	session, _, found := strings.Cut(rest, "/")
	if !found {
		return ""
	}

	return session
}

// hashOfPath returns the sha256 a line's path claims for it: the last part of
// the path, without the .json.
func hashOfPath(path string) string {
	name := path
	if at := strings.LastIndex(name, "/"); at >= 0 {
		name = name[at+1:]
	}

	return strings.TrimSuffix(name, ".json")
}
