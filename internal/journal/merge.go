package journal

import (
	"fmt"
	"strings"
)

// MergeOutcome says what a merge did to the journal ref.
type MergeOutcome string

const (
	// AlreadyMerged means the local journal already holds the other commit.
	// Nothing was written and the ref did not move.
	AlreadyMerged MergeOutcome = "already merged"

	// FastForwarded means the ref moved straight to the other commit. The
	// local journal held nothing the other one did not already have, so no
	// merge commit was needed.
	FastForwarded MergeOutcome = "fast-forwarded"

	// Merged means a new commit joined the two journals. It carries both
	// tips as parents, the local one first.
	Merged MergeOutcome = "merged"
)

// MergeResult reports what one merge did.
//
// Local and Other count the lines each side held going in. Total counts the
// lines the ref holds coming out. A line in both sides is counted once in
// Total, so Total is usually smaller than Local plus Other.
type MergeResult struct {
	Outcome MergeOutcome
	Tip     string
	Local   int
	Other   int
	Total   int
}

// Merge joins the journal commit named by rev into the journal of the repo at
// repoDir. rev is anything git resolves to a commit; the usual one is a ref
// fetched from another clone.
//
// The journal ref is one per repo, so two branches in one repo share it and
// never diverge. Two clones do. That is what this merges.
//
// Nothing has to be resolved. A line's path is the hash of the line, so the
// same path can only ever mean the same content, and the two trees join as a
// plain union. The merge proves that rather than trusting it: a union that
// changes or drops any line already held here is refused.
//
// Consequence of D13, which anyone reading a merged journal should know: the
// dial chain is repo-global and ordered by the clock. Two clones that dialled
// the same scope while apart each read its from value off its own side alone.
// After the merge, replaying the chain over the union can disagree with the
// from values already recorded in those lines. The chain is best-effort across
// clones. The lines themselves are exact; the chain drawn through them is not.
//
// Merge is read-only outside the ref. It never touches the working tree, the
// repo's index, or any other ref. Everything but the journal ref stays where
// it is.
func Merge(repoDir, rev string) (MergeResult, error) {
	if err := checkRepo(repoDir); err != nil {
		return MergeResult{}, err
	}

	other, err := commitOf(repoDir, rev)
	if err != nil {
		return MergeResult{}, err
	}

	otherLines, err := countLines(repoDir, other)
	if err != nil {
		return MergeResult{}, err
	}

	// A commit with no events is not a journal. Taking one would point the
	// ref at ordinary history, and its paths would carry no promise about
	// their content. So it is refused rather than merged.
	if otherLines == 0 {
		return MergeResult{}, fmt.Errorf(
			"%s holds no events, so it is not a journal commit", rev)
	}

	// Another writer may move the ref between the read and the write. When
	// that happens the attempt is thrown away and a fresh one is built on the
	// tip that won.
	return retryOnRace(func() (MergeResult, error) {
		return mergeOnce(repoDir, other, otherLines)
	})
}

// mergeOnce is one attempt at the merge. It reads the journal ref, works out
// what the merge needs, and moves the ref only if it is still where it was.
func mergeOnce(dir, other string, otherLines int) (MergeResult, error) {
	local, err := resolve(dir, Ref)
	if err != nil {
		return MergeResult{}, err
	}

	localLines := 0
	fastForward := true

	if local != "" {
		localLines, err = countLines(dir, local)
		if err != nil {
			return MergeResult{}, err
		}

		held, err := isAncestor(dir, other, local)
		if err != nil {
			return MergeResult{}, err
		}
		if held {
			return MergeResult{
				Outcome: AlreadyMerged,
				Tip:     local,
				Local:   localLines,
				Other:   otherLines,
				Total:   localLines,
			}, nil
		}

		fastForward, err = isAncestor(dir, local, other)
		if err != nil {
			return MergeResult{}, err
		}
	}

	// The local journal holds nothing of its own, so the other commit already
	// carries every line. A merge commit here would record a join that did
	// not happen.
	if fastForward {
		// Descending from our tip is not the same as keeping what our tip
		// held: a commit built on top of it can still rewrite a line. So the
		// same guard runs here as on a union. With no local ref there is
		// nothing yet to protect.
		if local != "" {
			if err := checkAgainstLocal(dir, local, other); err != nil {
				return MergeResult{}, err
			}
		}

		if err := moveRef(dir, other, local); err != nil {
			return MergeResult{}, err
		}

		return MergeResult{
			Outcome: FastForwarded,
			Tip:     other,
			Local:   localLines,
			Other:   otherLines,
			Total:   otherLines,
		}, nil
	}

	tree, err := unionTree(dir, local, other)
	if err != nil {
		return MergeResult{}, err
	}

	if err := checkAgainstLocal(dir, local, tree); err != nil {
		return MergeResult{}, err
	}

	total, err := countLines(dir, tree)
	if err != nil {
		return MergeResult{}, err
	}

	message := fmt.Sprintf("journal: merge %s", other)

	commit, err := gitOut(dir, identity(), nil,
		"commit-tree", tree, "-p", local, "-p", other, "-m", message)
	if err != nil {
		return MergeResult{}, err
	}
	commit = strings.TrimSpace(commit)

	if err := moveRef(dir, commit, local); err != nil {
		return MergeResult{}, err
	}

	return MergeResult{
		Outcome: Merged,
		Tip:     commit,
		Local:   localLines,
		Other:   otherLines,
		Total:   total,
	}, nil
}

// commitOf resolves a commit-ish to the commit it names. A tag is peeled down
// to its commit. Anything that is not a commit, and any name the repo does not
// hold, is an error that names what was asked for.
func commitOf(dir, rev string) (string, error) {
	// --end-of-options keeps a name that starts with a dash from being read
	// as an option.
	out, err := gitLine(dir, "rev-parse", "--verify", "--quiet", "--end-of-options", rev+"^{commit}")
	if err != nil {
		if !missing(err) {
			return "", err
		}
		out = ""
	}
	if out == "" {
		// Both cases land here: a name the repo does not hold, and a name that
		// holds something other than a commit. The caller can see which by
		// looking, and one plain sentence covers both.
		return "", fmt.Errorf("%s is not a commit this repo holds", rev)
	}

	return out, nil
}

// countLines returns how many event lines a commit or tree holds.
func countLines(dir, treeish string) (int, error) {
	// --full-tree keeps the path meaning the same from any directory in the
	// repo, matching how the rest of the package reads the tree.
	out, err := gitOut(dir, nil, nil,
		"ls-tree", "-r", "-z", "--full-tree", treeish, "--", "events/")
	if err != nil {
		return 0, err
	}

	oids, err := treeOIDs(out)
	if err != nil {
		return 0, err
	}

	return len(oids), nil
}

// isAncestor reports whether one commit is reachable from another. A commit is
// its own ancestor, so this is also how a merge of a journal into itself is
// caught.
func isAncestor(dir, ancestor, descendant string) (bool, error) {
	if _, err := gitLine(dir, "merge-base", "--is-ancestor", ancestor, descendant); err != nil {
		// git says no by exiting 1. Anything higher is real trouble.
		if missing(err) {
			return false, nil
		}
		return false, err
	}

	return true, nil
}

// unionTree builds the tree that holds every path from both commits.
//
// A path in both sides carries the same blob in both. A line's path is the
// hash of the line itself, so the same path can only ever mean the same
// content. That is what makes the union safe with nothing to resolve, and it
// is why the other side's entries can simply be laid over the local ones.
//
// The word "can" is doing work there. The other side arrives over the wire,
// so this builds the union and then checks it, in checkOnlyAdds. It is not
// taken on trust.
func unionTree(dir, local, other string) (string, error) {
	// The whole tree, not just events/. Today a journal commit holds nothing
	// else, and a later bet that adds a path gets it carried across a merge
	// rather than dropped.
	entries, err := gitOut(dir, nil, nil, "ls-tree", "-r", "-z", "--full-tree", other)
	if err != nil {
		return "", err
	}

	return inTempIndex(dir, func(env []string) error {
		if _, err := gitOut(dir, env, nil, "read-tree", local); err != nil {
			return err
		}

		// ls-tree -z writes "<mode> <type> <oid>\t<path>", NUL after each
		// entry, which is one of the forms update-index --index-info reads.
		_, err := gitOut(dir, env, []byte(entries), "update-index", "-z", "--index-info")

		return err
	})
}

// checkAgainstLocal refuses a tree that does anything to what the journal
// already holds except add to it. local is the journal's own tip; next is the
// tree the merge wants to move to.
//
// A merge takes a commit that came from somewhere else, so what it holds is
// not this repo's word. If the other side carries a different blob at a path
// this repo already has, moving there would rewrite a recorded line; if it
// carries a tree where this repo has a line, it would drop one. Both mean the
// incoming commit is not a journal built the way D8 says, and the only safe
// answer is to refuse the whole merge.
//
// Every path in the difference must therefore be an addition. The check names
// the first path that is not.
func checkAgainstLocal(dir, local, next string) error {
	localTree, err := resolve(dir, local+"^{tree}")
	if err != nil {
		return err
	}

	return checkOnlyAdds(dir, localTree, next)
}

// checkOnlyAdds compares two trees and refuses anything but additions.
func checkOnlyAdds(dir, localTree, unionTree string) error {
	// -z so a path is never quoted or split, and rename detection stays off,
	// which keeps the statuses to the plain ones.
	out, err := gitOut(dir, nil, nil,
		"diff-tree", "-r", "-z", "--name-status", localTree, unionTree)
	if err != nil {
		return err
	}

	// -z writes the status and the path as their own NUL-terminated fields,
	// in pairs.
	fields := strings.Split(out, "\x00")
	for i := 0; i+1 < len(fields); i += 2 {
		status, path := fields[i], fields[i+1]
		if status != "A" {
			return fmt.Errorf(
				"the other journal changes %s, which this journal already holds, so it is not a journal to merge",
				path)
		}
	}

	return nil
}
