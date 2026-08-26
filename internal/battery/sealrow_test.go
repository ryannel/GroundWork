package battery

import (
	"bytes"
	"fmt"
	"os"
	"os/exec"
	"path/filepath"
	"strconv"
	"strings"
	"testing"
	"unicode"

	"github.com/ryannel/groundwork/internal/journal"
	"github.com/ryannel/groundwork/internal/seal"
)

// commitSealed writes a file and commits it. The row reads blob hashes from
// git, so a covered path has to be a path git actually holds.
func commitSealed(t *testing.T, dir, path, content string) {
	t.Helper()

	full := filepath.Join(dir, filepath.FromSlash(path))
	if err := os.MkdirAll(filepath.Dir(full), 0o750); err != nil {
		t.Fatalf("could not make %s: %v", filepath.Dir(full), err)
	}
	writeFile(t, full, content)
	runGit(t, dir, "add", "--", path)
	runGit(t, dir, "commit", "-m", "add "+path)
}

// runGitStdin runs one git command with stdin and returns its trimmed stdout.
// A tag object carrying a hostile message cannot be made through git tag, so
// this builds one through plumbing.
func runGitStdin(t *testing.T, dir, stdin string, args ...string) string {
	t.Helper()

	cmd := exec.Command("git", append([]string{"-C", dir}, args...)...)
	cmd.Stdin = strings.NewReader(stdin)

	var out, errOut bytes.Buffer
	cmd.Stdout = &out
	cmd.Stderr = &errOut

	if err := cmd.Run(); err != nil {
		t.Fatalf("git %s failed: %v: %s", strings.Join(args, " "), err, errOut.String())
	}

	return strings.TrimSpace(out.String())
}

// sealedRepo makes a repo holding one design seal over one path, granted on a
// green battery run, and returns the repo and the tag.
func sealedRepo(t *testing.T) (string, string) {
	t.Helper()

	dir := newRepo(t)
	t.Setenv("GROUNDWORK_SESSION", "s-seal")
	commitSealed(t, dir, "docs/one.md", "one\n")

	if _, err := journal.WriteBattery(dir, journal.Battery{
		RunID:   "run-20260826T120000Z-abcd",
		Version: "8.0+r1234567",
		Counts: map[string]int{
			"green": 10, "red": 0, "waived": 0, "quarantined": 0, "unrunnable": 0,
		},
		DurationMS: 1,
	}); err != nil {
		t.Fatalf("could not record a battery run: %v", err)
	}

	granted, err := seal.GrantSeal(dir, seal.Grant{
		Kind: "design", Subject: "b3s3", Paths: []string{"docs/one.md"},
	})
	if err != nil {
		t.Fatalf("granting a seal failed: %v", err)
	}

	return dir, granted.Tag
}

// The row exists, and it is registered. A row that exists but runs nowhere is
// a check that never runs.
func TestTheSealRowIsRegistered(t *testing.T) {
	registered(t, "seal-verify", "seal-verify")
}

// A repo that holds no seal tag states no seal, so it can misstate none. This
// is the plan row's precedent, ruled in D45: no subject is green, and the line
// says only that.
func TestSealRowIsGreenOnARepoWithNoSeal(t *testing.T) {
	dir := newRepo(t)

	res := runRow(t, dir, "seal-verify")
	if res.Outcome != Green {
		t.Fatalf("a repo with no seal came out %s: %s", res.Outcome, res.Evidence)
	}
	mustFit(t, res.Evidence, "no seal")
	// It must not claim a seal held. None was read.
	if strings.Contains(res.Evidence, "matches") {
		t.Errorf("the line is %q, and it claims something was checked", res.Evidence)
	}
}

// TestProof_b3s3_moved_a_covered_path_turns_the_row_red is R3's whole point:
// "does the work still match what was sealed" is a hash comparison, not a
// reading, and a moved artifact is red until the tag moves through the verb.
func TestProof_b3s3_moved_a_covered_path_turns_the_row_red(t *testing.T) {
	dir, tag := sealedRepo(t)

	green := runRow(t, dir, "seal-verify")
	if green.Outcome != Green {
		t.Fatalf("a fresh seal came out %s: %s", green.Outcome, green.Evidence)
	}

	commitSealed(t, dir, "docs/one.md", "one, edited\n")

	res := runRow(t, dir, "seal-verify")
	if res.Outcome != Red {
		t.Fatalf("a moved covered path came out %s: %s", res.Outcome, res.Evidence)
	}
	mustFit(t, res.Evidence, "docs/one.md", tag)

	// D33: the count leads, because the line is read from the front and cut
	// from the end.
	if !strings.HasPrefix(res.Evidence, "1 ") {
		t.Errorf("the line is %q, and it does not open with the count", res.Evidence)
	}
}

// A covered path that is gone at HEAD is the loudest kind of moved, and the row
// must not read it as "nothing to compare".
func TestSealRowIsRedWhenACoveredPathIsGone(t *testing.T) {
	dir, _ := sealedRepo(t)

	runGit(t, dir, "rm", "--", "docs/one.md")
	runGit(t, dir, "commit", "-m", "drop it")

	res := runRow(t, dir, "seal-verify")
	if res.Outcome != Red {
		t.Fatalf("a covered path that is gone came out %s: %s", res.Outcome, res.Evidence)
	}
	mustFit(t, res.Evidence, "docs/one.md")
}

// R4: in bet 3 unsigned is loud but not blocking. The row says how many seals
// are unsigned on every line it prints, and never turns red on it. When that
// flips, it is a major battery bump, and this test is where the flip shows.
//
// D52.3: unverified is counted and printed apart from unsigned. A signature
// nothing could check is not the same as no signature, and a line that added
// them together would let a forged block read as an honest absence.
func TestSealRowSaysHowManySealsAreUnsignedAndHowManyUnverified(t *testing.T) {
	dir, _ := sealedRepo(t)

	res := runRow(t, dir, "seal-verify")
	if res.Outcome != Green {
		t.Fatalf("an unsigned seal came out %s: %s", res.Outcome, res.Evidence)
	}
	mustFit(t, res.Evidence, "1 unsigned", "0 unverified")
}

// The row could not reach the thing it checks. Unrunnable is visible, counted,
// and somebody's problem — and it is the honest answer outside a repo.
func TestSealRowIsUnrunnableOutsideARepo(t *testing.T) {
	res := runRow(t, t.TempDir(), "seal-verify")
	if res.Outcome != Unrunnable {
		t.Fatalf("the row outside a repo came out %s: %s", res.Outcome, res.Evidence)
	}
}

// F54's class, second entry (F61). The arithmetic that proves a line fits has
// to measure the true widest line, and the true widest is found by searching
// the count space — not by feeding the maximum into every field at once.
//
// Feeding maxima everywhere is what hid the defect: huge counts are exactly
// what pushed the unsigned clause off, so the old test measured a line with no
// clause on it and called 174 bytes the widest. The reviewer's search found 200
// with zero slack at seals=100, unsigned=1048576, problems=1.
//
// This searches interesting values in every field that reaches the line, at
// several problem lengths, and asserts three things of every line it builds:
// it fits, it carries every count, and it says which state each count is.
func TestTheSealRowLineIsWidestSomewhereInTheCountSpace(t *testing.T) {
	counts := []int{0, 1, 2, 9, 10, 99, 100, 999, 1000, 1 << 20, 1<<62 - 1}
	problems := []string{"", "x", strings.Repeat("p", 100), strings.Repeat("p", 400)}

	widest, at := 0, ""

	for _, seals := range counts {
		for _, paths := range counts {
			for _, unsigned := range counts {
				for _, unverified := range counts {
					for _, problem := range counts {
						for _, first := range problems {
							totals := sealTotals{
								seals: seals, paths: paths, moved: problem,
								unsigned: unsigned, unverified: unverified,
								problems: problem, first: first,
							}
							if seals == 0 {
								continue
							}

							got := totals.verdict().Evidence
							if len(got) > journal.MaxTextBytes {
								t.Fatalf("the line is %d bytes, over the journal's cap of %d: %s",
									len(got), journal.MaxTextBytes, got)
							}
							if len(got) > widest {
								widest, at = len(got), fmt.Sprintf("%+v", totals)
							}

							// D33: the counts never give way. R4: unsigned is
							// loud on every line, and D52.3 keeps the two
							// states apart on every line too.
							for _, want := range []string{
								strconv.Itoa(unsigned) + " unsigned",
								strconv.Itoa(unverified) + " unverified",
							} {
								if !strings.Contains(got, want) {
									t.Fatalf("the line %q does not say %q", got, want)
								}
							}
							if problem > 0 && !strings.Contains(got, strconv.Itoa(problem)) {
								t.Fatalf("the line %q lost its problem count", got)
							}
						}
					}
				}
			}
		}
	}

	t.Logf("the widest line the search found is %d bytes, at %s", widest, at)

	// A search that never got near the cap would prove nothing about the cap.
	if widest < journal.MaxTextBytes/2 {
		t.Errorf("the widest line found is %d bytes, and the search never came near the cap", widest)
	}
}

// F49, and D49 ruling 2. A tag message is written by whoever can write a tag,
// and in this environment that is any agent. A control character in one would
// otherwise draw a row of its own in the verify table.
func TestNothingTheSealRowSaysCarriesAControlCharacter(t *testing.T) {
	dir := newRepo(t)
	commitSealed(t, dir, "docs/one.md", "one\n")

	// A tag that names itself a seal and carries a message shaped to break out
	// of the table it will be printed in.
	commit := runGit(t, dir, "rev-parse", "HEAD")
	raw := "object " + commit + "\ntype commit\ntag seal/design/hostile\n" +
		"tagger Test Person <test@example.com> 1755000000 +0000\n\n" +
		"seal: design hostile\nand\nseal-verify\tgreen\tthe seal holds\n"
	oid := runGitStdin(t, dir, raw, "hash-object", "-t", "tag", "-w", "--stdin")
	runGit(t, dir, "update-ref", "refs/tags/seal/design/hostile", oid)

	res := runRow(t, dir, "seal-verify")
	if res.Outcome != Red {
		t.Fatalf("a tag that is not a seal message came out %s: %s", res.Outcome, res.Evidence)
	}

	for _, r := range res.Evidence {
		if !unicode.IsPrint(r) {
			t.Errorf("the row said %q, and it holds the unprintable character %q", res.Evidence, r)
		}
	}
	if strings.Contains(res.Evidence, "\n") || strings.Contains(res.Evidence, "\t") {
		t.Errorf("the row said %q, and a table would draw a second row from it", res.Evidence)
	}
	if !strings.Contains(res.Evidence, "hostile") {
		t.Errorf("the row said %q, and it does not name the tag at all", res.Evidence)
	}
}

// A row's evidence is read on a machine that is not the one that wrote it, so a
// temporary directory in a line of evidence says nothing to the reader.
func TestSealRowEvidenceNeverCarriesAMachinePath(t *testing.T) {
	dir, _ := sealedRepo(t)
	commitSealed(t, dir, "docs/one.md", "one, edited\n")

	res := runRow(t, dir, "seal-verify")
	if strings.Contains(res.Evidence, dir) || strings.Contains(res.Evidence, os.TempDir()) {
		t.Errorf("the row said %q, and it carries a path from the machine it ran on", res.Evidence)
	}
}

// The row runs against the repo it ships in. This repo has granted no seal yet:
// there is no key outside the agents' reach to sign one with, which is R4's
// whole reason. So the green here is the honest one — nothing sealed, nothing
// that can have moved — and it must not read as though a seal was checked.
func TestSealRowIsGreenOnThisRepo(t *testing.T) {
	res := runRow(t, ".", "seal-verify")
	if res.Outcome != Green {
		t.Fatalf("this repo's own seal-verify row came out %s: %s", res.Outcome, res.Evidence)
	}
	if !strings.Contains(res.Evidence, "no seal") {
		t.Errorf("the row said %q, and this repo holds no seal tag", res.Evidence)
	}
}

// D23: a row added moves the major half of the version. This slice adds the
// seal-verify row, so 7.0 — the version the chain row's slice closed at — is no
// longer a version anybody can be held to. The digest moves with the row list,
// and the version row would find that drift on this repo first.
func TestThisRepoDeclaresTheBumpTheSealRowCost(t *testing.T) {
	lock, err := ReadLock(".")
	if err != nil {
		t.Fatalf("this repo's lock file did not read: %v", err)
	}

	if lock.Digest != Default().Digest() {
		t.Errorf("%s declares the digest %s, and the shipped rows compute %s",
			LockFile, lock.Digest, Default().Digest())
	}

	half, _, _ := strings.Cut(lock.Version, ".")
	major, err := strconv.Atoi(half)
	if err != nil {
		t.Fatalf("%s declares the version %q, whose major half is not a number", LockFile, lock.Version)
	}
	if major < 8 {
		t.Errorf("%s declares %s, and the seal-verify row puts this battery at 8.0 or past it",
			LockFile, lock.Version)
	}
}

// The committed allowed-signers file is what a fresh clone verifies against, so
// it ships in this repo rather than being made on the machine that runs the
// check. It is empty of keys today: no key in this environment sits outside the
// agents' reach, and R4 names the flip that changes that.
func TestThisRepoShipsAnAllowedSignersFile(t *testing.T) {
	root, err := journal.RepoRoot(".")
	if err != nil {
		t.Fatalf("could not find the repo root: %v", err)
	}

	raw, err := os.ReadFile(filepath.Join(root, filepath.FromSlash(seal.AllowedSignersFile)))
	if err != nil {
		t.Fatalf("this repo does not ship %s: %v", seal.AllowedSignersFile, err)
	}

	for _, line := range strings.Split(string(raw), "\n") {
		line = strings.TrimSpace(line)
		if line != "" && !strings.HasPrefix(line, "#") {
			t.Errorf("%s lists the key %q, and this repo declares no signer yet",
				seal.AllowedSignersFile, line)
		}
	}
}

// clipProblem is the row's own half of D49 ruling 2: every value a line takes
// off a tag goes through printable before it goes through the clip.
//
// Nothing that reaches the row today can carry a control character — the seal
// package clips every value it takes off a tag, and git will not hold a control
// character in a ref name. So no run of the row can exercise this, and it is
// proved directly rather than left as a guard with no test behind it.
func TestTheSealRowMakesAProblemSafeToPrint(t *testing.T) {
	got := clipProblem("a\nseal-verify\tgreen\tthe seal holds", 100)

	for _, r := range got {
		if !unicode.IsPrint(r) {
			t.Errorf("clipProblem gave %q, and it holds the unprintable character %q", got, r)
		}
	}
	if strings.Contains(got, "\n") || strings.Contains(got, "\t") {
		t.Errorf("clipProblem gave %q, and a table would draw a second row from it", got)
	}
	if !strings.Contains(got, "seal-verify") {
		t.Errorf("clipProblem gave %q, and it lost the words", got)
	}
}
