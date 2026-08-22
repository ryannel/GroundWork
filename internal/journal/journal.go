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
	"path/filepath"
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

// maxTextBytes caps the free text fields of an event. A runaway string
// should not bloat the ref, and a line should stay readable.
const maxTextBytes = 200

// sessionBytes is how many random bytes a generated session id carries.
const sessionBytes = 16

// ErrNotARepo says the directory is not inside a git repository.
var ErrNotARepo = errors.New("not in a git repository")

// errRefMoved says another writer moved the journal ref mid-write.
// It is not returned to callers. WriteDispatch retries instead.
var errRefMoved = errors.New("the journal ref moved during the write")

// roles is the closed vocabulary for the role field.
var roles = []string{
	"driver", "worker", "adversary", "blind-author", "capsule-writer", "advisor", "sim",
}

// tiers is the closed vocabulary for the tier field.
var tiers = []string{"frontier", "execution"}

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

// tokens holds the token counts for one dispatch.
type tokens struct {
	In    int `json:"in"`
	Out   int `json:"out"`
	Total int `json:"total"`
}

// event is one journal line. The envelope comes first, then the fields the
// kind adds. The order of the fields here is the order on the line.
type event struct {
	V             int    `json:"v"`
	TS            string `json:"ts"`
	Kind          string `json:"kind"`
	Session       string `json:"session"`
	SessionSource string `json:"session_source,omitempty"`
	Seq           int    `json:"seq"`
	Commit        string `json:"commit"`
	Branch        string `json:"branch"`

	Role         string `json:"role"`
	Tier         string `json:"tier"`
	Tokens       tokens `json:"tokens"`
	TokensSource string `json:"tokens_source"`
	DurationMS   int    `json:"duration_ms"`
	Outcome      string `json:"outcome"`
}

// WriteDispatch records one dispatch event in the journal of the repo at
// repoDir. repoDir may be any directory inside the repo. It returns the path
// the event was stored at.
//
// It writes nothing when it rejects the dispatch.
func WriteDispatch(repoDir string, d Dispatch) (string, error) {
	if err := checkDispatch(d); err != nil {
		return "", err
	}

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
	var lost error

	for attempt := 0; attempt < attempts; attempt++ {
		if attempt > 0 {
			// Wait a moment, so racing writers do not all retry together.
			time.Sleep(time.Duration(attempt) * 5 * time.Millisecond)
		}

		tip, err := resolve(repoDir, Ref)
		if err != nil {
			return "", err
		}

		seq, err := nextSeq(repoDir, tip, session)
		if err != nil {
			return "", err
		}

		e := event{
			V:            version,
			TS:           time.Now().UTC().Format(time.RFC3339),
			Kind:         "dispatch",
			Session:      session,
			Seq:          seq,
			Commit:       commit,
			Branch:       branch,
			Role:         d.Role,
			Tier:         d.Tier,
			Tokens:       tokens{In: d.TokensIn, Out: d.TokensOut, Total: d.TokensIn + d.TokensOut},
			TokensSource: d.TokensSource,
			DurationMS:   d.DurationMS,
			Outcome:      d.Outcome,
		}
		if generated {
			e.SessionSource = "generated"
		}

		line, err := json.Marshal(e)
		if err != nil {
			return "", fmt.Errorf("build the event: %w", err)
		}
		line = append(line, '\n')

		sum := sha256.Sum256(line)
		path := "events/" + session + "/" + hex.EncodeToString(sum[:]) + ".json"

		message := fmt.Sprintf("journal: %s %s %d", e.Kind, session, seq)

		err = store(repoDir, tip, path, line, message)
		if err == nil {
			return path, nil
		}
		if !errors.Is(err, errRefMoved) {
			return "", err
		}
		lost = err
	}

	return "", fmt.Errorf("gave up after %d attempts: %w", attempts, lost)
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

// checkText rejects a free text field that is too long to record.
func checkText(name, value string) error {
	if len(value) > maxTextBytes {
		return fmt.Errorf("%s is %d bytes, over the limit of %d", name, len(value), maxTextBytes)
	}

	return nil
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
	stdin := []byte(strings.Join(oids, "\n") + "\n")

	out, err := gitOut(dir, nil, stdin, "cat-file", "--batch")
	if err != nil {
		return 0, err
	}

	return scanBatch(out)
}

// scanBatch reads the output of git cat-file --batch and returns the highest
// seq in it. Each object comes as "<oid> <type> <size>\n", then its bytes,
// then one more newline.
func scanBatch(out string) (int, error) {
	highest := 0

	for len(out) > 0 {
		header, rest, found := strings.Cut(out, "\n")
		if !found {
			return 0, fmt.Errorf("git cat-file gave the header %q, with no newline", header)
		}

		fields := strings.Fields(header)
		if len(fields) != 3 {
			return 0, fmt.Errorf("git cat-file gave the header %q", header)
		}

		size, err := strconv.Atoi(fields[2])
		if err != nil {
			return 0, fmt.Errorf("git cat-file gave the size %q for object %s", fields[2], fields[0])
		}
		if len(rest) < size+1 {
			return 0, fmt.Errorf("git cat-file cut object %s short", fields[0])
		}

		var e struct {
			Seq int `json:"seq"`
		}
		if err := json.Unmarshal([]byte(rest[:size]), &e); err != nil {
			return 0, fmt.Errorf("journal object %s is not valid JSON: %w", fields[0], err)
		}
		if e.Seq > highest {
			highest = e.Seq
		}

		out = rest[size+1:]
	}

	return highest, nil
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

	indexDir, err := os.MkdirTemp("", "groundwork-journal-")
	if err != nil {
		return fmt.Errorf("make a temporary index: %w", err)
	}
	defer os.RemoveAll(indexDir)

	env := []string{"GIT_INDEX_FILE=" + filepath.Join(indexDir, "index")}

	if tip != "" {
		if _, err := gitOut(dir, env, nil, "read-tree", tip); err != nil {
			return err
		}
	}

	// The path in --cacheinfo is read from the root of the repo, not from
	// the current directory, so this works from anywhere in the repo.
	cacheinfo := fmt.Sprintf("100644,%s,%s", blob, path)
	if _, err := gitOut(dir, env, nil, "update-index", "--add", "--cacheinfo", cacheinfo); err != nil {
		return err
	}

	tree, err := gitOut(dir, env, nil, "write-tree")
	if err != nil {
		return err
	}
	tree = strings.TrimSpace(tree)

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

	// The last argument is the value the ref must still hold. An empty
	// string means the ref must not exist yet.
	if _, err := gitOut(dir, nil, nil, "update-ref", Ref, commit, tip); err != nil {
		// Two races land here: another writer moved the ref, or another
		// writer holds its lock this instant. Both mean this attempt lost,
		// so both are worth retrying. A real fault — a broken repo, no
		// permission — fails the same way every time, and the caller
		// reports git's own words once the retries run out.
		return fmt.Errorf("%w: %w", errRefMoved, err)
	}

	return nil
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
