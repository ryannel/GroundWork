package seal

import (
	"bytes"
	"os"
	"os/exec"
	"path/filepath"
	"slices"
	"strconv"
	"strings"
	"testing"
	"unicode"
)

// newRepo makes a git repo with one commit in a temp dir and returns its path.
func newRepo(t *testing.T) string {
	t.Helper()

	dir := t.TempDir()
	for _, args := range [][]string{
		{"init", "-b", "main"},
		{"config", "user.name", "Test Person"},
		{"config", "user.email", "test@example.com"},
		// D64 ruling 9: a fixture has nothing to sign, and the host's signing
		// shim dies under load, which reads as a proof that failed (F104).
		{"config", "commit.gpgsign", "false"},
	} {
		runGit(t, dir, args...)
	}

	writeFile(t, filepath.Join(dir, "README.md"), "start\n")
	runGit(t, dir, "add", "README.md")
	runGit(t, dir, "commit", "-m", "first")

	return dir
}

// runGit runs one git command in dir and returns its trimmed stdout.
func runGit(t *testing.T, dir string, args ...string) string {
	t.Helper()

	out, err := tryGit(dir, args...)
	if err != nil {
		t.Fatalf("git %s failed: %v", strings.Join(args, " "), err)
	}

	return out
}

// tryGit runs one git command and returns its trimmed stdout, or the error.
func tryGit(dir string, args ...string) (string, error) {
	cmd := exec.Command("git", append([]string{"-C", dir}, args...)...)

	var out, errOut bytes.Buffer
	cmd.Stdout = &out
	cmd.Stderr = &errOut

	if err := cmd.Run(); err != nil {
		return "", err
	}

	return strings.TrimSpace(out.String()), nil
}

// gitStdin runs one git command with stdin and returns its trimmed stdout.
func gitStdin(t *testing.T, dir, stdin string, args ...string) string {
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

func writeFile(t *testing.T, path, content string) {
	t.Helper()

	if err := os.MkdirAll(filepath.Dir(path), 0o750); err != nil {
		t.Fatalf("could not make %s: %v", filepath.Dir(path), err)
	}
	if err := os.WriteFile(path, []byte(content), 0o600); err != nil {
		t.Fatalf("could not write %s: %v", path, err)
	}
}

// commitFile writes a file, commits it, and returns its blob hash.
func commitFile(t *testing.T, dir, path, content string) string {
	t.Helper()

	writeFile(t, filepath.Join(dir, path), content)
	runGit(t, dir, "add", "--", path)
	runGit(t, dir, "commit", "-m", "add "+path)

	return runGit(t, dir, "rev-parse", "HEAD:"+path)
}

// goodMessage is one whole seal message in the shape the contract fixes.
const goodMessage = `seal: design b3s3

covers:
  1111111111111111111111111111111111111111 docs/one.md
  2222222222222222222222222222222222222222 docs/two.md

Battery: 8.0+r1234567
Battery-Run: run-20260826T120000Z-abcd
`

// The four kinds are closed. R3 fixes the list, and the journal's seal_kind is
// closed to the same four.
func TestTheSealKindVocabularyIsPinned(t *testing.T) {
	want := []string{"design", "acceptance", "birth", "adoption"}

	if !slices.Equal(Kinds(), want) {
		t.Fatalf("the seal kinds are %v, want %v", Kinds(), want)
	}
}

func TestTagNameIsKindAndSubject(t *testing.T) {
	got, err := TagName("design", "b3s3")
	if err != nil {
		t.Fatalf("naming a design seal failed: %v", err)
	}
	if got != "seal/design/b3s3" {
		t.Fatalf("the tag name is %q, want seal/design/b3s3", got)
	}
}

// A kind outside the four, or a subject outside the id charset, names no tag.
// The tag name is a ref, and a ref built from an unchecked string is how a
// name with a slash or a dash in it becomes something else entirely.
func TestTagNameRefusesWhatIsNotASeal(t *testing.T) {
	cases := []struct {
		name    string
		kind    string
		subject string
		says    string
	}{
		{"a kind nobody declared", "review", "b3s3", "review"},
		{"an empty kind", "", "b3s3", "kind"},
		{"an empty subject", "design", "", "subject"},
		{"a subject with a slash", "design", "b3/s3", "subject"},
		{"a subject with a dash", "design", "b3-s3", "subject"},
		{"a subject in capitals", "design", "B3S3", "subject"},
		{"a subject that opens with a dash", "design", "-rf", "subject"},
		{"a subject over the cap", "design", strings.Repeat("a", 65), "subject"},
	}

	for _, c := range cases {
		t.Run(c.name, func(t *testing.T) {
			_, err := TagName(c.kind, c.subject)
			if err == nil {
				t.Fatalf("%s named a tag", c.name)
			}
			if !strings.Contains(err.Error(), c.says) {
				t.Errorf("the error is %q, and it does not say %q", err, c.says)
			}
		})
	}
}

// Render and ParseMessage are the two halves of one shape, and the contract
// section they implement is the one page that says what that shape is.
func TestAMessageRendersAndReadsBack(t *testing.T) {
	m := Message{
		Kind:    "design",
		Subject: "b3s3",
		Covered: []Covered{
			{Blob: strings.Repeat("1", 40), Path: "docs/one.md"},
			{Blob: strings.Repeat("2", 40), Path: "docs/two.md"},
		},
		Battery:    "8.0+r1234567",
		BatteryRun: "run-20260826T120000Z-abcd",
	}

	text, err := m.Render()
	if err != nil {
		t.Fatalf("rendering a good message failed: %v", err)
	}
	if text != goodMessage {
		t.Fatalf("the message rendered as:\n%s\nwant:\n%s", text, goodMessage)
	}

	back, err := ParseMessage(text)
	if err != nil {
		t.Fatalf("the rendered message did not read back: %v", err)
	}
	if back.Kind != m.Kind || back.Subject != m.Subject {
		t.Errorf("the message read back as %s %s, want %s %s", back.Kind, back.Subject, m.Kind, m.Subject)
	}
	if back.Battery != m.Battery || back.BatteryRun != m.BatteryRun {
		t.Errorf("the battery pair read back as %q and %q", back.Battery, back.BatteryRun)
	}
	if !slices.Equal(back.Covered, m.Covered) {
		t.Errorf("the covered paths read back as %v, want %v", back.Covered, m.Covered)
	}
}

// Render sorts the covered paths, so two grants of the same set produce the
// same bytes and the tag object id is a function of what was sealed.
func TestRenderSortsTheCoveredPaths(t *testing.T) {
	m := Message{
		Kind:    "design",
		Subject: "b3s3",
		Covered: []Covered{
			{Blob: strings.Repeat("2", 40), Path: "docs/two.md"},
			{Blob: strings.Repeat("1", 40), Path: "docs/one.md"},
		},
		Battery:    "8.0+r1234567",
		BatteryRun: "run-20260826T120000Z-abcd",
	}

	text, err := m.Render()
	if err != nil {
		t.Fatalf("rendering failed: %v", err)
	}
	if text != goodMessage {
		t.Fatalf("the message rendered as:\n%s\nwant the paths sorted:\n%s", text, goodMessage)
	}
}

// A tag message is written by whoever can write a tag, and in this environment
// that is any agent. So every shape that is not the one the contract fixes is
// refused by name, and none of it is guessed at.
func TestParseMessageRefusesHostileShapes(t *testing.T) {
	cases := []struct {
		name string
		text string
		says string
	}{
		{"empty", "", "empty"},
		{"no seal line", "covers:\n", "seal:"},
		{
			"a first line that names a kind and a subject with no seal: on it",
			strings.Replace(goodMessage, "seal: design b3s3", "design b3s3", 1),
			"seal:",
		},
		{
			"a kind nobody declared",
			strings.Replace(goodMessage, "seal: design", "seal: review", 1),
			"review",
		},
		{
			"a subject outside the charset",
			strings.Replace(goodMessage, "design b3s3", "design b3-s3", 1),
			"subject",
		},
		{
			"a seal line with a third word",
			strings.Replace(goodMessage, "seal: design b3s3", "seal: design b3s3 extra", 1),
			"seal:",
		},
		{
			"no blank line under the seal line",
			strings.Replace(goodMessage, "b3s3\n\ncovers", "b3s3\ncovers", 1),
			"blank",
		},
		{
			"no covers heading",
			strings.Replace(goodMessage, "covers:", "paths:", 1),
			"covers:",
		},
		{
			"no covered path at all",
			"seal: design b3s3\n\ncovers:\n\nBattery: 8.0+r1234567\nBattery-Run: run-20260826T120000Z-abcd\n",
			"covers",
		},
		{
			"a covered line with no indent",
			strings.Replace(goodMessage, "  1111", "1111", 1),
			"two spaces",
		},
		{
			"a blob that is not forty hex",
			strings.Replace(goodMessage, strings.Repeat("1", 40), strings.Repeat("1", 39), 1),
			"blob",
		},
		{
			"a blob in capitals",
			strings.Replace(goodMessage, strings.Repeat("1", 40), strings.Repeat("A", 40), 1),
			"blob",
		},
		{
			"a path that starts with a dash",
			strings.Replace(goodMessage, "docs/one.md", "-rf", 1),
			"path",
		},
		{
			"a path that climbs out of the repo",
			strings.Replace(goodMessage, "docs/one.md", "../secrets", 1),
			"path",
		},
		{
			"a path that opens with an underscore",
			strings.Replace(goodMessage, "docs/one.md", "_leading.md", 1),
			"path",
		},
		{
			"a path carrying pathspec magic",
			strings.Replace(goodMessage, "docs/one.md", ":(glob)**", 1),
			"path",
		},
		{
			"a path with a space in it",
			strings.Replace(goodMessage, "docs/one.md", "docs/one two.md", 1),
			"path",
		},
		{
			"a path over the cap",
			strings.Replace(goodMessage, "docs/one.md", strings.Repeat("a", 301), 1),
			"path",
		},
		{
			"the same path twice",
			strings.Replace(goodMessage, "docs/two.md", "docs/one.md", 1),
			"twice",
		},
		{
			"paths out of order",
			strings.Replace(strings.Replace(goodMessage, "docs/one.md", "docs/zzz.md", 1),
				"docs/two.md", "docs/aaa.md", 1),
			"sorted",
		},
		{
			"no battery trailer",
			strings.Replace(goodMessage, "Battery: 8.0+r1234567\n", "", 1),
			"Battery:",
		},
		{
			"no battery-run trailer",
			strings.Replace(goodMessage, "Battery-Run: run-20260826T120000Z-abcd\n", "", 1),
			"Battery-Run:",
		},
		{
			"a trailer with no name on it",
			strings.Replace(goodMessage, "Battery: 8.0+r1234567", "8.0+r1234567", 1),
			"Battery:",
		},
		{
			"a battery pair with no digest",
			strings.Replace(goodMessage, "8.0+r1234567", "8.0", 1),
			"Battery:",
		},
		{
			"a battery-run that is not a run id",
			strings.Replace(goodMessage, "run-20260826T120000Z-abcd", "yesterday", 1),
			"Battery-Run:",
		},
		{
			"the trailers the other way round",
			"seal: design b3s3\n\ncovers:\n  " + strings.Repeat("1", 40) +
				" docs/one.md\n\nBattery-Run: run-20260826T120000Z-abcd\nBattery: 8.0+r1234567\n",
			"Battery:",
		},
		{
			"a trailer nobody declared",
			strings.Replace(goodMessage, "Battery: 8.0+r1234567",
				"Battery: 8.0+r1234567\nApproved-By: me", 1),
			"Approved-By",
		},
		{
			"words after the trailers",
			goodMessage + "and the owner said yes\n",
			"after",
		},
		{
			"a message over the cap",
			goodMessage + strings.Repeat("x", MaxMessageBytes),
			"bytes",
		},
		{
			"a message carrying a carriage return",
			strings.Replace(goodMessage, "covers:", "covers:\r", 1),
			"covers:",
		},
	}

	for _, c := range cases {
		t.Run(c.name, func(t *testing.T) {
			_, err := ParseMessage(c.text)
			if err == nil {
				t.Fatalf("%s parsed as a seal message", c.name)
			}
			if !strings.Contains(err.Error(), c.says) {
				t.Errorf("the error is %q, and it does not say %q", err, c.says)
			}
		})
	}
}

// clip is what makes a value off a tag safe to print, and safe comes before
// short. Every error here quotes its values with %q, which escapes a control
// character on its own — so nothing that goes through an error proves this. It
// is proved directly instead. D50 ruling 1 is the warning: change one %q to %s
// and the line becomes a forger's, and this is the guard that still holds then.
func TestClipMakesAValueOffATagSafeToPrint(t *testing.T) {
	got := clip("a\nseal-verify\tgreen\tthe seal holds")

	for _, r := range got {
		if !unicode.IsPrint(r) {
			t.Errorf("clip gave %q, and it holds the unprintable character %q", got, r)
		}
	}
	if strings.Contains(got, "\n") || strings.Contains(got, "\t") {
		t.Errorf("clip gave %q, and a table would draw a second row from it", got)
	}
	// The words survive. A clip that dropped them would tell the reader nothing.
	if !strings.Contains(got, "seal-verify") {
		t.Errorf("clip gave %q, and it lost the words", got)
	}
}

// A refusal names what it refused, so a person can find it in the tag. It must
// not paste the whole message back: the message is somebody else's text, and an
// error the size of a tag is not readable.
func TestParseMessageRefusalsStayShort(t *testing.T) {
	huge := strings.Replace(goodMessage, "docs/one.md", strings.Repeat("a", 301), 1)

	_, err := ParseMessage(huge)
	if err == nil {
		t.Fatal("a 301-byte path parsed")
	}
	if len(err.Error()) > 200 {
		t.Errorf("the error is %d bytes: %s", len(err.Error()), err)
	}
}

// --- the contract page ----------------------------------------------------

// contractSection is the heading this package's parser implements. R17: the
// derivation contract is one page, and every kept parser's test names the
// section it implements, so read and write ship in one commit.
const contractSection = "## 2. The seal tag"

// tableRows returns the field each row of a markdown table names, read from the
// first cell. It reads rows and not the section's prose, because a field named
// in a sentence is not a field in the table — and the table is what a person
// writing a seal line reads.
func tableRows(body string) map[string]bool {
	named := map[string]bool{}

	for _, line := range strings.Split(body, "\n") {
		if !strings.HasPrefix(strings.TrimSpace(line), "|") {
			continue
		}

		cells := strings.Split(strings.TrimSpace(line), "|")
		if len(cells) < 2 {
			continue
		}

		field := strings.Trim(strings.TrimSpace(cells[1]), "`")
		if field != "" {
			named[field] = true
		}
	}

	return named
}

// sectionBody returns the text of the section opening with head, up to the next
// heading at the same level or above. A rule named under the wrong heading is
// not named.
func sectionBody(page, head string) string {
	at := strings.Index(page, head)
	if at < 0 {
		return ""
	}

	rest := page[at+len(head):]
	for _, next := range []string{"\n### ", "\n## "} {
		if end := strings.Index(rest, next); end >= 0 {
			rest = rest[:end]
		}
	}

	return rest
}

func contractPage(t *testing.T) string {
	t.Helper()

	raw, err := os.ReadFile(filepath.Join("..", "..", "docs", "derivation-contract.md"))
	if err != nil {
		t.Fatalf("the derivation contract did not read: %v", err)
	}

	return string(raw)
}

// Every literal this parser holds somebody's tag to is written on the page. A
// rule nobody can read is a refusal that arrives as a surprise.
func TestTheContractWritesTheSealTagShape(t *testing.T) {
	page := contractPage(t)
	if !strings.Contains(page, contractSection) {
		t.Fatalf("the derivation contract holds no section titled %q", contractSection)
	}

	want := []string{
		"`seal:`", "`covers:`", "`Battery:`", "`Battery-Run:`",
		"`seal/<kind>/<subject-id>`",
		"`" + Branch + "`", "`" + IndexFile + "`", "`" + TagDir + "`", "`" + PriorDir + "`",
		"`" + AllowedSignersFile + "`",
		"`battery`", "`battery_run`", "`signature`", "`signer`",
	}
	for _, kind := range Kinds() {
		want = append(want, "`"+kind+"`")
	}
	for _, word := range want {
		if !strings.Contains(page, word) {
			t.Errorf("the derivation contract never spells %s", word)
		}
	}

	// F64: the page has to give every shape the parser enforces, and every red
	// the row reports. The Battery-Run shape was missing, and so was the
	// name-versus-message check.
	runs := sectionBody(page, "### 2.1 The message")
	if !strings.Contains(runs, "`run-<") {
		t.Error("section 2.1 never gives the shape of a run id")
	}

	// D52.6: the deeper limit is named on the page rather than fixed. Anyone who
	// can push to the mirror can invent a well-formed seal there, and it will
	// restore and verify — only a signature can bind a seal to its author.
	branch := sectionBody(page, "### 2.3 The mirror")
	for _, want := range []string{"invent", "signature"} {
		if !strings.Contains(branch, want) {
			t.Errorf("section 2.3 never says a seal invented on the mirror restores and verifies")

			break
		}
	}

	uses := sectionBody(page, "### 2.5 What the tools do with this")
	if !strings.Contains(uses, "its own message") {
		t.Error("section 2.5 never says a tag whose name and message disagree is red")
	}

	// F69: the fields the seal line carries have to be in section 2.4's own
	// table, not merely somewhere on the page. F64's class came back through
	// the fix for F65, and this is what would have caught it.
	rows := tableRows(sectionBody(page, "### 2.4 The journal's seal line"))
	for _, field := range []string{"battery", "battery_run", "reason", "signature", "signer"} {
		if !rows[field] {
			t.Errorf("section 2.4's table has no row for %s", field)
		}
	}

	caps := []string{
		strconv.Itoa(MaxMessageBytes) + " bytes",
		strconv.Itoa(MaxPathBytes) + " bytes",
		strconv.Itoa(MaxSubjectBytes) + " bytes",
	}
	for _, size := range caps {
		if !strings.Contains(page, size) {
			t.Errorf("the derivation contract never writes the cap %q", size)
		}
	}
}
