package battery

import (
	"bytes"
	"encoding/json"
	"errors"
	"fmt"
	"io/fs"
	"os"
	"path/filepath"
	"strings"

	"github.com/ryannel/groundwork/internal/journal"
)

// LockFile is the committed file that declares the battery version, named
// from the repo root. D23 puts it there.
const LockFile = ".groundwork-battery.json"

// maxVersionBytes caps the declared half of a version. A real MAJOR.MINOR is
// a handful of bytes. The cap is checked before anything prints the value
// back, so a lock file holding ten thousand digits cannot turn into an error
// message ten thousand bytes long.
const maxVersionBytes = 32

// digestBytes is how many hex digits of the sha256 a digest carries, after
// its leading r. D23 fixes it at seven.
const digestBytes = 7

// unknownVersion stands in for the declared half when the lock file cannot be
// read. A run still reports a version pair, and this says plainly that half
// of it is not known rather than inventing a number.
const unknownVersion = "unknown"

// Lock is what the lock file declares: the readable half of the version, and
// the digest of the row manifest it was declared against.
type Lock struct {
	Version string `json:"version"`
	Digest  string `json:"digest"`
}

// LockPath returns the absolute path of the lock file for the repo dir sits
// in. dir may be any directory inside the repo, however deep: the lock file
// lives at the root, and a verify run from a subdirectory has to read the
// same file as one run from the top.
// Outside a repository it returns journal.ErrNotARepo, unwrapped, so a caller
// that only prints the error still says the plain thing.
func LockPath(dir string) (string, error) {
	root, err := journal.RepoRoot(dir)
	if err != nil {
		return "", err
	}

	return filepath.Join(root, LockFile), nil
}

// ReadLock reads and checks the lock file of the repo dir sits in.
//
// The lock file is written by hand and committed, so every shape a hand can
// produce is refused plainly rather than believed: a missing file, an empty
// one, JSON that is not an object, a field that is not there, a field spelled
// wrong, a digest of the wrong shape, a version that is not MAJOR.MINOR. Each
// error names the lock file, because the reader's next move is to open it.
func ReadLock(dir string) (Lock, error) {
	path, err := LockPath(dir)
	if err != nil {
		return Lock{}, err
	}

	raw, err := os.ReadFile(path)
	if err != nil {
		// Only the reason is kept, not the absolute path os.ReadFile puts in
		// front of it. This error becomes a row's evidence, and evidence is
		// capped: a repo nested deep enough would push the reason off the end
		// of the line. The file is named already, from the repo root.
		return Lock{}, fmt.Errorf("could not read the lock file %s: %w", LockFile, reasonOnly(err))
	}

	return parseLock(raw)
}

// ReadLockAtHead reads and checks the lock file as HEAD holds it.
//
// R15 puts the version row on this read, the same read a covered path gets: an
// uncommitted battery version is not one anybody can be held to. CI is
// unaffected, because CI already reads committed content.
//
// It is the same parser as the working tree's read, so the two can never
// disagree about what a lock file is (D54 ruling 1). What they can disagree
// about is what this repo declares, and that disagreement is the version row's
// own red.
func ReadLockAtHead(dir string) (Lock, error) {
	root, err := journal.RepoRoot(dir)
	if err != nil {
		return Lock{}, err
	}

	raw, err := journal.BlobAt(root, "HEAD", LockFile)
	if errors.Is(err, journal.ErrNoBlob) {
		return Lock{}, fmt.Errorf(
			"nothing commits the lock file %s, and an uncommitted battery version is not one anybody can be held to",
			LockFile)
	}
	if err != nil {
		return Lock{}, fmt.Errorf("could not read the committed lock file %s: %w", LockFile, err)
	}

	return parseLock(raw)
}

// parseLock reads the bytes of a lock file into its two fields.
func parseLock(raw []byte) (Lock, error) {
	// Unknown fields are refused. The schema is two fields and it is fixed, so
	// an unrecognised key is a typo — and a typo that was ignored would leave
	// the real field empty and the reader looking at a file that seems right.
	dec := json.NewDecoder(bytes.NewReader(raw))
	dec.DisallowUnknownFields()

	var lock Lock
	if err := dec.Decode(&lock); err != nil {
		return Lock{}, fmt.Errorf("the lock file %s is not valid JSON holding a version and a digest: %w",
			LockFile, err)
	}

	// The decoder stops at the end of the first value and is happy to leave
	// the rest of the file behind it. So a file holding one good object and
	// then anything at all — a second object, a stray word — would verify
	// green while the reader saw something else entirely. Nothing may follow.
	if dec.More() {
		return Lock{}, fmt.Errorf("the lock file %s holds more than one thing: it must be one JSON object and nothing after it",
			LockFile)
	}

	if err := checkVersion(lock.Version); err != nil {
		return Lock{}, fmt.Errorf("the lock file %s: %w", LockFile, err)
	}
	if err := checkDigest(lock.Digest); err != nil {
		return Lock{}, fmt.Errorf("the lock file %s: %w", LockFile, err)
	}

	return lock, nil
}

// reasonOnly strips the operation and the path off a file error, leaving why
// it failed. A path error that is not one of those comes back unchanged.
func reasonOnly(err error) error {
	var pathErr *fs.PathError
	if errors.As(err, &pathErr) {
		return pathErr.Err
	}

	return err
}

// VersionString pairs the declared half of a version with the digest of the
// rows, the way D23 writes it: 1.0+r3f9c1ab.
func VersionString(declared, digest string) string {
	return declared + "+" + digest
}

// checkVersion rejects a declared version that is not MAJOR.MINOR.
//
// The length is checked first, so a runaway value is refused on its size and
// never printed back.
func checkVersion(version string) error {
	if version == "" {
		return fmt.Errorf("has no version")
	}
	if len(version) > maxVersionBytes {
		return fmt.Errorf("has a version of %d bytes, over the limit of %d",
			len(version), maxVersionBytes)
	}

	major, minor, found := strings.Cut(version, ".")
	if !found {
		return fmt.Errorf("has the version %q, which is not MAJOR.MINOR", version)
	}
	for _, half := range []string{major, minor} {
		if !isNumber(half) {
			return fmt.Errorf("has the version %q, which is not MAJOR.MINOR", version)
		}
	}

	return nil
}

// isNumber reports whether a half of a version is a plain decimal number with
// no leading zeros. Leading zeros are refused so that 01.0 and 1.0 cannot be
// two spellings of one version.
func isNumber(half string) bool {
	if half == "" {
		return false
	}
	if len(half) > 1 && half[0] == '0' {
		return false
	}

	for _, r := range half {
		if r < '0' || r > '9' {
			return false
		}
	}

	return true
}

// checkDigest rejects a digest that is not r followed by seven lowercase hex
// digits.
func checkDigest(digest string) error {
	if digest == "" {
		return fmt.Errorf("has no digest")
	}

	shaped := len(digest) == digestBytes+1 && digest[0] == 'r'
	if shaped {
		for _, r := range digest[1:] {
			if !((r >= '0' && r <= '9') || (r >= 'a' && r <= 'f')) {
				shaped = false
				break
			}
		}
	}
	if !shaped {
		return fmt.Errorf("has the digest %q, which is not r followed by %d lowercase hex digits",
			digest, digestBytes)
	}

	return nil
}
