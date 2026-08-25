package battery

import "fmt"

// Default returns the battery the verify verb runs.
//
// Eight rows today. version is the drift check D23 asks for: CI fails when the
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
// reaches nothing.
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

	return reg
}

// versionRow is the drift check. It compares the digest the rows compute
// against the digest the committed lock file declares.
//
// It reads the lock file itself rather than being handed what Run already
// read. The row is the check: a check handed its own answer proves nothing,
// and this way a lock file the tool cannot read fails here, in the open, as
// one red row with the file named.
func versionRow() Row {
	return Row{
		ID:       "version",
		Kind:     "version",
		Severity: Blocking,
		Check: func(c Context) Result {
			lock, err := ReadLock(c.RepoDir)
			if err != nil {
				return Result{Outcome: Red, Evidence: err.Error()}
			}

			if lock.Digest != c.Digest {
				return Result{
					Outcome: Red,
					Evidence: fmt.Sprintf(
						"%s declares the digest %s, but the rows compute %s: the battery moved without a declared bump",
						LockFile, lock.Digest, c.Digest),
				}
			}

			return Result{
				Outcome: Green,
				Evidence: fmt.Sprintf("%s declares %s, and the rows compute the same digest",
					LockFile, VersionString(lock.Version, lock.Digest)),
			}
		},
	}
}
