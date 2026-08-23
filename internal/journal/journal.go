// Package journal records GroundWork events in git.
//
// One event is one JSON object on one line. Each line is stored as a blob at
// events/<session>/<sha256-of-the-line>.json, and every write adds one commit
// to the ref refs/groundwork/journal.
//
// A write never touches the working tree or the repo's index. It builds its
// tree in a temporary index instead. So a write is safe at any moment, and it
// does not care whether the working tree is clean.
package journal

import (
	"crypto/rand"
	"crypto/sha256"
	"encoding/hex"
	"encoding/json"
	"errors"
	"fmt"
	"os"
	"slices"
	"strconv"
	"strings"
	"time"
)

// Ref is the git ref that holds the journal.
const Ref = "refs/groundwork/journal"

// version is the envelope version of every event this package writes.
const version = 1

// sessionEnv names the environment variable that carries the session id.
const sessionEnv = "GROUNDWORK_SESSION"

// attempts is how many times a write retries after another writer wins the
// race for the ref. Each retry reads the ref again and builds a fresh event.
const attempts = 10

// maxSessionBytes caps a session id. It becomes a directory name.
const maxSessionBytes = 128

// MaxTextBytes caps the free text fields of an event. A runaway string
// should not bloat the ref, and a line should stay readable.
//
// It is exported because a caller that builds its own free text — a battery
// row's evidence, say — has to cut it to fit before it offers it here. A
// second copy of the number in that caller would be one to drift.
const MaxTextBytes = 200

// sessionBytes is how many random bytes a generated session id carries.
const sessionBytes = 16

// floorRung is the rung a scope sits at before anything dials it.
const floorRung = "slice"

// ErrNotARepo says the directory is not inside a git repository.
var ErrNotARepo = errors.New("not in a git repository")

// errRefMoved says another writer moved the journal ref mid-write.
// It is not returned to callers. A write retries instead.
var errRefMoved = errors.New("the journal ref moved during the write")

// roles is the closed vocabulary for the role field.
var roles = []string{
	"driver", "worker", "adversary", "blind-author", "capsule-writer", "advisor", "sim",
}

// tiers is the closed vocabulary for the tier field.
var tiers = []string{"frontier", "execution"}

// rungs is the closed vocabulary for the dial. The spec names four rungs:
// "They are `slice`, `milestone`, `bet`, and `program`."
var rungs = []string{"slice", "milestone", "bet", "program"}

// sealActions is the closed vocabulary for a seal's action.
var sealActions = []string{"granted", "revoked"}

// Each closed vocabulary has one accessor. A caller shows the list from here
// rather than keeping a copy of it, so there is only one place to change.

// Roles returns the roles a dispatch event accepts.
func Roles() []string {
	return slices.Clone(roles)
}

// Tiers returns the model tiers a dispatch event accepts.
func Tiers() []string {
	return slices.Clone(tiers)
}

// Rungs returns the rungs the dial accepts, in order from the most watchful.
func Rungs() []string {
	return slices.Clone(rungs)
}

// SealActions returns the actions a seal event accepts.
func SealActions() []string {
	return slices.Clone(sealActions)
}

// Dispatch is one dispatch of an agent, as the caller reports it.
// The journal fills in the rest of the event itself.
type Dispatch struct {
	Role         string
	Tier         string
	TokensIn     int
	TokensOut    int
	TokensSource string
	DurationMS   int
	Outcome      string
}

// Dial is one move of the autonomy dial, as the caller reports it.
//
// There is no From field on purpose. Where the dial moved from is read back
// from the journal, so the caller cannot claim a rung the record disagrees
// with.
type Dial struct {
	To     string
	Scope  string
	Reason string
}

// Seal is one seal granted or revoked, as the caller reports it.
//
// There is no target field on purpose. The commit is read from the tag, so
// the record cannot name a commit the tag does not hold.
type Seal struct {
	Kind   string
	Tag    string
	Action string
}

// tokens holds the token counts for one dispatch.
type tokens struct {
	In    int `json:"in"`
	Out   int `json:"out"`
	Total int `json:"total"`
}

// envelope is the part of a line every kind carries. It comes first on the
// line, in the order the fields are declared here.
type envelope struct {
	V             int    `json:"v"`
	TS            string `json:"ts"`
	Kind          string `json:"kind"`
	Session       string `json:"session"`
	SessionSource string `json:"session_source,omitempty"`
	Seq           int    `json:"seq"`
	Commit        string `json:"commit"`
	Branch        string `json:"branch"`
}

// dispatchEvent is one dispatch line.
type dispatchEvent struct {
	envelope

	Role         string `json:"role"`
	Tier         string `json:"tier"`
	Tokens       tokens `json:"tokens"`
	TokensSource string `json:"tokens_source"`
	DurationMS   int    `json:"duration_ms"`
	Outcome      string `json:"outcome"`
}

// dialEvent is one dial line.
type dialEvent struct {
	envelope

	From   string `json:"from"`
	To     string `json:"to"`
	Scope  string `json:"scope"`
	Reason string `json:"reason"`
}

// sealEvent is one seal line.
type sealEvent struct {
	envelope

	SealKind string `json:"seal_kind"`
	Tag      string `json:"tag"`
	Target   string `json:"target"`
	Action   string `json:"action"`
}

// build makes the line for one kind of event, around an envelope the write
// path has already filled in.
//
// It gets the tip the write will build on, so a kind that reads the journal
// back sees exactly what its own line will be added to. It runs once per
// attempt. An error from it stops the write, and nothing is stored.
type build func(dir, tip string, env envelope) (any, error)

// WriteDispatch records one dispatch event in the journal of the repo at
// repoDir. repoDir may be any directory inside the repo. It returns the path
// the event was stored at.
//
// It writes nothing when it rejects the dispatch.
func WriteDispatch(repoDir string, d Dispatch) (string, error) {
	if err := checkDispatch(d); err != nil {
		return "", err
	}

	return write(repoDir, "dispatch", func(dir, tip string, env envelope) (any, error) {
		return dispatchEvent{
			envelope:     env,
			Role:         d.Role,
			Tier:         d.Tier,
			Tokens:       tokens{In: d.TokensIn, Out: d.TokensOut, Total: d.TokensIn + d.TokensOut},
			TokensSource: d.TokensSource,
			DurationMS:   d.DurationMS,
			Outcome:      d.Outcome,
		}, nil
	})
}

// WriteDial records one move of the autonomy dial in the journal of the repo
// at repoDir. It returns the path the event was stored at.
//
// The line's from field is read from the journal, not from the caller. It is
// the rung the scope was left at by its own newest dial line, or the floor if
// the journal holds no dial for that scope.
//
// It writes nothing when it rejects the dial.
func WriteDial(repoDir string, d Dial) (string, error) {
	if err := checkDial(d); err != nil {
		return "", err
	}

	return write(repoDir, "dial", func(dir, tip string, env envelope) (any, error) {
		from, err := rungOf(dir, tip, d.Scope)
		if err != nil {
			return nil, err
		}

		return dialEvent{
			envelope: env,
			From:     from,
			To:       d.To,
			Scope:    d.Scope,
			Reason:   d.Reason,
		}, nil
	})
}

// WriteSeal records one seal granted or revoked in the journal of the repo at
// repoDir. It returns the path the event was stored at.
//
// The line's target field is read from the tag, not from the caller. A tag
// the repo does not hold is an error, and nothing is written.
func WriteSeal(repoDir string, s Seal) (string, error) {
	if err := checkSeal(s); err != nil {
		return "", err
	}

	// The tag is read before the write path starts, because the tag does not
	// depend on the journal's tip and a retry must not look it up again.
	// So this checks the repo ahead of write, which checks it again. Outside
	// a repo the caller hears ErrNotARepo rather than git's words about a
	// missing tag. One spare git call buys that.
	if err := checkRepo(repoDir); err != nil {
		return "", err
	}

	target, err := tagCommit(repoDir, s.Tag)
	if err != nil {
		return "", err
	}

	return write(repoDir, "seal", func(dir, tip string, env envelope) (any, error) {
		return sealEvent{
			envelope: env,
			SealKind: s.Kind,
			Tag:      s.Tag,
			Target:   target,
			Action:   s.Action,
		}, nil
	})
}

// retryOnRace runs one attempt at moving the journal ref, again and again
// until it wins the race. An attempt that reports errRefMoved lost to another
// writer, so it is thrown away and a fresh one is built on the tip that won.
// Any other error stops the work at once.
//
// Both the write path and the merge path go through here, so there is one
// retry policy in the package rather than one per verb.
func retryOnRace[T any](attempt func() (T, error)) (T, error) {
	var zero T
	var lost error

	for n := range attempts {
		if n > 0 {
			// Wait a moment, so racing writers do not all retry together.
			time.Sleep(time.Duration(n) * 5 * time.Millisecond)
		}

		got, err := attempt()
		if err == nil {
			return got, nil
		}
		if !errors.Is(err, errRefMoved) {
			return zero, err
		}
		lost = err
	}

	return zero, fmt.Errorf("gave up after %d attempts: %w", attempts, lost)
}

// moveRef points the journal ref at commit, but only while the ref still holds
// old. An empty old means the ref must not exist yet.
//
// A refusal comes back wrapped in errRefMoved, which is what makes retryOnRace
// try again. Two races land here: another writer moved the ref, or another
// writer holds its lock this instant. Both mean this attempt lost, so both are
// worth retrying. A real fault — a broken repo, no permission — fails the same
// way every time, and the caller reports git's own words once the retries run
// out.
func moveRef(dir, commit, old string) error {
	if _, err := gitOut(dir, nil, nil, "update-ref", Ref, commit, old); err != nil {
		return fmt.Errorf("%w: %w", errRefMoved, err)
	}

	return nil
}

// write is the one path every kind of event goes through. It fills in the
// envelope, hashes the line, and stores it under the writing session.
//
// It writes nothing when anything along the way says no.
func write(repoDir, kind string, b build) (string, error) {
	checkKind(kind)

	session, generated, err := sessionID()
	if err != nil {
		return "", err
	}

	if err := checkRepo(repoDir); err != nil {
		return "", err
	}

	commit, err := headCommit(repoDir)
	if err != nil {
		return "", err
	}
	branch, err := branchName(repoDir)
	if err != nil {
		return "", err
	}

	// Another writer may move the ref between the read and the write. When
	// that happens this attempt is thrown away and a fresh one is built, so
	// the new event is numbered after theirs instead of over it.
	return retryOnRace(func() (string, error) {
		tip, err := resolve(repoDir, Ref)
		if err != nil {
			return "", err
		}

		seq, err := nextSeq(repoDir, tip, session)
		if err != nil {
			return "", err
		}

		// Nanoseconds, because two events a millisecond apart must still
		// order. RFC3339 allows the fraction, so this is the format D8 ruled.
		env := envelope{
			V:       version,
			TS:      time.Now().UTC().Format(time.RFC3339Nano),
			Kind:    kind,
			Session: session,
			Seq:     seq,
			Commit:  commit,
			Branch:  branch,
		}
		if generated {
			env.SessionSource = "generated"
		}

		e, err := b(repoDir, tip, env)
		if err != nil {
			return "", err
		}

		line, err := json.Marshal(e)
		if err != nil {
			return "", fmt.Errorf("build the event: %w", err)
		}
		line = append(line, '\n')

		sum := sha256.Sum256(line)
		path := "events/" + session + "/" + hex.EncodeToString(sum[:]) + ".json"

		message := fmt.Sprintf("journal: %s %s %d", kind, session, seq)

		if err := store(repoDir, tip, path, line, message); err != nil {
			return "", err
		}

		return path, nil
	})
}

// checkDispatch rejects a dispatch the journal will not record.
func checkDispatch(d Dispatch) error {
	if !slices.Contains(roles, d.Role) {
		return fmt.Errorf("role %q is not one of: %s", d.Role, strings.Join(roles, ", "))
	}
	if !slices.Contains(tiers, d.Tier) {
		return fmt.Errorf("tier %q is not one of: %s", d.Tier, strings.Join(tiers, ", "))
	}
	if err := checkText("outcome", d.Outcome); err != nil {
		return err
	}

	return checkText("tokens_source", d.TokensSource)
}

// checkDial rejects a dial the journal will not record.
func checkDial(d Dial) error {
	if !slices.Contains(rungs, d.To) {
		return fmt.Errorf("rung %q is not one of: %s", d.To, strings.Join(rungs, ", "))
	}
	if err := checkFilled("scope", d.Scope); err != nil {
		return err
	}

	return checkFilled("reason", d.Reason)
}

// checkSeal rejects a seal the journal will not record.
func checkSeal(s Seal) error {
	if !slices.Contains(sealActions, s.Action) {
		return fmt.Errorf("action %q is not one of: %s", s.Action, strings.Join(sealActions, ", "))
	}
	if err := checkFilled("seal_kind", s.Kind); err != nil {
		return err
	}

	return checkFilled("tag", s.Tag)
}

// checkText rejects a free text field that is too long to record.
func checkText(name, value string) error {
	if len(value) > MaxTextBytes {
		return fmt.Errorf("%s is %d bytes, over the limit of %d", name, len(value), MaxTextBytes)
	}

	return nil
}

// checkFilled rejects a free text field that is empty or too long to record.
// A field the reader needs is worth nothing empty.
func checkFilled(name, value string) error {
	if value == "" {
		return fmt.Errorf("%s is empty", name)
	}

	return checkText(name, value)
}

// sessionID returns the session id for this event. It also reports whether
// the id had to be generated, because the environment did not name one.
func sessionID() (string, bool, error) {
	if id := os.Getenv(sessionEnv); id != "" {
		if err := checkSession(id); err != nil {
			return "", false, err
		}
		return id, false, nil
	}

	raw := make([]byte, sessionBytes)
	if _, err := rand.Read(raw); err != nil {
		return "", false, fmt.Errorf("generate a session id: %w", err)
	}

	return "gen-" + hex.EncodeToString(raw), true, nil
}

// checkSession rejects a session id that would make an unsafe or unwieldy
// path. The id becomes a directory name inside the journal tree.
func checkSession(id string) error {
	if id == "" {
		return errors.New("session is empty")
	}
	if len(id) > maxSessionBytes {
		return fmt.Errorf("session is %d bytes, over the limit of %d", len(id), maxSessionBytes)
	}
	if strings.HasPrefix(id, ".") {
		return fmt.Errorf("session %q starts with a dot", id)
	}

	for _, r := range id {
		switch {
		case r >= 'a' && r <= 'z':
		case r >= 'A' && r <= 'Z':
		case r >= '0' && r <= '9':
		case r == '-' || r == '_' || r == '.':
		default:
			return fmt.Errorf("session %q holds %q, which is not a letter, a digit, a dash, an underscore or a dot", id, r)
		}
	}

	return nil
}

// nextSeq returns the sequence number for the next event of a session.
// It is one more than the highest number the journal already holds for it.
func nextSeq(dir, tip, session string) (int, error) {
	if tip == "" {
		return 1, nil
	}

	// --full-tree keeps the path meaning the same from any directory in the
	// repo. Without it git reads the path relative to the current directory,
	// and a call from a subdirectory would find nothing.
	out, err := gitOut(dir, nil, nil,
		"ls-tree", "-r", "-z", "--full-tree", tip, "--", "events/"+session+"/")
	if err != nil {
		return 0, err
	}

	oids, err := treeOIDs(out)
	if err != nil {
		return 0, err
	}
	if len(oids) == 0 {
		return 1, nil
	}

	highest, err := highestSeq(dir, oids)
	if err != nil {
		return 0, err
	}

	return highest + 1, nil
}

// treeOIDs pulls the object ids out of the output of git ls-tree -z.
// Each entry reads "<mode> <type> <oid>\t<path>".
func treeOIDs(out string) ([]string, error) {
	var oids []string

	for _, entry := range strings.Split(out, "\x00") {
		if entry == "" {
			continue
		}

		head, _, found := strings.Cut(entry, "\t")
		if !found {
			return nil, fmt.Errorf("git ls-tree gave the entry %q", entry)
		}

		fields := strings.Fields(head)
		if len(fields) != 3 {
			return nil, fmt.Errorf("git ls-tree gave the entry %q", entry)
		}

		oids = append(oids, fields[2])
	}

	return oids, nil
}

// highestSeq reads the given blobs and returns the highest seq they hold.
//
// It takes one git call however many blobs there are. The bytes still grow:
// each write reads every earlier event of the same session. A long session
// will want an index.
func highestSeq(dir string, oids []string) (int, error) {
	highest := 0

	err := eachObject(dir, oids, func(oid string, data []byte) error {
		var e struct {
			Seq int `json:"seq"`
		}
		if err := json.Unmarshal(data, &e); err != nil {
			return fmt.Errorf("journal object %s is not valid JSON: %w", oid, err)
		}
		if e.Seq > highest {
			highest = e.Seq
		}

		return nil
	})
	if err != nil {
		return 0, err
	}

	return highest, nil
}

// rungOf returns the rung a scope sits at now, read from the journal itself.
//
// That is the to of the newest dial line carrying the same scope. Newest is
// decided by ts. A scope the journal holds no dial for sits at the floor.
//
// Seq only breaks a tie on ts, and it only means anything inside one session:
// two sessions number their own events, so seq 2 in one says nothing about
// seq 5 in another. Ordering is the clock's job here.
//
// This costs more than highestSeq: it reads every event in the journal, not
// just one session's. A journal large enough to feel that wants an index.
func rungOf(dir, tip, scope string) (string, error) {
	if tip == "" {
		return floorRung, nil
	}

	// Every session's events, not just this one's: a scope keeps its rung
	// across the sessions that work on it.
	out, err := gitOut(dir, nil, nil,
		"ls-tree", "-r", "-z", "--full-tree", tip, "--", "events/")
	if err != nil {
		return "", err
	}

	oids, err := treeOIDs(out)
	if err != nil {
		return "", err
	}
	if len(oids) == 0 {
		return floorRung, nil
	}

	rung := floorRung
	var newest time.Time
	newestSeq := 0

	// Two lines can still tie on ts and seq: two sessions writing in the same
	// nanosecond. The first one the tree gives wins, and the tree is sorted
	// by path, so that is the lowest-sorting session id. It is stable but
	// arbitrary. Clocks that disagree land here too, and this is the best a
	// timestamp can do about that.
	err = eachObject(dir, oids, func(oid string, data []byte) error {
		var e struct {
			Kind  string `json:"kind"`
			TS    string `json:"ts"`
			Seq   int    `json:"seq"`
			To    string `json:"to"`
			Scope string `json:"scope"`
		}
		if err := json.Unmarshal(data, &e); err != nil {
			return fmt.Errorf("journal object %s is not valid JSON: %w", oid, err)
		}
		if e.Kind != "dial" || e.Scope != scope {
			return nil
		}

		ts, err := time.Parse(time.RFC3339, e.TS)
		if err != nil {
			return fmt.Errorf("journal object %s has the ts %q, which is not RFC3339", oid, e.TS)
		}
		if ts.After(newest) || (ts.Equal(newest) && e.Seq > newestSeq) {
			newest, newestSeq, rung = ts, e.Seq, e.To
		}

		return nil
	})
	if err != nil {
		return "", err
	}

	return rung, nil
}

// eachObject reads the given git objects in one call and hands each one's
// bytes to fn, along with its object id.
func eachObject(dir string, oids []string, fn func(oid string, data []byte) error) error {
	stdin := []byte(strings.Join(oids, "\n") + "\n")

	out, err := gitOut(dir, nil, stdin, "cat-file", "--batch")
	if err != nil {
		return err
	}

	return scanBatch(out, fn)
}

// scanBatch reads the output of git cat-file --batch. Each object comes as
// "<oid> <type> <size>\n", then its bytes, then one more newline.
func scanBatch(out string, fn func(oid string, data []byte) error) error {
	for len(out) > 0 {
		header, rest, found := strings.Cut(out, "\n")
		if !found {
			return fmt.Errorf("git cat-file gave the header %q, with no newline", header)
		}

		fields := strings.Fields(header)
		if len(fields) != 3 {
			return fmt.Errorf("git cat-file gave the header %q", header)
		}

		size, err := strconv.Atoi(fields[2])
		if err != nil {
			return fmt.Errorf("git cat-file gave the size %q for object %s", fields[2], fields[0])
		}
		if len(rest) < size+1 {
			return fmt.Errorf("git cat-file cut object %s short", fields[0])
		}

		if err := fn(fields[0], []byte(rest[:size])); err != nil {
			return err
		}

		out = rest[size+1:]
	}

	return nil
}

// store adds one line to the journal ref as a blob at path.
//
// It builds the new tree in a temporary index, so the repo's own index and
// working tree stay where they are. The ref moves only if it is still at tip.
// If it is not, store returns errRefMoved and adds nothing.
func store(dir, tip, path string, line []byte, message string) error {
	// Never report success while adding nothing. A path already in the tree
	// means this exact line is already recorded.
	if tip != "" {
		held, err := inTree(dir, tip, path)
		if err != nil {
			return err
		}
		if held {
			return fmt.Errorf("the journal already holds %s", path)
		}
	}

	blob, err := gitOut(dir, nil, line, "hash-object", "-w", "-t", "blob", "--stdin")
	if err != nil {
		return err
	}
	blob = strings.TrimSpace(blob)

	tree, err := inTempIndex(dir, func(env []string) error {
		if tip != "" {
			if _, err := gitOut(dir, env, nil, "read-tree", tip); err != nil {
				return err
			}
		}

		// The path in --cacheinfo is read from the root of the repo, not from
		// the current directory, so this works from anywhere in the repo.
		cacheinfo := fmt.Sprintf("100644,%s,%s", blob, path)
		_, err := gitOut(dir, env, nil, "update-index", "--add", "--cacheinfo", cacheinfo)

		return err
	})
	if err != nil {
		return err
	}

	args := []string{"commit-tree", tree}
	if tip != "" {
		args = append(args, "-p", tip)
	}
	args = append(args, "-m", message)

	commit, err := gitOut(dir, identity(), nil, args...)
	if err != nil {
		return err
	}
	commit = strings.TrimSpace(commit)

	return moveRef(dir, commit, tip)
}

// inTree reports whether a tree-ish already holds a path.
func inTree(dir, tip, path string) (bool, error) {
	out, err := gitOut(dir, nil, nil, "ls-tree", "-z", "--full-tree", tip, "--", path)
	if err != nil {
		return false, err
	}

	return strings.TrimSpace(out) != "", nil
}

// identity is the author and committer on journal commits. The journal
// records a session, not a person, so it does not use the repo's git config.
func identity() []string {
	return []string{
		"GIT_AUTHOR_NAME=groundwork",
		"GIT_AUTHOR_EMAIL=groundwork@localhost",
		"GIT_COMMITTER_NAME=groundwork",
		"GIT_COMMITTER_EMAIL=groundwork@localhost",
	}
}
