package battery

import (
	"bytes"
	"fmt"
	"io/fs"
	"path/filepath"
	"regexp"
	"slices"
	"strings"
)

// The token scan looks for raw style literals: a colour written into a source
// file instead of taken from the project's design tokens (proof.md).
//
// It does not apply everywhere, and where it does not apply it says so out
// loud. A cli surface and a library surface have no design system to bypass,
// so the row reports green with the words "not applicable to profile cli, by
// declaration" rather than quietly passing. proof.md's rule is the same one
// D25 applies to stacks: a check with nothing to run is declared, never
// silently skipped. A reader of the board can tell a scan that ran from a scan
// that had nothing to do.
//
// Hex colours are what this slice reads. Fonts, spacing, and colours written
// by name — red, rgb(), var() with no token behind it — are the same shape of
// check and land with the design system that names them. A scan that guessed
// at which number is a spacing value, or which word is a colour, would be
// inventing reds.
//
// The residue this leaves, stated rather than found later: a hex-shaped
// constant that is not a colour still reds when it stands where a value goes
// and outside a comment — a checksum written as x = "#deadbeef" is the shape.
// The comment and value-position rules take out the common cases; what is left
// is rare, visible, and waivable, which is the trade this row is willing to
// make. A colour written into a comment goes unread for the same reason.

// tokenRow is the raw design-token scan.
func tokenRow() Row {
	return Row{
		ID:       "token",
		Kind:     "token",
		Severity: Blocking,
		Check:    checkToken,
	}
}

// tokenlessProfiles are the profiles the token scan does not apply to. Neither
// ships a rendered interface, so neither has design tokens to bypass.
var tokenlessProfiles = []string{"cli", "library"}

// tokenExtensions are the files a design token can be written into. The list
// is what the shipped stacks use to describe a surface, and it is deliberately
// short: a file type nobody styles in is a file type this scan would only
// produce noise from.
var tokenExtensions = []string{
	".css", ".scss", ".sass", ".less",
	".html", ".htm", ".svg", ".vue", ".svelte",
	".js", ".jsx", ".mjs", ".cjs", ".ts", ".tsx",
	".go", ".kt", ".swift", ".dart", ".xml",
}

// rawHex matches a colour written as hex: #RGB, #RRGGBB, or #RRGGBBAA.
//
// The lengths are tried longest first, and each one has to end at a word
// boundary, so #abcd and #abcdef123 are left alone. Both are hex-shaped and
// neither is a colour, and a scan that flagged them would be teaching people
// to ignore it.
var rawHex = regexp.MustCompile(`(?i)#(?:[0-9a-f]{8}|[0-9a-f]{6}|[0-9a-f]{3})\b`)

func checkToken(c Context) Result {
	s, bad, ok := openScan("token scan", c)
	if !ok {
		return bad
	}

	var (
		hits     []hit
		notes    scanNotes
		declared []string
		blocked  []string
		surfaces int
		files    int
	)

	for _, surface := range s.m.Surfaces {
		if slices.Contains(tokenlessProfiles, surface.Profile) {
			said := fmt.Sprintf("not applicable to profile %s, by declaration", surface.Profile)
			if !slices.Contains(declared, said) {
				declared = append(declared, said)
			}
			continue
		}
		surfaces++

		err := filepath.WalkDir(s.dir(surface), func(path string, d fs.DirEntry, err error) error {
			if err != nil {
				return err
			}
			if d.IsDir() {
				if path != s.dir(surface) && skipDir(d.Name()) {
					return filepath.SkipDir
				}

				return nil
			}
			if !styleFile(d.Name()) || testFile(s.rel(path)) {
				return nil
			}

			src, state := openFile(path, d, &notes)
			if state != fileRead {
				return nil
			}
			files++
			hits = append(hits, rawColours(s.rel(path), src)...)

			return nil
		})
		if err != nil {
			// A surface that will not open does not cancel a colour found on
			// another one. The unreadable surface rides in the evidence beside
			// whatever was found, so neither is lost.
			blocked = append(blocked,
				fmt.Sprintf("the surface %q could not be read: %s", surface.Name, s.reason(err)))
		}
	}

	tail := ""
	if len(declared) > 0 {
		tail += "; " + strings.Join(declared, "; ")
	}
	if len(blocked) > 0 {
		tail += "; " + listed(blocked, "; ")
	}
	tail += notes.String()

	switch {
	case len(hits) > 0:
		return Result{
			Outcome: Red,
			Evidence: hitEvidence(
				fmt.Sprintf("the token scan found %s written into source: ",
					counted(len(hits), "raw colour", "raw colours")),
				hits, tail),
		}

	case len(blocked) > 0:
		return Result{
			Outcome: Unrunnable,
			Evidence: cut(fmt.Sprintf("the token scan could not read what it was pointed at: %s%s",
				listed(blocked, "; "), notes)),
		}

	case surfaces == 0:
		return Result{
			Outcome:  Green,
			Evidence: "the token scan is " + strings.Join(declared, "; "),
		}

	case files == 0:
		// D17: a verifier may never pass on nothing. An applicable surface
		// holding no file this scan can read has not been checked, and green
		// would say it had.
		return Result{
			Outcome: Unrunnable,
			Evidence: fmt.Sprintf("the token scan found no file it reads on %s, so it checked nothing%s",
				counted(surfaces, "applicable surface", "applicable surfaces"), tail),
		}

	default:
		return Result{
			Outcome: Green,
			Evidence: fmt.Sprintf("the token scan read %s on %s and found no raw hex colour%s",
				counted(files, "file", "files"), counted(surfaces, "surface", "surfaces"), tail),
		}
	}
}

// rawColours finds every hex colour in one file, with the line it sits on.
//
// Hex shape alone is not enough, because plenty of hex-shaped text is not a
// colour: an issue number in a comment, a fragment link, a magic constant. Two
// more things have to be true, and both are read from what stands before the
// match on its own line.
//
// It must sit where a value goes — after a colon or an equals sign, or inside a
// quote that has not been closed. That is where a colour is written in every
// language this scan reads, and "see issue #404" is not such a place.
//
// It must not be in a comment. The line is read for the marks that start one:
// //, /*, <!--, and a line that continues a block comment with a leading *.
//
// Lines are counted over the bytes rather than split into them, so a minified
// file that is one line long is read like any other — and so a file holding
// bytes that are not text is read at all. What reaches the evidence is the
// literal itself, which is hex and therefore always text.
func rawColours(file string, src []byte) []hit {
	var found []hit

	for _, at := range rawHex.FindAllIndex(src, -1) {
		literal := string(src[at[0]:at[1]])
		before := lineBefore(src, at[0])

		if allDigits(literal[1:]) || inComment(before) || !valuePosition(before) {
			continue
		}

		found = append(found, hit{
			file:    file,
			line:    bytes.Count(src[:at[0]], []byte("\n")) + 1,
			subject: literal,
			shape:   "is a raw colour, not a design token",
		})
	}

	return found
}

// lineBefore returns what stands on the match's own line, in front of it.
func lineBefore(src []byte, at int) string {
	start := bytes.LastIndexByte(src[:at], '\n') + 1

	return string(src[start:at])
}

// allDigits reports whether a hex body holds no letter. #404 and #123 are an
// issue number and a status code far more often than they are a colour, and a
// three-digit colour that happens to be all digits is the price of not firing
// on every one of them.
func allDigits(body string) bool {
	return strings.IndexFunc(body, func(r rune) bool {
		return r < '0' || r > '9'
	}) < 0
}

// inComment reports whether the match sits in a comment, judged from its own
// line. It is an approximation, and it errs towards calling a line a comment:
// a colour the scan passes over is a smaller harm than a red on a line of
// prose.
func inComment(before string) bool {
	if strings.Contains(before, "//") || strings.Contains(before, "/*") || strings.Contains(before, "<!--") {
		return true
	}

	trimmed := strings.TrimSpace(before)

	return strings.HasPrefix(trimmed, "*") || strings.HasPrefix(trimmed, "#")
}

// valuePosition reports whether the match stands where a value is written:
// after a colon or an equals sign, or inside a quote still open on that line.
func valuePosition(before string) bool {
	if strings.ContainsAny(before, ":=") {
		return true
	}

	return strings.Count(before, `"`)%2 == 1 || strings.Count(before, "'")%2 == 1
}

// styleFile reports whether a file is one a design token could be written
// into, and whether it is a token definition file.
//
// A file whose name holds "token" is where the colours are meant to live, so
// it is exempt. The rule is the file name because that is the one thing every
// stack agrees on; a manifest key for it can come later without moving what
// the scan means.
func styleFile(name string) bool {
	if strings.Contains(strings.ToLower(name), "token") {
		return false
	}

	return slices.Contains(tokenExtensions, strings.ToLower(filepath.Ext(name)))
}

// testFile reports whether a path is test code rather than shipped surface. A
// colour in a fixture is not a bypassed token.
func testFile(rel string) bool {
	base := strings.ToLower(filepath.Base(rel))
	if strings.HasSuffix(base, "_test.go") ||
		strings.Contains(base, ".test.") || strings.Contains(base, ".spec.") {
		return true
	}

	for _, part := range strings.Split(strings.ToLower(rel), "/") {
		if part == "test" || part == "tests" || part == "__tests__" || part == "spec" {
			return true
		}
	}

	return false
}
