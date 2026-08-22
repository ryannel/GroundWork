package battery

import "fmt"

// Default returns the battery the verify verb runs.
//
// It holds one row today: version, the drift check. That row is not a
// placeholder. D23 asks CI to fail when the digest moves without a declared
// bump, and this is the check that does it — so the verb has one honest row
// from the day it ships, and never a run of nothing.
//
// Each call builds a fresh registry. A caller that registers an extra row for
// its own purposes must not change what the next caller runs.
func Default() *Registry {
	reg := NewRegistry()
	reg.Register(versionRow())

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
