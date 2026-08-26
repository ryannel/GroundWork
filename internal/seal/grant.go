package seal

import (
	"fmt"
	"slices"
	"sort"
	"strings"

	"github.com/ryannel/groundwork/internal/journal"
)

// Grant is one seal to make, as the caller asks for it.
//
// There is no battery field on purpose. The version pair is read from the
// journal's own newest battery run, so a seal cannot claim a version that never
// ran. It is the same rule the dial and the journal's seal line already follow:
// the record is read from the record.
type Grant struct {
	Kind    string
	Subject string

	// Paths are the paths this seal covers, from the repo root. Composition is
	// a longer list here, never a second tag (R3).
	Paths []string
}

// Granted is one seal that was made.
type Granted struct {
	Tag     string
	Target  string
	Covered []Covered

	Battery    string
	BatteryRun string

	// Signature is what the new tag's signature came to. It is always Unsigned:
	// this tool holds no signing key, and R4 says why.
	Signature Signature
}

// GrantSeal makes one seal in the repo at repoDir.
//
// It writes three things, in this order: the annotated tag, the mirror blob on
// the seals branch, and the journal's seal line. The tag comes first because it
// is what the tools read; the mirror and the line describe it.
//
// It is atomic, per D52.2: tag, mirror, journal, or none of them. A step that
// fails after an earlier one succeeded puts every earlier write back. F59 is
// why the tag is undone, and F67 is why the mirror is undone with it — a
// rollback that took the tag down and left the mirror blob moved the wreck onto
// the branch, where the next restore in any clone rebuilt the seal.
//
// One window cannot be closed here. A process killed between two of the three
// writes leaves whatever it had already done, with nothing running to put it
// back. Git has no transaction across two refs, so the only honest thing is to
// name it: after a grant that died, run groundwork seal restore and
// groundwork seal verify and look at what stands.
func GrantSeal(repoDir string, g Grant) (Granted, error) {
	dir, err := root(repoDir)
	if err != nil {
		return Granted{}, err
	}

	tag, err := TagName(g.Kind, g.Subject)
	if err != nil {
		return Granted{}, err
	}

	standing, err := resolve(dir, "refs/tags/"+tag)
	if err != nil {
		return Granted{}, err
	}
	if standing != "" {
		return Granted{}, fmt.Errorf(
			"%s is already granted, and a seal is moved with groundwork seal amend, which prints what changed and demands a reason",
			tag)
	}

	battery, run, err := batteryFor(dir)
	if err != nil {
		return Granted{}, err
	}

	covered, err := coveredAt(dir, g.Paths)
	if err != nil {
		return Granted{}, err
	}

	target, err := resolve(dir, "HEAD^{commit}")
	if err != nil {
		return Granted{}, err
	}
	if target == "" {
		return Granted{}, fmt.Errorf("this repo has no commit, and a seal names one")
	}

	message, err := Message{
		Kind: g.Kind, Subject: g.Subject, Covered: covered,
		Battery: battery, BatteryRun: run,
	}.Render()
	if err != nil {
		return Granted{}, err
	}

	// Asked before the tag is made, so a mirror nobody can write onto never
	// costs a rollback.
	if err := checkMirrorIsClean(dir); err != nil {
		return Granted{}, err
	}

	// The branch tip is read before anything writes to it, because putting it
	// back is only possible against the value it had.
	mirrorWas, err := resolve(dir, mirrorRef)
	if err != nil {
		return Granted{}, err
	}

	if err := writeTag(dir, tag, message, false); err != nil {
		return Granted{}, err
	}

	tagOID, err := resolve(dir, "refs/tags/"+tag)
	if err != nil {
		return Granted{}, err
	}

	undo := grantUndo{tag: tag, tagOID: tagOID, mirrorWas: mirrorWas}

	if err := mirror(dir, tag); err != nil {
		return Granted{}, undo.run(dir, fmt.Errorf("the mirror did not take %s: %w", tag, err))
	}

	undo.mirrorNow, err = resolve(dir, mirrorRef)
	if err != nil {
		return Granted{}, undo.run(dir, err)
	}

	if _, err := journal.WriteSeal(dir, journal.Seal{
		Kind: g.Kind, Tag: tag, Action: "granted",
		Battery: battery, BatteryRun: run,
		Signature: string(Unsigned),
	}); err != nil {
		return Granted{}, undo.run(dir, fmt.Errorf("the journal did not take %s: %w", tag, err))
	}

	return Granted{
		Tag: tag, Target: target, Covered: covered,
		Battery: battery, BatteryRun: run, Signature: Unsigned,
	}, nil
}

// grantUndo is what a grant has written so far, and what it therefore has to
// put back if a later step fails.
//
// Every field is a value read before or just after the write it describes.
// Every one of them is handed to update-ref as the old value, so a rollback can
// only undo this grant's own writes: a ref another writer has moved in the
// meantime is left exactly where they put it.
type grantUndo struct {
	// tag and tagOID are the tag this grant made, and the object it points at.
	tag    string
	tagOID string

	// mirrorWas is the branch tip before the mirror wrote. It is empty when
	// there was no branch, in which case putting it back means deleting it.
	mirrorWas string

	// mirrorNow is the tip the mirror wrote. It is empty when the mirror never
	// got that far.
	mirrorNow string
}

// run puts back what this grant wrote, and returns the error the caller should
// report.
//
// Both writes, or the ones that happened. A rollback that itself fails is said
// out loud beside the first failure: something is then standing with nothing
// describing it, and that is exactly the thing somebody has to be told about.
func (u grantUndo) run(dir string, why error) error {
	var stuck []string

	if u.mirrorNow != "" {
		if err := u.putMirrorBack(dir); err != nil {
			stuck = append(stuck, fmt.Sprintf("%s could not be put back: %s", Branch, say(err.Error())))
		}
	}

	// The old value is passed, so this deletes the tag this grant made and
	// never one somebody else moved into its place.
	if _, err := gitOut(dir, nil, "update-ref", "-d", "refs/tags/"+u.tag, u.tagOID); err != nil {
		stuck = append(stuck, fmt.Sprintf("%s could not be taken down again: %s", u.tag, say(err.Error())))
	}

	if len(stuck) > 0 {
		return fmt.Errorf("%w, and the rollback did not finish: %s", why, strings.Join(stuck, "; "))
	}

	return fmt.Errorf("%w, so the tag and its mirror were put back and no seal was granted", why)
}

// putMirrorBack points the mirror branch at what it held before this grant.
func (u grantUndo) putMirrorBack(dir string) error {
	if u.mirrorWas == "" {
		// There was no branch before this grant, so putting it back means
		// taking it away — and only if it still holds what this grant wrote.
		_, err := gitOut(dir, nil, "update-ref", "-d", mirrorRef, u.mirrorNow)

		return err
	}

	_, err := gitOut(dir, nil, "update-ref", mirrorRef, u.mirrorWas, u.mirrorNow)

	return err
}

// batteryFor reads the version pair a seal is granted under from the journal's
// own newest battery run.
//
// The run has to be green. A seal is a claim that the work stands, and a seal
// granted on a run that had a red row would be that claim made over a failure
// the record already holds.
func batteryFor(dir string) (string, string, error) {
	line, found, err := journal.LatestBattery(dir)
	if err != nil {
		return "", "", err
	}
	if !found {
		return "", "", fmt.Errorf(
			"this journal holds no battery run, and a seal names the battery it was granted under: run groundwork verify first")
	}
	if line.Red() {
		return "", "", fmt.Errorf("the newest battery run %s had %d red, and a seal is granted on a green run",
			clip(line.Run), line.Counts["red"])
	}
	if line.Counts["green"] == 0 {
		// D17: a verifier may never pass on nothing. A run with every count at
		// zero checked nothing, and a seal standing on it stands on nothing.
		return "", "", fmt.Errorf("the newest battery run %s checked nothing, and a seal stands on a run that checked something",
			clip(line.Run))
	}
	if err := checkTrailers(line.Version, line.Run); err != nil {
		return "", "", fmt.Errorf("the newest battery run cannot be recorded on a seal: %w", err)
	}

	return line.Version, line.Run, nil
}

// coveredAt reads each path's blob hash at HEAD.
//
// A path HEAD does not hold as a file is refused by name. A seal that recorded
// a hash for a path that is not there would be red the moment it was made.
//
// A grant with no path at all, and a grant that names one path twice, are both
// refused by checkCovered, which the rendered message goes through. Neither is
// refused twice: two guards over one rule leave one of them with no test that
// can reach it, and the deletion test finds that as a survivor.
func coveredAt(dir string, paths []string) ([]Covered, error) {
	sorted := slices.Clone(paths)
	sort.Strings(sorted)

	for _, path := range sorted {
		if err := checkPath(path); err != nil {
			return nil, err
		}
	}

	at, err := blobsAt(dir, "HEAD", sorted)
	if err != nil {
		return nil, err
	}

	covered := make([]Covered, 0, len(sorted))
	for _, path := range sorted {
		blob, held := at[path]
		if !held {
			return nil, fmt.Errorf("HEAD holds no file at %q, so there is nothing to seal there", clip(path))
		}

		covered = append(covered, Covered{Blob: blob, Path: path})
	}

	return covered, nil
}

// writeTag makes the annotated tag. force replaces one that is already there.
//
// --cleanup=verbatim keeps the message exactly the bytes that were rendered.
// Git's default for a tag strips trailing whitespace, drops leading and
// trailing blank lines, and takes out lines opening with a hash — it does not
// reflow. Any one of those would leave the tag holding something other than
// what the contract says a seal message is.
//
// The tagger is this tool's own identity rather than the repo's git config, for
// the same reason the journal's is: the record names a tool and a session, not
// a person. A person's name on a tag nobody signed would read as their word.
func writeTag(dir, tag, message string, force bool) error {
	args := []string{"tag", "-a", "--cleanup=verbatim", "-F", "-"}
	if force {
		args = append(args, "-f")
	}
	args = append(args, tag)

	_, err := gitEnv(dir, identity(), []byte(message), args...)

	return err
}
