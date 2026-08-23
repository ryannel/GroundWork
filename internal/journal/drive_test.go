package journal

import (
	"errors"
	"strings"
	"testing"
)

func TestWriteDriveWritesEveryField(t *testing.T) {
	dir := newRepo(t)
	t.Setenv("GROUNDWORK_SESSION", "s-alpha")

	head := runGit(t, dir, "rev-parse", "HEAD")

	path, err := WriteDrive(dir, Drive{Notes: "ran verify, waived a row, read the journal back"})
	if err != nil {
		t.Fatalf("the write failed: %v", err)
	}

	event := decodeEvent(t, dir, path)

	wantNumber(t, event, "v", 1)
	wantString(t, event, "kind", "drive")
	wantString(t, event, "session", "s-alpha")
	wantNumber(t, event, "seq", 1)
	wantString(t, event, "commit", head)
	wantString(t, event, "branch", "main")
	wantString(t, event, "notes", "ran verify, waived a row, read the journal back")
}

// The whole point of a drive line is when it was recorded: the seal machinery
// asks whether the drive came after the work's last commit. So the line must
// stamp the commit that was HEAD at the moment it was written, not the one
// that was HEAD when the session started.
func TestWriteDriveStampsTheCommitItWasRecordedAt(t *testing.T) {
	dir := newRepo(t)

	first, err := WriteDrive(dir, Drive{Notes: "drove the first build"})
	if err != nil {
		t.Fatalf("the first write failed: %v", err)
	}

	writeFile(t, dir+"/second.txt", "more work\n")
	runGit(t, dir, "add", "second.txt")
	runGit(t, dir, "commit", "-m", "second")
	head := runGit(t, dir, "rev-parse", "HEAD")

	second, err := WriteDrive(dir, Drive{Notes: "drove the second build"})
	if err != nil {
		t.Fatalf("the second write failed: %v", err)
	}

	if got := decodeEvent(t, dir, first)["commit"]; got == head {
		t.Fatal("the first drive line was stamped with a commit that did not exist yet")
	}
	wantString(t, decodeEvent(t, dir, second), "commit", head)
}

func TestWriteDriveRejectsABadDrive(t *testing.T) {
	cases := []struct {
		name  string
		drive Drive
	}{
		{"no notes at all", Drive{}},
		{"notes over the limit", Drive{Notes: strings.Repeat("x", MaxTextBytes+1)}},
	}

	for _, c := range cases {
		t.Run(c.name, func(t *testing.T) {
			dir := newRepo(t)

			if _, err := WriteDrive(dir, c.drive); err == nil {
				t.Fatalf("the journal took a drive with %s", c.name)
			}
			if refExists(t, dir) {
				t.Fatal("a rejected drive still moved the journal ref")
			}
		})
	}
}

func TestWriteDriveAcceptsNotesAtTheLimit(t *testing.T) {
	dir := newRepo(t)

	if _, err := WriteDrive(dir, Drive{Notes: strings.Repeat("x", MaxTextBytes)}); err != nil {
		t.Fatalf("the journal refused notes of exactly %d bytes: %v", MaxTextBytes, err)
	}
}

func TestWriteDriveOutsideARepo(t *testing.T) {
	if _, err := WriteDrive(t.TempDir(), Drive{Notes: "drove it"}); !errors.Is(err, ErrNotARepo) {
		t.Fatalf("the error is %v, want ErrNotARepo", err)
	}
}
