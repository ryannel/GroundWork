package battery

import (
	"encoding/json"
	"fmt"
	"os"
	"path/filepath"
	"strings"
	"testing"
	"time"

	"github.com/ryannel/groundwork/internal/journal"
)

// day returns the UTC date n days from now, in the format a waiver file uses.
func day(n int) string {
	return time.Now().UTC().AddDate(0, 0, n).Format(waiverDate)
}

// waiverBody renders a waiver file's contents.
func waiverBody(row, reason, granted, expires string) string {
	return fmt.Sprintf(
		"{\"v\":1,\"row\":%q,\"reason\":%q,\"granted\":%q,\"expires\":%q}\n",
		row, reason, granted, expires)
}

// putWaiver writes one waiver file into the repo at dir and commits it on its
// own, which is what D24 asks of a real waiver. It returns the path from the
// repo root.
func putWaiver(t *testing.T, dir, name, body string) string {
	t.Helper()

	path := dropWaiver(t, dir, name, body)
	runGit(t, dir, "add", path)
	runGit(t, dir, "commit", "-m", "waive a row")

	return path
}

// dropWaiver writes one waiver file into the repo at dir and commits nothing.
// It returns the path from the repo root.
func dropWaiver(t *testing.T, dir, name, body string) string {
	t.Helper()

	if err := os.MkdirAll(filepath.Join(dir, WaiverDir), 0o750); err != nil {
		t.Fatalf("could not make the waiver directory: %v", err)
	}
	writeFile(t, filepath.Join(dir, WaiverDir, name), body)

	return WaiverDir + "/" + name
}

// oneRed is a registry holding one row that always goes red.
func oneRed(t *testing.T, dir string) *Registry {
	t.Helper()

	reg := NewRegistry()
	reg.Register(fixed("honesty", "honesty", Blocking, Red))
	writeLock(t, dir, "1.0", reg.Digest())

	return reg
}

// noteFor returns the run's note about one waiver file.
func noteFor(t *testing.T, res RunResult, file string) WaiverNote {
	t.Helper()

	for _, note := range res.Waivers {
		if note.File == file {
			return note
		}
	}
	t.Fatalf("the run says nothing about the waiver %s: %v", file, res.Waivers)

	return WaiverNote{}
}

// outcomeOf returns one row's outcome in a run.
func outcomeOf(t *testing.T, res RunResult, row string) Outcome {
	t.Helper()

	for _, got := range res.Rows {
		if got.ID == row {
			return got.Outcome
		}
	}
	t.Fatalf("the run holds no row %q", row)

	return ""
}

// A live waiver over a red row turns it waived — never green. The run does not
// fail, the count says waived, and the row's line says who waived it.
func TestALiveWaiverWaivesARedRow(t *testing.T) {
	dir := newRepo(t)
	reg := oneRed(t, dir)

	file := putWaiver(t, dir, "honesty-1.json",
		waiverBody("honesty", "the scan cannot see the table helper", day(0), day(5)))

	res, err := Run(dir, reg)
	if err != nil {
		t.Fatalf("the run failed: %v", err)
	}

	if got := outcomeOf(t, res, "honesty"); got != Waived {
		t.Fatalf("the row is %q, want waived", got)
	}
	if res.Red() {
		t.Error("a waived row failed the run")
	}
	if res.Counts[Waived] != 1 || res.Counts[Green] != 0 || res.Counts[Red] != 0 {
		t.Errorf("the counts are %v, want one waived and nothing else", res.Counts)
	}

	if note := noteFor(t, res, file); note.Status != WaiverUsed {
		t.Errorf("the waiver's status is %q, want %q", note.Status, WaiverUsed)
	}

	line := res.Rows[0].Evidence
	for _, want := range []string{"waived", "honesty-1.json", day(5), "the scan cannot see the table helper"} {
		if !strings.Contains(line, want) {
			t.Errorf("the row's line is %q, and it does not hold %q", line, want)
		}
	}
}

// The row's own red words are not thrown away by a waiver. They go on the
// waiver's journal line, so the record still holds what the check said.
func TestAWaiverUseIsJournaledWithTheRowsOwnWords(t *testing.T) {
	dir := newRepo(t)
	reg := oneRed(t, dir)

	file := putWaiver(t, dir, "honesty-1.json",
		waiverBody("honesty", "the scan cannot see the table helper", day(0), day(5)))

	res, err := Run(dir, reg)
	if err != nil {
		t.Fatalf("the run failed: %v", err)
	}

	lines := linesOfKind(journalLines(t, dir), "waiver")
	if len(lines) != 1 {
		t.Fatalf("the journal holds %d waiver lines, want 1", len(lines))
	}

	line := lines[0]
	for field, want := range map[string]string{
		"action":   "used",
		"row":      "honesty",
		"waiver":   file,
		"reason":   "the scan cannot see the table helper",
		"expires":  day(5),
		"run":      res.ID,
		"evidence": "fixed red",
	} {
		if line[field] != want {
			t.Errorf("the waiver line's %s is %v, want %q", field, line[field], want)
		}
	}
}

// A waiver over a row that came up green waives nothing. It is still reported,
// because a waiver nobody needs any more is a waiver worth deleting.
func TestAWaiverOverAGreenRowIsUnused(t *testing.T) {
	dir := newRepo(t)

	reg := NewRegistry()
	reg.Register(fixed("honesty", "honesty", Blocking, Green))
	writeLock(t, dir, "1.0", reg.Digest())

	file := putWaiver(t, dir, "honesty-1.json",
		waiverBody("honesty", "the scan is wrong here", day(0), day(5)))

	res, err := Run(dir, reg)
	if err != nil {
		t.Fatalf("the run failed: %v", err)
	}

	if got := outcomeOf(t, res, "honesty"); got != Green {
		t.Fatalf("the row is %q, want green", got)
	}
	if note := noteFor(t, res, file); note.Status != WaiverUnused {
		t.Errorf("the waiver's status is %q, want %q", note.Status, WaiverUnused)
	}
	if lines := linesOfKind(journalLines(t, dir), "waiver"); len(lines) != 0 {
		t.Errorf("the journal holds %d waiver lines for a waiver nothing used, want 0", len(lines))
	}
}

// Every shape of waiver that cannot stand. Each one leaves the row red, is
// named in the run's own notes, and gets a journal line saying it was ignored.
func TestAWaiverThatCannotStandLeavesTheRowRed(t *testing.T) {
	cases := []struct {
		name string
		body string
		why  string
	}{
		{"expired yesterday", waiverBody("honesty", "wrong check", day(-10), day(-1)), "expired"},
		{"an expiry 31 days out", waiverBody("honesty", "wrong check", day(0), day(31)), "30 days"},
		{"an expiry before it was granted", waiverBody("honesty", "wrong check", day(0), day(-1)), "granted"},
		{"granted tomorrow", waiverBody("honesty", "wrong check", day(1), day(5)), "future"},
		{"a row the battery does not hold", waiverBody("wiring", "wrong check", day(0), day(5)), "no row"},
		{"no reason at all", waiverBody("honesty", "", day(0), day(5)), "reason"},
		{"a reason over the limit", waiverBody("honesty", strings.Repeat("x", maxWaiverReasonBytes+1), day(0), day(5)), "reason"},
		{"an expiry that is not a date", waiverBody("honesty", "wrong check", day(0), "next tuesday"), "expires"},
		{"a grant date that is not a date", waiverBody("honesty", "wrong check", "yesterday", day(5)), "granted"},
		{"no expiry at all", waiverBody("honesty", "wrong check", day(0), ""), "expires"},
		{"an expiry with a time on it", waiverBody("honesty", "wrong check", day(0), "2026-09-05T00:00:00Z"), "expires"},
		{"a reason holding a newline", waiverBody("honesty", "ticket 41\nwiring        green       nothing to see", day(0), day(5)), "reason"},
		{"a reason holding an escape", fmt.Sprintf(
			`{"v":1,"row":"honesty","reason":"ticket 41\u001b[2K","granted":%q,"expires":%q}`,
			day(0), day(5)), "reason"},
		{"a reason holding a tab", fmt.Sprintf(
			`{"v":1,"row":"honesty","reason":"ticket 41\twiring","granted":%q,"expires":%q}`,
			day(0), day(5)), "reason"},
	}

	for _, c := range cases {
		t.Run(c.name, func(t *testing.T) {
			dir := newRepo(t)
			reg := oneRed(t, dir)

			file := putWaiver(t, dir, "honesty-1.json", c.body)

			res, err := Run(dir, reg)
			if err != nil {
				t.Fatalf("the run failed: %v", err)
			}

			if got := outcomeOf(t, res, "honesty"); got != Red {
				t.Fatalf("the row is %q, want red: a waiver that cannot stand waived it anyway", got)
			}

			note := noteFor(t, res, file)
			if note.Status != WaiverIgnored {
				t.Fatalf("the waiver's status is %q, want %q", note.Status, WaiverIgnored)
			}
			if !strings.Contains(note.Why, c.why) {
				t.Errorf("the reason it was ignored is %q, and it does not hold %q", note.Why, c.why)
			}

			lines := linesOfKind(journalLines(t, dir), "waiver")
			if len(lines) != 1 {
				t.Fatalf("the journal holds %d waiver lines, want 1", len(lines))
			}
			if lines[0]["action"] != "ignored" {
				t.Errorf("the waiver line's action is %v, want ignored", lines[0]["action"])
			}
			if lines[0]["waiver"] != file {
				t.Errorf("the waiver line names %v, want %q", lines[0]["waiver"], file)
			}
		})
	}
}

// D24: a waiver must land in its own commit, touching only waiver files. One
// buried in a feature diff carries no attribution anybody can read, so it does
// not stand.
func TestAWaiverBuriedInAFeatureDiffDoesNotStand(t *testing.T) {
	dir := newRepo(t)
	reg := oneRed(t, dir)

	file := dropWaiver(t, dir, "honesty-1.json",
		waiverBody("honesty", "wrong check", day(0), day(5)))
	writeFile(t, filepath.Join(dir, "feature.go"), "package main\n")
	runGit(t, dir, "add", file, "feature.go")
	runGit(t, dir, "commit", "-m", "a feature, and a waiver hidden in it")

	res, err := Run(dir, reg)
	if err != nil {
		t.Fatalf("the run failed: %v", err)
	}

	if got := outcomeOf(t, res, "honesty"); got != Red {
		t.Fatalf("the row is %q, want red", got)
	}

	note := noteFor(t, res, file)
	if note.Status != WaiverIgnored {
		t.Fatalf("the waiver's status is %q, want %q", note.Status, WaiverIgnored)
	}
	if !strings.Contains(note.Why, "feature.go") {
		t.Errorf("the reason it was ignored is %q, and it does not name the file it rode in with", note.Why)
	}
}

// Two waiver files in one commit is the shape the grant verb produces when a
// person waives two rows at once. It is allowed: the commit touches waivers
// and nothing else.
func TestTwoWaiversInOneCommitBothStand(t *testing.T) {
	dir := newRepo(t)

	reg := NewRegistry()
	reg.Register(fixed("honesty", "honesty", Blocking, Red))
	reg.Register(fixed("wiring", "wiring", Blocking, Red))
	writeLock(t, dir, "1.0", reg.Digest())

	first := dropWaiver(t, dir, "honesty-1.json", waiverBody("honesty", "wrong check", day(0), day(5)))
	second := dropWaiver(t, dir, "wiring-1.json", waiverBody("wiring", "wrong check", day(0), day(5)))
	runGit(t, dir, "add", first, second)
	runGit(t, dir, "commit", "-m", "waive two rows")

	res, err := Run(dir, reg)
	if err != nil {
		t.Fatalf("the run failed: %v", err)
	}

	for _, row := range []string{"honesty", "wiring"} {
		if got := outcomeOf(t, res, row); got != Waived {
			t.Errorf("the row %q is %q, want waived", row, got)
		}
	}
}

// An uncommitted waiver has no attribution at all. Anyone could drop the file
// in and turn a red row waived, which is the tampering waivers exist to
// replace.
func TestAnUncommittedWaiverDoesNotStand(t *testing.T) {
	cases := []struct {
		name   string
		commit func(t *testing.T, dir, file string)
		why    string
	}{
		{
			name:   "never committed",
			commit: func(*testing.T, string, string) {},
			why:    "not committed",
		},
		{
			name: "staged but not committed",
			commit: func(t *testing.T, dir, file string) {
				runGit(t, dir, "add", file)
			},
			why: "not committed",
		},
		{
			name: "edited after it was committed",
			commit: func(t *testing.T, dir, file string) {
				runGit(t, dir, "add", file)
				runGit(t, dir, "commit", "-m", "waive a row")
				writeFile(t, filepath.Join(dir, file),
					waiverBody("honesty", "a reason nobody committed", day(0), day(5)))
			},
			why: "changed",
		},
	}

	for _, c := range cases {
		t.Run(c.name, func(t *testing.T) {
			dir := newRepo(t)
			reg := oneRed(t, dir)

			file := dropWaiver(t, dir, "honesty-1.json",
				waiverBody("honesty", "wrong check", day(0), day(5)))
			c.commit(t, dir, file)

			res, err := Run(dir, reg)
			if err != nil {
				t.Fatalf("the run failed: %v", err)
			}

			if got := outcomeOf(t, res, "honesty"); got != Red {
				t.Fatalf("the row is %q, want red", got)
			}
			if note := noteFor(t, res, file); !strings.Contains(note.Why, c.why) {
				t.Errorf("the reason it was ignored is %q, and it does not hold %q", note.Why, c.why)
			}
		})
	}
}

// Two live waivers over one row is a record that disagrees with itself about
// why the row is waived. Both are refused, and the row stays red.
func TestTwoLiveWaiversOverOneRowBothFail(t *testing.T) {
	dir := newRepo(t)
	reg := oneRed(t, dir)

	first := putWaiver(t, dir, "honesty-1.json", waiverBody("honesty", "one reason", day(0), day(5)))
	second := putWaiver(t, dir, "honesty-2.json", waiverBody("honesty", "another reason", day(0), day(6)))

	res, err := Run(dir, reg)
	if err != nil {
		t.Fatalf("the run failed: %v", err)
	}

	if got := outcomeOf(t, res, "honesty"); got != Red {
		t.Fatalf("the row is %q, want red", got)
	}
	for _, file := range []string{first, second} {
		note := noteFor(t, res, file)
		if note.Status != WaiverIgnored {
			t.Errorf("the waiver %s is %q, want %q", file, note.Status, WaiverIgnored)
		}
		if !strings.Contains(note.Why, "honesty-1.json") || !strings.Contains(note.Why, "honesty-2.json") {
			t.Errorf("the reason %s was ignored is %q, and it does not name both waivers", file, note.Why)
		}
	}
}

// An expired waiver beside a live one is not a duplicate. Only waivers that
// could stand can collide.
func TestAnExpiredWaiverDoesNotCollideWithALiveOne(t *testing.T) {
	dir := newRepo(t)
	reg := oneRed(t, dir)

	putWaiver(t, dir, "honesty-old.json", waiverBody("honesty", "old reason", day(-10), day(-1)))
	putWaiver(t, dir, "honesty-new.json", waiverBody("honesty", "live reason", day(0), day(5)))

	res, err := Run(dir, reg)
	if err != nil {
		t.Fatalf("the run failed: %v", err)
	}

	if got := outcomeOf(t, res, "honesty"); got != Waived {
		t.Fatalf("the row is %q, want waived", got)
	}
}

// No waivers at all is the normal case, and it is not an error. An empty
// directory says the same thing as no directory.
func TestNoWaiversIsNotAProblem(t *testing.T) {
	for _, c := range []struct {
		name string
		make func(t *testing.T, dir string)
	}{
		{"no directory at all", func(*testing.T, string) {}},
		{"an empty directory", func(t *testing.T, dir string) {
			if err := os.MkdirAll(filepath.Join(dir, WaiverDir), 0o750); err != nil {
				t.Fatalf("could not make the waiver directory: %v", err)
			}
		}},
	} {
		t.Run(c.name, func(t *testing.T) {
			dir := newRepo(t)

			reg := NewRegistry()
			reg.Register(fixed("honesty", "honesty", Blocking, Green))
			writeLock(t, dir, "1.0", reg.Digest())

			c.make(t, dir)

			res, err := Run(dir, reg)
			if err != nil {
				t.Fatalf("the run failed: %v", err)
			}
			if len(res.Waivers) != 0 {
				t.Fatalf("the run reports %d waivers, want none", len(res.Waivers))
			}
			if res.Red() {
				t.Error("a run with no waivers failed")
			}
		})
	}
}

// The waived row's line is built from the waiver's own text, and it has to fit
// the journal's cap on any legal waiver. This is the arithmetic, not a
// measurement of one example: the widest legal row id, file name, date and
// reason together.
func TestTheWaivedLineFitsTheJournalCapOnTheWidestWaiver(t *testing.T) {
	row := strings.Repeat("r", maxRowIDBytes)
	file := WaiverDir + "/" + strings.Repeat("f", maxWaiverNameBytes)
	line := waivedEvidence(WaiverNote{
		File:    file,
		Row:     row,
		Reason:  strings.Repeat("x", maxWaiverReasonBytes),
		Expires: "2026-09-05",
	})

	if len(line) > journal.MaxTextBytes {
		t.Fatalf("the widest legal waiver makes a line of %d bytes, over the cap of %d: %q",
			len(line), journal.MaxTextBytes, line)
	}
}

func TestGrantWritesACommittableWaiver(t *testing.T) {
	dir := newRepo(t)

	path, err := Grant(dir, "honesty", "the scan cannot see the table helper", day(5))
	if err != nil {
		t.Fatalf("the grant failed: %v", err)
	}

	if !strings.HasPrefix(path, WaiverDir+"/") {
		t.Errorf("the waiver landed at %q, want it under %s", path, WaiverDir)
	}
	if !strings.HasPrefix(filepath.Base(path), "honesty-") {
		t.Errorf("the waiver file is %q, and its name does not start with the row it waives", path)
	}

	raw, err := os.ReadFile(filepath.Join(dir, path))
	if err != nil {
		t.Fatalf("could not read the waiver back: %v", err)
	}

	var body struct {
		V       int    `json:"v"`
		Row     string `json:"row"`
		Reason  string `json:"reason"`
		Granted string `json:"granted"`
		Expires string `json:"expires"`
	}
	if err := json.Unmarshal(raw, &body); err != nil {
		t.Fatalf("the waiver is not valid JSON: %v", err)
	}

	if body.V != 1 || body.Row != "honesty" || body.Expires != day(5) || body.Granted != day(0) {
		t.Errorf("the waiver reads %+v, want v 1, row honesty, granted today and expiring in five days", body)
	}
	if body.Reason != "the scan cannot see the table helper" {
		t.Errorf("the waiver's reason is %q", body.Reason)
	}
}

// Granting never commits. The commit is the human's act, and the git
// attribution it carries is the whole authority of a waiver this bet.
func TestGrantCommitsNothing(t *testing.T) {
	dir := newRepo(t)

	before := runGit(t, dir, "rev-parse", "HEAD")

	path, err := Grant(dir, "honesty", "the scan is wrong here", day(5))
	if err != nil {
		t.Fatalf("the grant failed: %v", err)
	}

	if after := runGit(t, dir, "rev-parse", "HEAD"); after != before {
		t.Error("granting a waiver moved HEAD")
	}
	if status := runGit(t, dir, "status", "--porcelain", "--", path); !strings.Contains(status, "??") {
		t.Errorf("git says %q about the new waiver, want it untracked and waiting for the human", status)
	}
}

func TestGrantJournalsTheGrant(t *testing.T) {
	dir := newRepo(t)

	path, err := Grant(dir, "honesty", "the scan is wrong here", day(5))
	if err != nil {
		t.Fatalf("the grant failed: %v", err)
	}

	lines := linesOfKind(journalLines(t, dir), "waiver")
	if len(lines) != 1 {
		t.Fatalf("the journal holds %d waiver lines, want 1", len(lines))
	}

	for field, want := range map[string]string{
		"action":  "granted",
		"row":     "honesty",
		"waiver":  path,
		"reason":  "the scan is wrong here",
		"expires": day(5),
	} {
		if lines[0][field] != want {
			t.Errorf("the grant line's %s is %v, want %q", field, lines[0][field], want)
		}
	}
}

func TestGrantRefusesAWaiverItWouldNotHonour(t *testing.T) {
	cases := []struct {
		name    string
		row     string
		reason  string
		expires string
		says    string
	}{
		{"a row the battery does not hold", "honestly", "wrong check", day(5), "honestly"},
		{"an empty row", "", "wrong check", day(5), "row"},
		{"an expiry 31 days out", "honesty", "wrong check", day(31), "30 days"},
		{"an expiry in the past", "honesty", "wrong check", day(-1), "past"},
		{"an expiry that is not a date", "honesty", "wrong check", "next tuesday", "date"},
		{"no expiry at all", "honesty", "wrong check", "", "expiry"},
		{"no reason at all", "honesty", "", day(5), "reason"},
		{"a reason over the limit", "honesty", strings.Repeat("x", maxWaiverReasonBytes+1), day(5), "reason"},
		{"a reason holding a newline", "honesty", "ticket 41\nwiring        green       nothing to see", day(5), "reason"},
		{"a reason holding a tab", "honesty", "ticket 41\twiring", day(5), "reason"},
		{"a reason holding an escape", "honesty", "ticket 41\x1b[2K", day(5), "reason"},
	}

	for _, c := range cases {
		t.Run(c.name, func(t *testing.T) {
			dir := newRepo(t)

			_, err := Grant(dir, c.row, c.reason, c.expires)
			if err == nil {
				t.Fatalf("the grant took %s", c.name)
			}
			if !strings.Contains(err.Error(), c.says) {
				t.Errorf("the error is %q, and it does not hold %q", err, c.says)
			}

			if entries, _ := os.ReadDir(filepath.Join(dir, WaiverDir)); len(entries) != 0 {
				t.Errorf("a refused grant left %d files behind", len(entries))
			}
			if lines := linesOfKind(journalLines(t, dir), "waiver"); len(lines) != 0 {
				t.Errorf("a refused grant wrote %d journal lines", len(lines))
			}
		})
	}
}

// The row this repo's battery holds is what a grant is checked against, so a
// waiver can never name a row no run will ever report.
func TestGrantChecksTheRowAgainstTheShippedBattery(t *testing.T) {
	dir := newRepo(t)

	for _, row := range Default().Rows() {
		if _, err := Grant(dir, row.ID, "a reason", day(1)); err != nil {
			t.Errorf("the grant refused the shipped row %q: %v", row.ID, err)
		}
	}
}

// Granting twice for one row would make the pair that refuses itself at the
// next run. The second grant is refused instead, naming the file that already
// stands.
func TestGrantRefusesASecondLiveWaiverForOneRow(t *testing.T) {
	dir := newRepo(t)

	first, err := Grant(dir, "honesty", "the scan is wrong here", day(5))
	if err != nil {
		t.Fatalf("the first grant failed: %v", err)
	}

	_, err = Grant(dir, "honesty", "still wrong", day(5))
	if err == nil {
		t.Fatal("the second grant for one row went through")
	}
	if !strings.Contains(err.Error(), filepath.Base(first)) {
		t.Errorf("the error is %q, and it does not name the waiver that already stands", err)
	}
}

// An expired waiver for a row is not in anybody's way. The row can be waived
// again.
func TestGrantAllowsARowWhoseWaiverExpired(t *testing.T) {
	dir := newRepo(t)

	putWaiver(t, dir, "honesty-old.json", waiverBody("honesty", "old reason", day(-10), day(-1)))

	if _, err := Grant(dir, "honesty", "wrong again", day(5)); err != nil {
		t.Fatalf("the grant refused a row whose only waiver expired: %v", err)
	}
}

func TestGrantOutsideARepo(t *testing.T) {
	if _, err := Grant(t.TempDir(), "honesty", "a reason", day(5)); err == nil {
		t.Fatal("the grant went through outside a repository")
	}
}

// A waiver is one short object. A file far bigger than that is not one, and it
// is refused on its size before anything tries to read it as JSON.
func TestAHugeWaiverFileFailsTheRun(t *testing.T) {
	dir := newRepo(t)
	reg := oneRed(t, dir)

	// The padding is whitespace inside the object, so the file is a perfectly
	// good waiver in every way but its size. A cap is the only thing that can
	// turn it away.
	body := waiverBody("honesty", "wrong check", day(0), day(5))
	padded := "{" + strings.Repeat(" ", maxWaiverBytes) + strings.TrimPrefix(body, "{")

	file := putWaiver(t, dir, "honesty-1.json", padded)

	res, err := Run(dir, reg)
	if err != nil {
		t.Fatalf("the run was blanked: %v", err)
	}
	if !res.Failed() {
		t.Error("the run took a waiver file of any size at all")
	}

	note := noteFor(t, res, file)
	if note.Status != WaiverUnreadable {
		t.Fatalf("the waiver's status is %q, want %q", note.Status, WaiverUnreadable)
	}
	if !strings.Contains(note.Why, "over the limit") {
		t.Errorf("the note is %q, and it does not say the file is too big", note.Why)
	}
}

// A waiver is live on the day it runs out. Expiry is a date, and a date is a
// whole day.
func TestAWaiverStandsOnItsLastDay(t *testing.T) {
	dir := newRepo(t)
	reg := oneRed(t, dir)

	putWaiver(t, dir, "honesty-1.json", waiverBody("honesty", "wrong check", day(0), day(0)))

	res, err := Run(dir, reg)
	if err != nil {
		t.Fatalf("the run failed: %v", err)
	}

	if got := outcomeOf(t, res, "honesty"); got != Waived {
		t.Fatalf("a waiver expiring today left the row %q, want waived", got)
	}
}

// D38: the waiver's authority is the commit whose content governs, which is
// the last commit that changed the file — not the commit that created it. An
// honest waiver rewritten inside a feature diff is a hijacked waiver, and it
// waives nothing.
func TestAWaiverRewrittenInsideAFeatureDiffDoesNotStand(t *testing.T) {
	dir := newRepo(t)
	reg := oneRed(t, dir)

	// An honest waiver first: its own commit, touching only itself, naming a
	// row that is not the one the hijacker wants.
	file := dropWaiver(t, dir, "w.json", waiverBody("wiring", "an honest waiver", day(0), day(1)))
	runGit(t, dir, "add", file)
	runGit(t, dir, "commit", "-m", "waive the wiring row, on its own")

	// Then the rewrite, buried in ordinary work.
	writeFile(t, filepath.Join(dir, file),
		waiverBody("honesty", "HIJACKED inside a feature diff", day(0), day(20)))
	writeFile(t, filepath.Join(dir, "feature.go"), "package main\n")
	runGit(t, dir, "add", file, "feature.go")
	runGit(t, dir, "commit", "-m", "feature work, and quietly the waiver too")

	res, err := Run(dir, reg)
	if err != nil {
		t.Fatalf("the run failed: %v", err)
	}

	if got := outcomeOf(t, res, "honesty"); got != Red {
		t.Fatalf("the row is %q, want red: a waiver rewritten in a feature diff waived it", got)
	}

	note := noteFor(t, res, file)
	if note.Status != WaiverIgnored {
		t.Fatalf("the waiver's status is %q, want %q", note.Status, WaiverIgnored)
	}
	if !strings.Contains(note.Why, "feature.go") {
		t.Errorf("the reason it was ignored is %q, and it does not name the file it was rewritten with", note.Why)
	}
}

// The other half of the same rule: a rewrite in a commit of its own is a
// re-grant, and D24's letter allows it.
func TestAWaiverRewrittenInItsOwnCommitStands(t *testing.T) {
	dir := newRepo(t)
	reg := oneRed(t, dir)

	file := dropWaiver(t, dir, "w.json", waiverBody("honesty", "the first reason", day(0), day(1)))
	runGit(t, dir, "add", file)
	runGit(t, dir, "commit", "-m", "waive the honesty row")

	writeFile(t, filepath.Join(dir, file), waiverBody("honesty", "a longer look at it", day(0), day(20)))
	runGit(t, dir, "add", file)
	runGit(t, dir, "commit", "-m", "re-grant the waiver, on its own")

	res, err := Run(dir, reg)
	if err != nil {
		t.Fatalf("the run failed: %v", err)
	}

	if got := outcomeOf(t, res, "honesty"); got != Waived {
		t.Fatalf("the row is %q, want waived", got)
	}
	if got := res.Rows[0].Evidence; !strings.Contains(got, "a longer look at it") {
		t.Errorf("the row's line is %q, and it does not carry the re-granted reason", got)
	}
}

// An amend that sweeps other files into the waiver's commit is the hijack
// again, wearing the birth commit's clothes.
func TestAWaiverAmendedIntoAFeatureCommitDoesNotStand(t *testing.T) {
	dir := newRepo(t)
	reg := oneRed(t, dir)

	file := dropWaiver(t, dir, "w.json", waiverBody("honesty", "wrong check", day(0), day(5)))
	runGit(t, dir, "add", file)
	runGit(t, dir, "commit", "-m", "waive the honesty row")

	writeFile(t, filepath.Join(dir, "feature.go"), "package main\n")
	runGit(t, dir, "add", "feature.go")
	runGit(t, dir, "commit", "--amend", "-m", "waive the honesty row, and a feature")

	res, err := Run(dir, reg)
	if err != nil {
		t.Fatalf("the run failed: %v", err)
	}

	if got := outcomeOf(t, res, "honesty"); got != Red {
		t.Fatalf("the row is %q, want red", got)
	}
	if note := noteFor(t, res, file); !strings.Contains(note.Why, "feature.go") {
		t.Errorf("the reason it was ignored is %q, and it does not name the amended-in file", note.Why)
	}
}

// A waiver granted on a side branch and merged in cleanly is still a waiver
// granted in a commit of its own. The merge carries it; it does not change it.
func TestAWaiverMergedFromASideBranchStands(t *testing.T) {
	dir := newRepo(t)
	reg := oneRed(t, dir)

	runGit(t, dir, "checkout", "-q", "-b", "side")
	file := dropWaiver(t, dir, "w.json", waiverBody("honesty", "waived on a side branch", day(0), day(5)))
	runGit(t, dir, "add", file)
	runGit(t, dir, "commit", "-m", "waive the honesty row")

	runGit(t, dir, "checkout", "-q", "main")
	writeFile(t, filepath.Join(dir, "feature.go"), "package main\n")
	runGit(t, dir, "add", "feature.go")
	runGit(t, dir, "commit", "-m", "feature work on main")
	runGit(t, dir, "merge", "--no-ff", "-m", "merge the side branch", "side")

	res, err := Run(dir, reg)
	if err != nil {
		t.Fatalf("the run failed: %v", err)
	}

	if got := outcomeOf(t, res, "honesty"); got != Waived {
		t.Fatalf("the row is %q, want waived: the merge changed nothing about the waiver", got)
	}
}

// D38: committed content is attacker-controlled content. A control character
// in a reason or a file name would forge a row in the table the run prints, so
// nothing a run says about a waiver ever carries one — not the file, not the
// reason, not the sentence saying what was wrong.
func TestNothingARunSaysAboutAWaiverCarriesAControlCharacter(t *testing.T) {
	dir := newRepo(t)
	reg := oneRed(t, dir)

	forged := "wiring        green       nothing to see"

	putWaiver(t, dir, "honesty-1.json",
		waiverBody("honesty", "ticket 41\n"+forged, day(0), day(5)))
	putWaiver(t, dir, "honesty\n"+forged+".json",
		waiverBody("honesty", "a name that forges a row", day(0), day(5)))

	res, err := Run(dir, reg)
	if err != nil {
		t.Fatalf("the run failed: %v", err)
	}

	if got := outcomeOf(t, res, "honesty"); got != Red {
		t.Fatalf("the row is %q, want red: a forged waiver waived it", got)
	}

	// The forged file name is refused for being a forged file name. Without
	// this the file would be turned away for not being committed — git knows
	// it by the name it really has — and the check on the name would be
	// proving nothing.
	forgedName := false
	for _, note := range res.Waivers {
		if note.Status == WaiverUnreadable && strings.Contains(note.Why, "control character") {
			forgedName = true
		}
	}
	if !forgedName {
		t.Errorf("no note turns away the file whose name forges a row: %+v", res.Waivers)
	}

	for _, note := range res.Waivers {
		for field, value := range map[string]string{
			"file": note.File, "row": note.Row, "reason": note.Reason,
			"expires": note.Expires, "why": note.Why,
		} {
			for _, r := range value {
				if r < 0x20 || r == 0x7f {
					t.Errorf("the note's %s holds the control character %q: %q", field, r, value)
				}
			}
		}
		if note.Status == WaiverUsed {
			t.Errorf("a forged waiver was used: %+v", note)
		}
	}
}

// D38 ruling 6: a file in the waiver directory that is not a waiver no longer
// blanks the run. Every row still runs, the table and the journal still
// render, the file is named, and the run fails.
func TestAWaiverFileTheRunCannotReadIsNamedAndFailsTheRun(t *testing.T) {
	cases := []struct {
		name string
		file string
		body string

		// says is what the note must hold about the file. It is the file's own
		// name when it is empty, which is what nearly every case wants.
		says string
	}{
		{name: "not JSON at all", file: "honesty-1.json", body: "waive the honesty row please\n"},
		{name: "JSON that is not an object", file: "honesty-1.json", body: "[1,2,3]\n"},
		{name: "a field nobody declared", file: "honesty-1.json",
			body: `{"v":1,"row":"honesty","reason":"r","granted":"2026-08-23","expires":"2026-08-24","note":"x"}`},
		{name: "two objects in one file", file: "honesty-1.json",
			body: waiverBody("honesty", "r", "2026-08-23", "2026-08-24") + waiverBody("honesty", "r", "2026-08-23", "2026-08-24")},
		{name: "no row field", file: "honesty-1.json",
			body: `{"v":1,"reason":"r","granted":"2026-08-23","expires":"2026-08-24"}`},
		{name: "a row id outside the charset", file: "honesty-1.json",
			body: waiverBody("Honesty Row", "r", "2026-08-23", "2026-08-24")},
		{name: "a row id holding a path", file: "honesty-1.json",
			body: waiverBody("../../etc/passwd", "r", "2026-08-23", "2026-08-24")},
		{name: "a schema version from the future", file: "honesty-1.json",
			body: `{"v":2,"row":"honesty","reason":"r","granted":"2026-08-23","expires":"2026-08-24"}`},
		{name: "a file that is not a waiver", file: "notes.md", body: "# what I waived\n"},
		{name: "a file left to hold the directory open", file: ".gitkeep", body: ""},
		{
			name: "a file name too long to print in a row's line",
			file: strings.Repeat("n", maxWaiverNameBytes) + ".json",
			body: waiverBody("honesty", "r", "2026-08-23", "2026-08-24"),
			says: strings.Repeat("n", 20),
		},
	}

	for _, c := range cases {
		t.Run(c.name, func(t *testing.T) {
			dir := newRepo(t)
			reg := oneRed(t, dir)

			file := putWaiver(t, dir, c.file, c.body)

			res, err := Run(dir, reg)
			if err != nil {
				t.Fatalf("a file that is not a waiver blanked the run: %v", err)
			}

			// The report is the point of the ruling: the run still says what
			// every row did, and the journal still holds it.
			if len(res.Rows) != reg.Len() {
				t.Fatalf("the run reports %d rows, want %d", len(res.Rows), reg.Len())
			}
			if lines := linesOfKind(journalLines(t, dir), "battery"); len(lines) != 1 {
				t.Fatalf("the journal holds %d battery lines, want 1", len(lines))
			}
			if !res.Failed() {
				t.Error("a file that is not a waiver did not fail the run")
			}

			says := c.says
			if says == "" {
				says = filepath.Base(file)
			}

			found := false
			for _, note := range res.Waivers {
				if note.Status == WaiverUnreadable && strings.Contains(note.File+note.Why, says) {
					found = true
				}
			}
			if !found {
				t.Errorf("no note names the file that is not a waiver: %+v", res.Waivers)
			}
		})
	}
}

// A directory and a symlink are not waivers either, and they are reported the
// same way.
func TestAnEntryThatIsNotAFileIsNamedAndFailsTheRun(t *testing.T) {
	dir := newRepo(t)
	reg := oneRed(t, dir)

	nested := filepath.Join(dir, WaiverDir, "archive")
	if err := os.MkdirAll(nested, 0o750); err != nil {
		t.Fatalf("could not make the nested directory: %v", err)
	}
	writeFile(t, filepath.Join(nested, "keep.json"), waiverBody("honesty", "r", day(0), day(1)))

	real := filepath.Join(t.TempDir(), "elsewhere.json")
	writeFile(t, real, waiverBody("honesty", "wrong check", day(0), day(5)))
	if err := os.Symlink(real, filepath.Join(dir, WaiverDir, "linked.json")); err != nil {
		t.Skipf("this machine will not make symlinks: %v", err)
	}

	runGit(t, dir, "add", WaiverDir)
	runGit(t, dir, "commit", "-m", "two things that are not waivers")

	res, err := Run(dir, reg)
	if err != nil {
		t.Fatalf("the run was blanked: %v", err)
	}
	if !res.Failed() {
		t.Error("the run passed over entries that are not waiver files")
	}

	named := map[string]bool{}
	for _, note := range res.Waivers {
		if note.Status == WaiverUnreadable {
			named[filepath.Base(note.File)] = true
		}
	}
	for _, want := range []string{"archive", "linked.json"} {
		if !named[want] {
			t.Errorf("no note names %q: %+v", want, res.Waivers)
		}
	}
}

// An unreadable file is on the record too. It names no row — a made-up one
// would be worse than none — and its line says what was wrong with it.
func TestAnUnreadableWaiverIsJournaled(t *testing.T) {
	dir := newRepo(t)
	reg := oneRed(t, dir)

	putWaiver(t, dir, "honesty-1.json", "not a waiver at all\n")

	if _, err := Run(dir, reg); err != nil {
		t.Fatalf("the run was blanked: %v", err)
	}

	lines := linesOfKind(journalLines(t, dir), "waiver")
	if len(lines) != 1 {
		t.Fatalf("the journal holds %d waiver lines, want 1", len(lines))
	}
	if lines[0]["action"] != "ignored" {
		t.Errorf("the line's action is %v, want ignored", lines[0]["action"])
	}
	if lines[0]["waiver"] != WaiverDir+"/honesty-1.json" {
		t.Errorf("the line names %v", lines[0]["waiver"])
	}
	if _, held := lines[0]["row"]; held {
		t.Errorf("the line claims the row %v, and the file names none", lines[0]["row"])
	}
}

// M2: the sentence about an unused waiver comes from the run, not from a test
// that filled it in.
func TestAnUnusedWaiverSaysWhyItWasUnused(t *testing.T) {
	dir := newRepo(t)

	reg := NewRegistry()
	reg.Register(fixed("honesty", "honesty", Blocking, Green))
	writeLock(t, dir, "1.0", reg.Digest())

	file := putWaiver(t, dir, "honesty-1.json", waiverBody("honesty", "the scan is wrong here", day(0), day(5)))

	res, err := Run(dir, reg)
	if err != nil {
		t.Fatalf("the run failed: %v", err)
	}

	note := noteFor(t, res, file)
	if note.Status != WaiverUnused {
		t.Fatalf("the waiver's status is %q, want %q", note.Status, WaiverUnused)
	}
	if note.Why == "" {
		t.Fatal("the unused waiver says nothing about why it was unused")
	}
	if !strings.Contains(note.Why, "honesty") {
		t.Errorf("the reason it went unused is %q, and it does not name the row", note.Why)
	}
}

// M1: in a shallow clone the history that would prove a waiver is not here.
// The commit that governs the file sits at the clone's edge, and the whole
// tree hangs off it, so the run must say the clone is shallow rather than
// blame the waiver for touching every file in the repo.
func TestAWaiverInAShallowCloneSaysTheCloneIsShallow(t *testing.T) {
	origin := newRepo(t)

	file := dropWaiver(t, origin, "honesty-1.json", waiverBody("honesty", "wrong check", day(0), day(5)))
	runGit(t, origin, "add", file)
	runGit(t, origin, "commit", "-m", "waive the honesty row")

	writeFile(t, filepath.Join(origin, "later.go"), "package main\n")
	runGit(t, origin, "add", "later.go")
	runGit(t, origin, "commit", "-m", "later work")

	clone := filepath.Join(t.TempDir(), "shallow")
	runGit(t, origin, "clone", "-q", "--depth", "1", "file://"+origin, clone)

	reg := oneRed(t, clone)

	res, err := Run(clone, reg)
	if err != nil {
		t.Fatalf("the run failed: %v", err)
	}

	if got := outcomeOf(t, res, "honesty"); got != Red {
		t.Fatalf("the row is %q, want red: a waiver nothing can attribute waived it", got)
	}

	note := noteFor(t, res, file)
	if note.Status != WaiverIgnored {
		t.Fatalf("the waiver's status is %q, want %q", note.Status, WaiverIgnored)
	}
	if !strings.Contains(note.Why, "shallow") {
		t.Errorf("the reason it was ignored is %q, and it does not say the clone is shallow", note.Why)
	}
	if strings.Contains(note.Why, "README.md") {
		t.Errorf("the reason it was ignored is %q, and it blames the waiver for the whole tree", note.Why)
	}
}

// The same repo, cloned whole, keeps the waiver standing. Shallowness is the
// only difference between the two runs.
func TestAWaiverInAFullCloneStands(t *testing.T) {
	origin := newRepo(t)

	file := dropWaiver(t, origin, "honesty-1.json", waiverBody("honesty", "wrong check", day(0), day(5)))
	runGit(t, origin, "add", file)
	runGit(t, origin, "commit", "-m", "waive the honesty row")

	writeFile(t, filepath.Join(origin, "later.go"), "package main\n")
	runGit(t, origin, "add", "later.go")
	runGit(t, origin, "commit", "-m", "later work")

	clone := filepath.Join(t.TempDir(), "full")
	runGit(t, origin, "clone", "-q", "file://"+origin, clone)

	reg := oneRed(t, clone)

	res, err := Run(clone, reg)
	if err != nil {
		t.Fatalf("the run failed: %v", err)
	}

	if got := outcomeOf(t, res, "honesty"); got != Waived {
		t.Fatalf("the row is %q, want waived", got)
	}
}

// D40: a merge is not a granting act. A waiver whose governing commit is a
// merge is ignored, whatever the merge did to it — and an evil merge, which
// changes a file neither side changed, is exactly the hijack again.
func TestAWaiverRewrittenInAMergeDoesNotStand(t *testing.T) {
	dir := newRepo(t)
	reg := oneRed(t, dir)

	file := dropWaiver(t, dir, "w.json", waiverBody("wiring", "an honest waiver", day(0), day(1)))
	runGit(t, dir, "add", file)
	runGit(t, dir, "commit", "-m", "waive the wiring row, on its own")

	runGit(t, dir, "checkout", "-q", "-b", "side")
	writeFile(t, filepath.Join(dir, "side.txt"), "side work\n")
	runGit(t, dir, "add", "side.txt")
	runGit(t, dir, "commit", "-m", "ordinary side work")

	runGit(t, dir, "checkout", "-q", "main")
	writeFile(t, filepath.Join(dir, "main.txt"), "main work\n")
	runGit(t, dir, "add", "main.txt")
	runGit(t, dir, "commit", "-m", "ordinary main work")

	// The evil merge: the waiver is rewritten in the merge itself, where
	// neither branch touched it.
	runGit(t, dir, "merge", "--no-ff", "--no-commit", "side")
	writeFile(t, filepath.Join(dir, file), waiverBody("honesty", "HIJACKED in an evil merge", day(0), day(20)))
	runGit(t, dir, "add", file)
	runGit(t, dir, "commit", "-m", "merge side")

	res, err := Run(dir, reg)
	if err != nil {
		t.Fatalf("the run failed: %v", err)
	}

	if got := outcomeOf(t, res, "honesty"); got != Red {
		t.Fatalf("the row is %q, want red: a waiver rewritten in a merge waived it", got)
	}

	note := noteFor(t, res, file)
	if note.Status != WaiverIgnored {
		t.Fatalf("the waiver's status is %q, want %q", note.Status, WaiverIgnored)
	}
	if !strings.Contains(note.Why, "merge") {
		t.Errorf("the reason it was ignored is %q, and it does not say the commit is a merge", note.Why)
	}
}

// The same rule from the other direction: two branches that both re-grant a
// waiver conflict, and the merge that resolves them governs the file. That
// merge is not a grant either, so the way through is a re-grant of its own on
// the merged branch.
func TestAWaiverResolvedInAMergeDoesNotStand(t *testing.T) {
	dir := newRepo(t)
	reg := oneRed(t, dir)

	file := dropWaiver(t, dir, "w.json", waiverBody("honesty", "the first reason", day(0), day(1)))
	runGit(t, dir, "add", file)
	runGit(t, dir, "commit", "-m", "waive the honesty row, on its own")

	runGit(t, dir, "checkout", "-q", "-b", "side")
	writeFile(t, filepath.Join(dir, file), waiverBody("honesty", "the side's reason", day(0), day(3)))
	writeFile(t, filepath.Join(dir, "side.txt"), "side work\n")
	runGit(t, dir, "add", file, "side.txt")
	runGit(t, dir, "commit", "-m", "side: a feature and a waiver edit")

	runGit(t, dir, "checkout", "-q", "main")
	writeFile(t, filepath.Join(dir, file), waiverBody("honesty", "main's reason", day(0), day(4)))
	writeFile(t, filepath.Join(dir, "main.txt"), "main work\n")
	runGit(t, dir, "add", file, "main.txt")
	runGit(t, dir, "commit", "-m", "main: a feature and a waiver edit")

	// The merge conflicts on the waiver, and the person resolves it there.
	if out, err := tryGit(dir, "merge", "--no-ff", "side"); err == nil {
		t.Fatalf("the two branches did not conflict on the waiver: %s", out)
	}
	writeFile(t, filepath.Join(dir, file), waiverBody("honesty", "RESOLVED IN THE MERGE", day(0), day(20)))
	runGit(t, dir, "add", file)
	runGit(t, dir, "commit", "--no-edit")

	res, err := Run(dir, reg)
	if err != nil {
		t.Fatalf("the run failed: %v", err)
	}

	if got := outcomeOf(t, res, "honesty"); got != Red {
		t.Fatalf("the row is %q, want red: a waiver resolved in a merge waived it", got)
	}
	if note := noteFor(t, res, file); !strings.Contains(note.Why, "merge") {
		t.Errorf("the reason it was ignored is %q, and it does not say the commit is a merge", note.Why)
	}
}

// And the re-grant that follows a resolved merge does stand. The rule refuses
// merges, not the branch they made.
func TestARegrantAfterAMergeStands(t *testing.T) {
	dir := newRepo(t)
	reg := oneRed(t, dir)

	file := dropWaiver(t, dir, "w.json", waiverBody("honesty", "the first reason", day(0), day(1)))
	runGit(t, dir, "add", file)
	runGit(t, dir, "commit", "-m", "waive the honesty row, on its own")

	runGit(t, dir, "checkout", "-q", "-b", "side")
	writeFile(t, filepath.Join(dir, "side.txt"), "side work\n")
	runGit(t, dir, "add", "side.txt")
	runGit(t, dir, "commit", "-m", "ordinary side work")

	runGit(t, dir, "checkout", "-q", "main")
	runGit(t, dir, "merge", "--no-ff", "-m", "merge the side branch", "side")

	writeFile(t, filepath.Join(dir, file), waiverBody("honesty", "re-granted after the merge", day(0), day(5)))
	runGit(t, dir, "add", file)
	runGit(t, dir, "commit", "-m", "re-grant the waiver, on its own")

	res, err := Run(dir, reg)
	if err != nil {
		t.Fatalf("the run failed: %v", err)
	}

	if got := outcomeOf(t, res, "honesty"); got != Waived {
		t.Fatalf("the row is %q, want waived", got)
	}
}

// D38 ruling 6, standing on its own: a file that is not a waiver fails a run
// where nothing at all is red. Without this the rule rides on some other row's
// red, and nothing proves the run failed for the reason it says.
func TestAnUnreadableFileFailsARunWithNothingRed(t *testing.T) {
	dir := newRepo(t)
	reg := oneRed(t, dir)

	putWaiver(t, dir, "honesty-1.json", waiverBody("honesty", "the scan is wrong here", day(0), day(5)))
	putWaiver(t, dir, ".gitkeep", "")

	res, err := Run(dir, reg)
	if err != nil {
		t.Fatalf("the run failed: %v", err)
	}

	if res.Red() {
		t.Fatalf("the fixture has a red row, so it cannot prove what fails the run: %v", res.Counts)
	}
	if !res.Failed() {
		t.Fatal("a run holding a file that is not a waiver passed")
	}
}

// D54 ruling 1, and D64's low: the record row and the waiver authority ask one
// question about a commit at the edge of a shallow clone, through atTheEdge.
// This holds the two callers to the one answer on one fixture.
func TestTheEdgeOfAShallowCloneIsOneRuleForBothReaders(t *testing.T) {
	cases := []struct {
		name    string
		parents int
		shallow bool
		want    bool
	}{
		{"the graft of a shallow clone", 0, true, true},
		{"a repository's own first commit", 0, false, false},
		{"an ordinary commit in a shallow clone", 1, true, false},
		{"an ordinary commit", 1, false, false},
	}

	for _, c := range cases {
		t.Run(c.name, func(t *testing.T) {
			if got := atTheEdge(c.parents, c.shallow); got != c.want {
				t.Fatalf("atTheEdge said %v, want %v", got, c.want)
			}
		})
	}
}

// And through both rows on one repo: a depth-one clone's graft is untrustworthy
// to the waiver authority and to the record row alike.
func TestBothReadersRefuseTheSameGraftCommit(t *testing.T) {
	dir := recordRepo(t, recordPath)
	writeSource(t, dir, recordPath, "# The record\n")
	commitAll(t, dir, "the plan and the record")
	grant(t, dir, "honesty-20260801-aaaa.json", "honesty", "demo_bet")
	writeSource(t, dir, "alpha/alpha.go", "package alpha\n")
	land(t, dir, "demo_s1")

	clone := shallowClone(t, dir)

	record := runRow(t, clone, "record")
	mustFit(t, record.Evidence, "the edge of this shallow clone")

	set, err := loadWaivers(clone, Default(), time.Now())
	if err != nil {
		t.Fatalf("the waivers did not read: %v", err)
	}
	if len(set.notes) != 1 {
		t.Fatalf("the clone holds %d waiver notes, want 1", len(set.notes))
	}
	if !strings.Contains(set.notes[0].Why, "edge of this clone") {
		t.Fatalf("the waiver authority said %q, and the record row read the same commit as the edge",
			set.notes[0].Why)
	}
}
