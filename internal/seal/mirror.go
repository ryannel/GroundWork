package seal

import (
	"fmt"
	"os"
	"path/filepath"
	"sort"
	"strings"
)

// The mirror is R5's answer to the host limit.
//
// The host's git proxy refuses pushes outside refs/heads, so a seal tag cannot
// travel as a tag. Each tag's raw object bytes are stored as a blob on the
// branch groundwork-seals, one file per tag name, with a small index. Restore
// hands those bytes back to git hash-object -t tag -w, which reproduces the
// same object id — so an owner's signature survives the round trip byte for
// byte.
//
// The branch is a mirror, not a second record. The tag stays the thing the
// tools read, and nothing here ever writes a tag ref except Restore, which only
// puts back a name that is free.

// RestoreStatus is what a restore did with one mirrored tag.
type RestoreStatus string

// The three things a restore can do with a tag, and it does exactly one.
const (
	// RestoreDone: the name was free, and the tag is back at its own object id.
	RestoreDone RestoreStatus = "restored"

	// RestoreAlready: the tag was already standing at that object. Nothing was
	// written, and saying so beats reporting a restore that did nothing.
	RestoreAlready RestoreStatus = "already there"

	// RestoreMismatch: something else stands at that name, or the mirror's own
	// bytes do not hash to the object the index claims. Neither is overwritten.
	RestoreMismatch RestoreStatus = "mismatched"
)

// Ignored is one file on the mirror branch that is not a mirrored seal tag.
//
// It is reported rather than fatal. The branch is the one R5 makes pushable on
// purpose, so anyone who can push can leave a file there — and a restore that
// stopped because a listing was scribbled on would be a way to stop one (F59,
// D52.1). The name check has not gone anywhere: it still decides that no ref is
// written for this file.
type Ignored struct {
	Path string
	Why  string
}

// Restored is what a restore did with one tag.
type Restored struct {
	Tag    string
	OID    string
	Status RestoreStatus

	// Why says what went wrong, on a mismatch. It is empty otherwise.
	Why string
}

// Restoration is one whole restore.
type Restoration struct {
	// HasMirror says whether the branch is there at all. A clone that never
	// granted a seal has no mirror, and that is not a fault.
	HasMirror bool

	Tags []Restored

	// Ignored is every file on the branch that is not a mirrored seal tag.
	Ignored []Ignored
}

// Restore rehydrates every mirrored seal tag in the repo at repoDir.
//
// A name already taken by a different object is never overwritten. The mirror
// is a mirror: a restore that clobbered a local tag would quietly make the
// branch the record instead.
func Restore(repoDir string) (Restoration, error) {
	dir, err := root(repoDir)
	if err != nil {
		return Restoration{}, err
	}

	tip, err := resolve(dir, mirrorRef)
	if err != nil {
		return Restoration{}, err
	}
	if tip == "" {
		return Restoration{}, nil
	}

	held, ignored, err := mirrorTags(dir, tip)
	if err != nil {
		return Restoration{}, err
	}

	index, err := mirrorIndex(dir, tip)
	if err != nil {
		return Restoration{}, err
	}

	res := Restoration{HasMirror: true, Ignored: ignored}
	for _, tag := range sortedKeys(held) {
		res.Tags = append(res.Tags, restoreOne(dir, tag, held[tag], index[tag]))
	}

	return res, nil
}

// restoreOne puts one mirrored tag back, or says why it did not.
//
// The bytes name the tag: a tag object carries its own name in a tag header.
// That name is compared to the file the bytes were stored under before any ref
// is written, because a file name is somebody's to choose and the bytes are
// not. F63 caught a lie here being reported as a restore.
func restoreOne(dir, tag, raw, claimed string) Restored {
	if named := nameInTag(raw); named != tag {
		return Restored{
			Tag: tag, Status: RestoreMismatch,
			Why: fmt.Sprintf("these bytes name the tag %s, and the mirror files them under %s",
				clip(named), clip(tag)),
		}
	}

	written, err := writeTagObject(dir, raw)
	if err != nil {
		return Restored{Tag: tag, Status: RestoreMismatch, Why: say(err.Error())}
	}

	if claimed != "" && claimed != written {
		return Restored{
			Tag: tag, OID: written, Status: RestoreMismatch,
			Why: fmt.Sprintf("the mirror's index names %s and its bytes hash to %s", claimed, written),
		}
	}

	standing, err := resolve(dir, "refs/tags/"+tag)
	if err != nil {
		return Restored{Tag: tag, OID: written, Status: RestoreMismatch, Why: say(err.Error())}
	}

	switch standing {
	case written:
		return Restored{Tag: tag, OID: written, Status: RestoreAlready}
	case "":
		if _, err := gitOut(dir, nil, "update-ref", "refs/tags/"+tag, written); err != nil {
			return Restored{Tag: tag, OID: written, Status: RestoreMismatch, Why: say(err.Error())}
		}

		return Restored{Tag: tag, OID: written, Status: RestoreDone}
	default:
		return Restored{
			Tag: tag, OID: written, Status: RestoreMismatch,
			Why: fmt.Sprintf("%s already stands at that name, and the mirror holds %s", standing, written),
		}
	}
}

// nameInTag reads the name a tag object gives itself.
//
// A tag object opens with headers, one per line, and one of them is
// "tag <name>". An object with no such header names nothing, and nothing
// matches no file name.
func nameInTag(raw string) string {
	head, _, found := strings.Cut(raw, "\n\n")
	if !found {
		return ""
	}

	for _, line := range strings.Split(head, "\n") {
		if name, found := strings.CutPrefix(line, "tag "); found {
			return name
		}
	}

	return ""
}

// writeTagObject writes raw tag bytes into the repo and returns the object id
// git gave them. The id is the hash of the bytes, so the same bytes always come
// back at the same id.
func writeTagObject(dir, raw string) (string, error) {
	out, err := gitOut(dir, []byte(raw), "hash-object", "-t", "tag", "-w", "--stdin")
	if err != nil {
		return "", err
	}

	return strings.TrimSpace(out), nil
}

// mirrorRef is the branch the mirror lives on, as a ref.
const mirrorRef = "refs/heads/" + Branch

// mirror stores one tag's own bytes on the mirror branch.
func mirror(repoDir, tag string) error {
	return mirrorWith(repoDir, tag, nil)
}

// checkMirrorIsClean refuses to write onto a mirror holding a file that is not
// a mirrored seal tag, and names the file.
//
// The reader is permissive and the writer is strict, on purpose. A restore has
// to rehydrate what is there, junk beside it or not, or one pushed file turns
// off every seal in the repo. New work is different: granting onto a branch
// somebody has scribbled on stops until a person has looked at it. It stops
// here, before the tag is made, so there is no half-made seal to clean up.
func checkMirrorIsClean(dir string) error {
	tip, err := resolve(dir, mirrorRef)
	if err != nil {
		return err
	}
	if tip == "" {
		return nil
	}

	_, ignored, err := mirrorTags(dir, tip)
	if err != nil {
		return err
	}
	if len(ignored) > 0 {
		return fmt.Errorf("%s holds %s, which is not a mirrored seal tag: %s",
			Branch, ignored[0].Path, ignored[0].Why)
	}

	return nil
}

// mirrorWith stores one tag's own bytes on the mirror branch, and files the tag
// it replaced under the prior directory when there was one.
//
// R6 asks for the prior target to be recorded. The tag object that was there is
// the only evidence of what the seal used to cover, and moving the ref would
// otherwise leave nothing behind.
func mirrorWith(repoDir, tag string, prior map[string]string) error {
	dir, err := root(repoDir)
	if err != nil {
		return err
	}
	if err := checkTagName(tag); err != nil {
		return err
	}

	raw, err := rawTag(dir, tag)
	if err != nil {
		return err
	}

	add := map[string]string{TagDir + tag: raw}
	for oid, bytes := range prior {
		add[PriorDir+tag+"/"+oid] = bytes
	}

	return updateMirror(dir, add, "seal: mirror "+tag)
}

// updateMirror adds files to the mirror branch and rewrites its index.
//
// It builds the tree in an index of its own, so the repo's own index and
// working tree stay where they are. The branch moves only if it is still where
// it was read, so a concurrent write fails rather than being overwritten.
func updateMirror(dir string, add map[string]string, message string) error {
	tip, err := resolve(dir, mirrorRef)
	if err != nil {
		return err
	}

	tree, err := inTempIndex(dir, func(env []string) error {
		if tip != "" {
			if _, err := gitEnv(dir, env, nil, "read-tree", tip); err != nil {
				return err
			}
		}

		return putAll(dir, env, add)
	})
	if err != nil {
		return err
	}

	// The index is rewritten from the tree that was just built, so it always
	// says what the mirror actually holds rather than what a caller believed.
	held, _, err := mirrorTags(dir, tree)
	if err != nil {
		return err
	}

	index, err := indexFor(dir, held)
	if err != nil {
		return err
	}

	tree, err = inTempIndex(dir, func(env []string) error {
		if _, err := gitEnv(dir, env, nil, "read-tree", tree); err != nil {
			return err
		}

		return putAll(dir, env, map[string]string{IndexFile: index})
	})
	if err != nil {
		return err
	}

	args := []string{"commit-tree", tree}
	if tip != "" {
		args = append(args, "-p", tip)
	}
	args = append(args, "-m", message)

	commit, err := gitEnv(dir, identity(), nil, args...)
	if err != nil {
		return err
	}
	commit = strings.TrimSpace(commit)

	_, err = gitOut(dir, nil, "update-ref", mirrorRef, commit, tip)

	return err
}

// putAll writes each file into the temporary index git's env points at.
func putAll(dir string, env []string, add map[string]string) error {
	for _, path := range sortedKeys(add) {
		blob, err := gitEnv(dir, env, []byte(add[path]), "hash-object", "-w", "-t", "blob", "--stdin")
		if err != nil {
			return err
		}

		cacheinfo := fmt.Sprintf("100644,%s,%s", strings.TrimSpace(blob), path)
		if _, err := gitEnv(dir, env, nil, "update-index", "--add", "--cacheinfo", cacheinfo); err != nil {
			return err
		}
	}

	return nil
}

// indexFor renders the mirror's index: one line of "<oid> <tag>", sorted by
// tag, for every tag the mirror holds.
func indexFor(dir string, held map[string]string) (string, error) {
	var b strings.Builder
	for _, tag := range sortedKeys(held) {
		oid, err := writeTagObject(dir, held[tag])
		if err != nil {
			return "", err
		}

		fmt.Fprintf(&b, "%s %s\n", oid, tag)
	}

	return b.String(), nil
}

// mirrorTags reads every mirrored tag out of a tree, as tag name to raw bytes.
// It also returns every file it would not read as one.
//
// A file whose name is not a seal tag's is skipped and reported, never fatal —
// D52.1, and the same policy mirrorIndex already took for the same class. The
// branch is pushable on purpose, so one scribbled file must not take every
// other tag with it. The name check still bites where it matters: nothing here
// puts a bad name in the map, so no ref is ever written for one.
func mirrorTags(dir, tree string) (map[string]string, []Ignored, error) {
	out, err := gitOut(dir, nil, "ls-tree", "-r", "-z", "--full-tree", tree, "--", TagDir)
	if err != nil {
		return nil, nil, err
	}

	held := map[string]string{}
	var ignored []Ignored

	for _, entry := range strings.Split(out, "\x00") {
		if entry == "" {
			continue
		}

		head, path, found := strings.Cut(entry, "\t")
		if !found {
			return nil, nil, fmt.Errorf("git ls-tree gave the entry %q", clip(entry))
		}

		fields := strings.Fields(head)
		if len(fields) != 3 {
			return nil, nil, fmt.Errorf("git ls-tree gave the entry %q", clip(entry))
		}
		if fields[1] != "blob" {
			continue
		}

		tag := strings.TrimPrefix(path, TagDir)
		if err := checkTagName(tag); err != nil {
			ignored = append(ignored, Ignored{Path: clip(path), Why: say(err.Error())})

			continue
		}

		raw, err := gitOut(dir, nil, "cat-file", "blob", fields[2])
		if err != nil {
			return nil, nil, err
		}
		held[tag] = raw
	}

	return held, ignored, nil
}

// mirrorIndex reads the mirror's index: tag name to the object id it claims.
//
// A line that will not read is skipped rather than failing the restore. The
// index is a convenience; the bytes under tags/ are the record, and a restore
// that stopped because a listing was scribbled on would be a way to stop one.
func mirrorIndex(dir, tip string) (map[string]string, error) {
	// Whether the file is there is asked of the tree, not read off an exit
	// code. cat-file exits 128 for a path a tree does not hold, which is the
	// code it also uses for real trouble — F63 found the guard here checking
	// for 1 and therefore never firing at all. The tree answers the question
	// directly, and a mirror with tags and no index is an ordinary state.
	held, err := gitOut(dir, nil, "ls-tree", "-z", "--full-tree", tip, "--", IndexFile)
	if err != nil {
		return nil, err
	}
	if strings.TrimSpace(held) == "" {
		return map[string]string{}, nil
	}

	out, err := gitOut(dir, nil, "cat-file", "blob", tip+":"+IndexFile)
	if err != nil {
		return nil, err
	}

	claimed := map[string]string{}
	for _, line := range strings.Split(out, "\n") {
		oid, tag, found := strings.Cut(line, " ")
		if !found || checkTagName(tag) != nil {
			continue
		}
		claimed[tag] = oid
	}

	return claimed, nil
}

// CheckTagName rejects a name that is not a seal tag's. It is exported for the
// verb, which refuses a name before it reads anything under it.
func CheckTagName(tag string) error {
	return checkTagName(tag)
}

// checkTagName rejects a name that is not a seal tag's.
//
// A mirrored file's name becomes a ref name on restore. Reading it as a seal
// tag — the prefix, one of the four kinds, one subject id — is what stops a
// scribbled path from naming any other ref.
func checkTagName(tag string) error {
	rest, found := strings.CutPrefix(tag, tagPrefix)
	if !found {
		return fmt.Errorf("the tag %q does not open with %q", clip(tag), tagPrefix)
	}

	kind, subject, found := strings.Cut(rest, "/")
	if !found {
		return fmt.Errorf("the tag %q does not name a kind and a subject", clip(tag))
	}

	named, err := TagName(kind, subject)
	if err != nil {
		return err
	}
	if named != tag {
		return fmt.Errorf("the tag %q is not the name %q that its own kind and subject make", clip(tag), named)
	}

	return nil
}

// inTempIndex builds a git tree in an index of its own and returns the tree.
//
// fill runs the git commands that put the entries in place. It is handed the
// environment that points git at the temporary index, and passes that on to
// every call it makes. The repo's own index and working tree are never touched,
// so this is safe to run at any moment.
func inTempIndex(dir string, fill func(env []string) error) (string, error) {
	indexDir, err := os.MkdirTemp("", "groundwork-seal-index-")
	if err != nil {
		return "", fmt.Errorf("make a temporary index: %w", err)
	}
	defer os.RemoveAll(indexDir)

	env := []string{"GIT_INDEX_FILE=" + filepath.Join(indexDir, "index")}

	if err := fill(env); err != nil {
		return "", err
	}

	tree, err := gitEnv(dir, env, nil, "write-tree")
	if err != nil {
		return "", err
	}

	return strings.TrimSpace(tree), nil
}

// identity is the author and committer on mirror commits. The mirror records a
// tag, not a person, so it does not use the repo's git config.
func identity() []string {
	return []string{
		"GIT_AUTHOR_NAME=groundwork",
		"GIT_AUTHOR_EMAIL=groundwork@localhost",
		"GIT_COMMITTER_NAME=groundwork",
		"GIT_COMMITTER_EMAIL=groundwork@localhost",
	}
}

// sortedKeys returns a map's keys in order, so what this package writes is the
// same whichever order a map happened to hand them over.
func sortedKeys[V any](m map[string]V) []string {
	keys := make([]string, 0, len(m))
	for key := range m {
		keys = append(keys, key)
	}
	sort.Strings(keys)

	return keys
}
