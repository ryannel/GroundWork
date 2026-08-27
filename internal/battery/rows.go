package battery

import "fmt"

// Default returns the battery the verify verb runs.
//
// Sixteen rows today. version is the drift check D23 asks for: CI fails when the
// digest moves without a declared bump. manifest is the capability manifest
// check: the project declared what it does, and something the stack's adapter
// can see has to prove each one. Then the three scans proof.md names — honesty,
// wiring and token — which read the project's own source rather than running
// it, and catch three of the six ways agents fake done. run-evidence is the
// first row that runs the project rather than reading it: it reconciles the
// tests a surface discovers against the tests its run reported, so that
// execution is evidenced and never inferred. mutate is the deletion test: it
// blanks one exported function at a time in a throwaway copy of the project and
// calls the suite red when the tests survive the implementation being deleted.
// plan is the first row of the planning bet: it reads the plan a repo commits
// and calls it red when a file will not parse, an id repeats, or a reference
// reaches nothing. chain walks the journal itself: every line carries the hash
// of the line before it in its own session, and the row calls it red when one of
// those is missing or does not match. seal-verify recomputes every path a seal
// covers and calls it red when one moved: R3 makes "does the work still match
// what was sealed" a hash comparison rather than a reading. board derives the
// proofs board from the plan, from git's Slice trailers and from a run of the
// proofs themselves, and calls it red when a proof its plan expects green is
// not — never the other way round, because a proof green ahead of its plan is
// the plan lagging the work and it is flagged rather than blamed. stub reads
// that same board and judges the reds: a proof the plan expects red has to fail
// at a real assertion, and one that passes with a test that cannot fail, that
// skips, that will not build or that dies before its assertion is red with the
// reason named. trace reads the plan in both directions: every proof's design
// anchor has to resolve, and every facing item a bet declares has to be claimed
// by exactly one of its slices or deferred with a reason — and beside those it
// reads the record for the artifacts a bet stands on, naming every bet whose
// premises point at one the record says was amended or withdrawn. record judges
// the records a plan declares and only those: a declared path that is not there,
// or whose last commit predates the work it describes, is red. waiver-count
// reads how often each row has been waived, from the waiver files' own git
// history, and holds a row that has been waived too often red until a finding
// names it. history reads the shape of the repo's own commits, and calls it red
// when a commit swallowed the Slice trailers a squash erases.
//
// Order is registration order, and it is the order the digest is computed in,
// so a row joins the end of this list rather than the middle of it.
//
// Each call builds a fresh registry. A caller that registers an extra row for
// its own purposes must not change what the next caller runs.
func Default() *Registry {
	reg := NewRegistry()
	reg.Register(versionRow())
	reg.Register(manifestRow())
	reg.Register(honestyRow())
	reg.Register(wiringRow())
	reg.Register(tokenRow())
	reg.Register(runEvidenceRow())
	reg.Register(mutateRow())
	reg.Register(planRow())
	reg.Register(chainRow())
	reg.Register(sealRow())
	reg.Register(boardRow())
	reg.Register(stubRow())
	reg.Register(traceRow())
	reg.Register(recordRow())
	reg.Register(waiverCountRow())
	reg.Register(historyRow())

	return reg
}

// versionRow is the drift check. It compares the digest the rows compute
// against the digest the committed lock file declares.
//
// It reads the lock file itself rather than being handed what Run already
// read. The row is the check: a check handed its own answer proves nothing,
// and this way a lock file the tool cannot read fails here, in the open, as
// one red row with the file named.
//
// The read is HEAD's blob, per R15. An uncommitted battery version is not one
// anybody can be held to, so a bump sitting in the working tree is drift and
// says so — which is the honest answer, and the one CI has always given, since
// CI reads committed content already.
//
// Three reds, and they are separate on purpose. A committed lock nobody can
// read is one. A working tree that does not agree with HEAD is the second —
// whether it declares a different pair or will not read at all — and it is
// named as the uncommitted bump it usually is. The digest disagreeing with the
// rows is the third, which is the drift D23 asked for.
func versionRow() Row {
	return Row{
		ID:       "version",
		Kind:     "version",
		Severity: Blocking,
		Check:    checkVersionRow,
	}
}

func checkVersionRow(c Context) Result {
	head, err := ReadLockAtHead(c.RepoDir)
	if err != nil {
		return Result{Outcome: Red, Evidence: cut(err.Error())}
	}

	tree, err := ReadLock(c.RepoDir)
	if err != nil {
		return Result{
			Outcome: Red,
			Evidence: cut(fmt.Sprintf("HEAD declares %s, and the working tree's %s does not read: %v",
				VersionString(head.Version, head.Digest), LockFile, err)),
		}
	}

	if tree != head {
		return Result{
			Outcome: Red,
			Evidence: cut(fmt.Sprintf(
				"the working tree's %s declares %s and HEAD declares %s: an uncommitted battery version is not one anybody can be held to",
				LockFile, VersionString(tree.Version, tree.Digest), VersionString(head.Version, head.Digest))),
		}
	}

	if head.Digest != c.Digest {
		return Result{
			Outcome: Red,
			Evidence: fmt.Sprintf(
				"%s declares the digest %s, but the rows compute %s: the battery moved without a declared bump",
				LockFile, head.Digest, c.Digest),
		}
	}

	return Result{
		Outcome: Green,
		Evidence: fmt.Sprintf("%s declares %s at HEAD, and the rows compute the same digest",
			LockFile, VersionString(head.Version, head.Digest)),
	}
}
