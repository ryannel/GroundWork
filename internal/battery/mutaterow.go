package battery

import (
	"context"
	"crypto/sha256"
	"encoding/hex"
	"errors"
	"fmt"
	"go/token"
	"io/fs"
	"os"
	"path"
	"path/filepath"
	"slices"
	"strings"
	"time"

	"github.com/ryannel/groundwork/internal/adapter"
	"github.com/ryannel/groundwork/internal/journal"
	"github.com/ryannel/groundwork/internal/manifest"
)

// The deletion test is proof.md's mutate row. Its clause is one sentence: a
// suite is red when tests survive the implementation being deleted.
//
// Every other row in this battery reads the project or runs it as it stands.
// This one damages it on purpose. It blanks one exported function to zero-value
// returns. It runs the tests of that function's own package. Then it asks
// whether anything noticed.
//
// What one mutant can come to:
//
//   - Killed: a test failed. The suite noticed, which is the whole claim. D34
//     adds the other way a suite can notice: the binary died under the mutant
//     where it was clean without it. The line names how many kills were crashes.
//   - Survived: every test still passed. Red, naming the function and the suite
//     that should have caught it.
//   - Uncovered: no test covers the package at all. Red too, and the loudest
//     kind — the run worked, and what it proved is that the code is unproven.
//   - Inconclusive: the suite was never given its chance, so nothing was
//     learned. D26 rules the first of these, the mutant that did not compile,
//     and the rest follow it: one that ran out of its clock, one whose run
//     reported no test at all, one identical to the original, one that could
//     not be written, and one whose own package could not be judged. Each is
//     counted and printed. None is a catch.
//   - Not judged: the row's budget went before the mutant was reached.
//
// The line this row writes reconciles the whole sample. Sampled equals killed
// plus survivors plus each inconclusive class plus not judged. D33 rules that
// the numbers are never what gets cut: names go first, and fall back to counts.
//
// Targets come from the build, never from a walk of the tree (D33). The go
// toolchain's own package list names the files a surface compiles. A file the
// build leaves out compiles nowhere, so no test can notice its deletion, and
// offering it as a target would be a red the row invented. D30's rule sits
// behind it: two walkers in one repo must never disagree about what a package
// is.
//
// Three rules hold the cost and the blast radius.
//
// The mutation happens in a throwaway copy of the surface, and the tree
// somebody is working in is never written to. The copy carries the project's
// git record, as a copy, so a package whose tests ask git answers there the way
// it answers here. The copy goes however the run ends, including a panic.
//
// The run is scoped to the target's own package. Mutating one package and
// running the whole project would cost the whole suite once per mutant, which
// is how a battery becomes the thing people bypass.
//
// And the run samples, by hashing each target against the battery version. Two
// runs of one version pick the same targets, so a red is reproducible. A bump
// rotates the sample, so coverage moves rather than circling one handful. The
// full sweep is the grading tool's, through RunAll.
//
// What this row does NOT do:
//
//   - Judge unexported functions. An exported function is what a package
//     promises its callers. A helper is reached through that promise, and a
//     package's entry point cannot be called by an in-process test at all.
//   - Run out of process. D25 puts every other stack behind a declared command,
//     and driving a whole mutation run through a foreign runner lands with that
//     stack's adapter. An out-of-process surface is named and reported
//     unrunnable rather than passing in silence.
//   - Excuse anything. There is no exclusion list and no waiver here. D24 puts
//     the waiver machinery in its own slice.

// mutateBudget is how long the whole row gets, shared across every surface and
// every mutant. Like the run-evidence row, this one carries a real suite's
// cost, so the clock is the suite's rather than a scan's.
const mutateBudget = 20 * time.Minute

// mutatePerMutant is how long one mutant's run gets. A blanked function turns
// a loop that ends into one that does not, so the row cannot assume a mutated
// suite finishes at all.
const mutatePerMutant = 3 * time.Minute

// mutateSample is how many mutants one verify run judges. The whole sweep is
// the grading tool's job, at milestone close, where proof.md already puts the
// full mutation run.
const mutateSample = 10

// MutateOptions tunes the deletion test. The zero value is what the default
// battery ships.
type MutateOptions struct {
	// Sample is how many mutants one run judges. Zero takes the shipped
	// budget.
	Sample int

	// RunAll judges every target instead of a sample. It is the full sweep the
	// grading tool runs, and it costs the whole suite once per target.
	RunAll bool

	// Budget is the whole row's clock, and PerMutant is one mutant's.
	Budget    time.Duration
	PerMutant time.Duration

	// watch stands between the row and the runner it drives. It is unexported
	// because only a test in this package may set it, and it is how the row's
	// first rule is proven: a test watches the project's own files while a
	// mutant is applied, rather than reading the tree once the run is over.
	watch func(packageRunner) packageRunner
}

// withDefaults fills in what a caller left out.
func (o MutateOptions) withDefaults() MutateOptions {
	if o.Sample <= 0 {
		o.Sample = mutateSample
	}
	if o.Budget <= 0 {
		o.Budget = mutateBudget
	}
	if o.PerMutant <= 0 {
		o.PerMutant = mutatePerMutant
	}

	return o
}

// budget is how many mutants this run may judge, with zero meaning all of
// them. The full sweep asks for itself by name rather than by passing a number
// somebody hopes is big enough.
func (o MutateOptions) budget() int {
	if o.RunAll {
		return 0
	}

	return o.Sample
}

// MutateRow returns the deletion test on stated options. The grading tool
// builds its own with RunAll set; the shipped battery takes the defaults.
func MutateRow(opts MutateOptions) Row {
	opts = opts.withDefaults()

	return Row{
		ID:       "mutate",
		Kind:     "mutate",
		Severity: Blocking,
		Check: func(c Context) Result {
			return checkMutate(c, opts)
		},
	}
}

// mutateRow is the row the default battery registers.
func mutateRow() Row {
	return MutateRow(MutateOptions{})
}

// packageRunner runs the tests of one package. It is the one thing the deletion
// test needs that the seam's own interface does not carry.
type packageRunner interface {
	RunPackage(ctx context.Context, dir, suite string) (adapter.RunLog, error)
}

// packageLister is the build's own answer to what a surface compiles.
type packageLister interface {
	Packages(ctx context.Context, dir string) ([]adapter.Package, error)
}

// mutationSeam is everything the deletion test needs of one surface: the seam
// that lists a file's mutants, the build's own package list, and a run scoped
// to one package.
//
// Two of the three are asserted rather than declared on the Adapter interface,
// because only the in-process Go adapter can answer them this bet. An adapter
// that cannot is named and reported unrunnable, which is D25's rule for a stack
// the battery cannot read — never a skip.
type mutationSeam struct {
	stack  adapter.Adapter
	lister packageLister
	runner packageRunner
}

// target is one function the deletion test may delete.
type target struct {
	// surface is the manifest surface the target lives on, and suite is the
	// package it sits in — the id the build gives that package, which is also
	// what the scoped run is asked for.
	surface string
	suite   string

	// file is the path inside the surface, and place is the same file named
	// from the repo root, which is how evidence names it.
	file  string
	place string

	symbol  string
	line    int
	content string
}

// key is what the sample sorts on: the target's identity and the battery
// version, hashed. The version is in there so that coverage rotates when the
// battery moves, and the identity is the whole of it — two functions of one
// name in two files are two targets.
func (t target) key(version string) string {
	sum := sha256.Sum256([]byte(t.surface + "\n" + t.file + "\n" + t.symbol + "\n" + version))

	return hex.EncodeToString(sum[:])
}

func checkMutate(c Context, opts MutateOptions) Result {
	// A project whose own suite calls the battery would otherwise mutate itself
	// inside its own mutation run, and this repo is one such project. The seam
	// sets the guard on every suite it starts; finding it set means this row is
	// already inside a run somebody else is doing.
	if os.Getenv(adapter.RunGuardEnv) != "" {
		return Result{
			Outcome: Unrunnable,
			Evidence: "the deletion test is already running inside a battery run, " +
				"so it did not start a mutation run inside one",
		}
	}

	s, bad, ok := openScan("deletion test", c)
	if !ok {
		return bad
	}

	ctx, cancel := context.WithTimeout(context.Background(), opts.Budget)
	defer cancel()

	t := &tally{version: mutateVersion(c)}

	var (
		pool  []target
		order []string
	)
	runners := map[string]packageRunner{}
	roots := map[string]string{}

	for _, surface := range s.m.Surfaces {
		seam, why := seamFor(s, surface)
		if why != "" {
			t.blocked = append(t.blocked, why)
			continue
		}

		// The build's own answer, asked once: the guard needs the package list
		// to know which records could govern a run, and the targets come out of
		// the same list.
		pkgs, err := seam.lister.Packages(ctx, s.dir(surface))
		if err != nil {
			t.blocked = append(t.blocked,
				fmt.Sprintf("the surface %q could not be listed: %s", surface.Name, s.reason(err)))
			continue
		}

		// Before anything is read, and long before anything is copied: a
		// surface whose git record lives outside it cannot be copied at all.
		if why := borrowedRecord(s, surface, pkgs); why != "" {
			t.blocked = append(t.blocked, why)
			continue
		}

		found, why := targetsOf(ctx, s, surface, seam, pkgs, t)
		if why != "" {
			t.blocked = append(t.blocked, why)
			continue
		}
		if len(found) == 0 {
			t.blocked = append(t.blocked,
				fmt.Sprintf("the surface %q holds no exported function to delete", surface.Name))
			continue
		}

		runner := seam.runner
		if opts.watch != nil {
			runner = opts.watch(runner)
		}

		order = append(order, surface.Name)
		runners[surface.Name] = runner
		roots[surface.Name] = s.dir(surface)
		pool = append(pool, found...)
	}

	if len(pool) == 0 {
		if ctx.Err() != nil {
			return Result{
				Outcome: Unrunnable,
				Evidence: fmt.Sprintf("the deletion test ran out of its budget of %s before it read a target",
					opts.Budget),
			}
		}

		// Not "found nothing to delete": a surface the row refused to copy may
		// be full of things to delete. The reasons say which it was.
		return Result{
			Outcome: Unrunnable,
			Evidence: evidence([]string{"the deletion test found no target it could judge"},
				t.names()),
		}
	}

	t.pool = len(pool)
	picked := sample(pool, t.version, opts.budget())
	t.sampled = len(picked)

	for _, surface := range order {
		mine := forSurface(picked, surface)
		if len(mine) == 0 {
			continue
		}
		// A surface the clock never reached judged none of its own sample, and
		// every one of those mutants is counted rather than forgotten.
		if ctx.Err() != nil {
			t.notJudged += len(mine)
			continue
		}

		res := inWorktree(s, roots[surface], func(dir string) Result {
			judge(ctx, s, throwaway{dir: dir, as: s.rel(roots[surface])},
				runners[surface], mine, opts, t)

			return Result{Outcome: Green, Evidence: "the mutation run finished"}
		})
		if res.Outcome != Green {
			// A mutation run that could not be set up at all says nothing about
			// what the suite catches. The S4 precedent: unrunnable, never a
			// partial red.
			return Result{
				Outcome: Unrunnable,
				Evidence: cut(fmt.Sprintf("the deletion test could not finish on the surface %q: %s",
					surface, res.Evidence)),
			}
		}
	}

	return t.result()
}

// seamFor returns what the deletion test needs of one surface, or the reason it
// cannot mutate that surface at all.
func seamFor(s scanned, surface manifest.Surface) (mutationSeam, string) {
	if surface.Stack != manifest.GoStack {
		return mutationSeam{}, fmt.Sprintf(
			"the surface %q is %s, and a mutation run there lands with that stack's adapter",
			surface.Name, surface.Stack)
	}

	a, err := adapterFor(s.m, surface)
	if err != nil {
		return mutationSeam{}, fmt.Sprintf("the surface %q has no adapter: %s", surface.Name, s.reason(err))
	}

	lister, ok := a.(packageLister)
	if !ok {
		return mutationSeam{}, fmt.Sprintf("the %s adapter cannot say what the build compiles, which a mutation run needs",
			a.Name())
	}

	runner, ok := a.(packageRunner)
	if !ok {
		return mutationSeam{}, fmt.Sprintf("the %s adapter cannot run one package at a time, which a mutation run needs",
			a.Name())
	}

	return mutationSeam{stack: a, lister: lister, runner: runner}, ""
}

// targetsOf lists the functions one surface offers the deletion test.
//
// The build says which files those can be in. Every file it names is then put
// through the rules every scan here shares: a symlink is never followed, a
// generated file is nobody's work, and a file the row declines to read is
// counted in the evidence rather than skipped in silence.
func targetsOf(ctx context.Context, s scanned, surface manifest.Surface, seam mutationSeam, pkgs []adapter.Package, t *tally) ([]target, string) {
	root := s.dir(surface)

	var found []target

	for _, pkg := range pkgs {
		// Files this build leaves out hold no target, and saying how many there
		// were is the difference between a narrow run and a clean one.
		t.ignored += pkg.Ignored

		for _, file := range pkg.Files {
			if err := ctx.Err(); err != nil {
				return nil, fmt.Sprintf("the surface %q ran out of the row's budget while it was read",
					surface.Name)
			}

			p := filepath.Join(root, filepath.FromSlash(file))
			info, err := os.Lstat(p)
			if err != nil {
				t.notes.unreadable++

				continue
			}
			if _, state, _ := openFile(p, fs.FileInfoToDirEntry(info), &t.notes); state != fileRead {
				continue
			}

			mutants, err := seam.stack.Mutants(ctx, root, file)
			if err != nil {
				// A file the seam cannot mutate is a file with no targets in
				// it, counted like any other the row did not read. It is not a
				// defect in the project's tests, which is all this row judges.
				t.notes.unreadable++

				continue
			}

			for _, m := range mutants {
				if !exported(m.Symbol) {
					continue
				}
				found = append(found, target{
					surface: surface.Name,
					suite:   pkg.ID,
					file:    file,
					place:   path.Join(path.Clean(filepath.ToSlash(surface.Root)), file),
					symbol:  m.Symbol,
					line:    m.Line,
					content: m.Content,
				})
			}
		}
	}

	return found, ""
}

// exported reports whether a symbol is a promise the package makes.
//
// The rule is Go's own, which is a Unicode case rule rather than a byte one: a
// name whose script has no upper case is not exported, and a name that opens
// with Ü is. A method carries its receiver, so the name is what follows the
// last dot.
func exported(symbol string) bool {
	name := symbol
	if cut := strings.LastIndex(name, "."); cut >= 0 {
		name = name[cut+1:]
	}

	return token.IsExported(name)
}

// sample picks the mutants this run judges, deterministically.
//
// Sorting by the hash of the target and the version gives one order per
// version. A bump moves every target in that order, so coverage walks the
// codebase instead of circling one corner of it.
//
// A budget of zero, or one at least as large as the pool, takes everything.
func sample(pool []target, version string, budget int) []target {
	picked := slices.Clone(pool)
	slices.SortFunc(picked, func(a, b target) int {
		return strings.Compare(a.key(version), b.key(version))
	})

	if budget > 0 && budget < len(picked) {
		picked = picked[:budget]
	}

	// The sample is judged, and reported, in source order. The hash order is
	// how the sample was chosen, and a reader of the evidence should not have
	// to know that.
	slices.SortFunc(picked, func(a, b target) int {
		if by := strings.Compare(a.place, b.place); by != 0 {
			return by
		}

		return a.line - b.line
	})

	return picked
}

// forSurface returns the sampled targets that live on one surface.
func forSurface(picked []target, surface string) []target {
	var mine []target
	for _, tgt := range picked {
		if tgt.surface == surface {
			mine = append(mine, tgt)
		}
	}

	return mine
}

// mutateVersion is what the sample is hashed against: the battery version, both
// halves. The declared half moves when a person bumps it, and the digest moves
// when the rows do, so either kind of change rotates the sample.
func mutateVersion(c Context) string {
	declared := unknownVersion
	if lock, err := ReadLock(c.RepoDir); err == nil {
		declared = lock.Version
	}
	if c.Digest == "" {
		return declared
	}

	return VersionString(declared, c.Digest)
}

// inWorktree copies root into a throwaway directory, hands it to do, and takes
// the copy away however do ends.
//
// The copy is where every mutation is written, so a run that dies mid-mutation
// cannot leave a blanked function behind in the project.
//
// A panic inside do is caught here for one reason: the copy has to go. The
// panic's own words ride in the evidence, so the crash is not swallowed either.
// Both error paths are rendered the way every scan renders a reason: this
// machine's own directories out, and the length capped, before the journal sees
// them (D33).
func inWorktree(s scanned, root string, do func(dir string) Result) (res Result) {
	copied, err := copyTree(root)
	if err != nil {
		return Result{
			Outcome: Unrunnable,
			Evidence: "a throwaway copy could not be made to mutate: " +
				s.said(offMachine(err.Error())),
		}
	}

	defer os.RemoveAll(copied)
	defer func() {
		if fell := recover(); fell != nil {
			res = Result{
				Outcome: Unrunnable,
				Evidence: "the mutation run fell over and its copy was thrown away: " +
					s.said(offMachine(fmt.Sprint(fell))),
			}
		}
	}()

	return do(copied)
}

// offMachine takes the throwaway directory out of another tool's words. It says
// as little to a reader elsewhere as the repo root does, which every scan takes
// out for the same reason. This is the one path the scans never see.
func offMachine(said string) string {
	tmp := os.TempDir()
	if tmp == "" || tmp == string(filepath.Separator) {
		return said
	}

	said = strings.ReplaceAll(said, tmp+string(filepath.Separator), "")

	return strings.ReplaceAll(said, tmp, "")
}

// borrowedRecord reports why a surface cannot be copied, when a git record it
// would carry lives somewhere else.
//
// A .git that is a file rather than a directory holds one line — "gitdir: …" —
// naming a git directory elsewhere on the machine. A linked worktree and a
// submodule both look like this. Copying that file byte for byte does not copy
// the record it names: git inside the copy resolves straight back to the
// project's real object store, so a test running on mutated code could commit
// to the project's real history.
//
// D36 fixes where to look. A test runs with its own package directory as its
// working directory, and git resolves a record by walking upward from there. So
// a record can capture a run only from the surface root or from somewhere on
// the way up from a package the build names — and nowhere else. A project that
// keeps a linked-worktree fixture under testdata is a self-contained project
// doing its own business, and refusing it would be a false statement about it.
//
// D35: a self-contained record, or none. The check runs before any copy is
// made, because the copy is the thing that would carry the escape.
func borrowedRecord(s scanned, surface manifest.Surface, pkgs []adapter.Package) string {
	root := s.dir(surface)

	for _, at := range governing(pkgs) {
		where := filepath.Join(root, filepath.FromSlash(at), gitDir)

		info, err := os.Lstat(where)
		if err != nil || info.IsDir() {
			// A real git directory is self-contained, and the copy of it is
			// the copy's own. Nothing missing here is a problem either.
			continue
		}

		return fmt.Sprintf("the surface %q keeps its git record outside itself: %s is a file naming another directory",
			surface.Name, s.rel(where))
	}

	return ""
}

// governing lists the directories a git record could be read from during a run
// of this surface: the surface root, every package the build names, and every
// directory between them. They are returned nearest the root first, so a record
// high up is named before one deeper in.
func governing(pkgs []adapter.Package) []string {
	seen := map[string]bool{".": true}

	for _, pkg := range pkgs {
		for at := pkg.ID; ; at = path.Dir(at) {
			if seen[at] {
				break
			}
			seen[at] = true
			if at == "." {
				break
			}
		}
	}

	dirs := make([]string, 0, len(seen))
	for at := range seen {
		dirs = append(dirs, at)
	}
	slices.SortFunc(dirs, func(a, b string) int {
		if by := strings.Count(a, "/") - strings.Count(b, "/"); by != 0 {
			return by
		}

		return strings.Compare(a, b)
	})

	return dirs
}

// gitDir is what a git record is called, whatever shape it is in.
const gitDir = ".git"

// copyTree copies a surface into a fresh temporary directory.
//
// The copy is faithful, and that includes the project's git record. A package
// whose tests ask git — is this file tracked, what does the history say — has
// to answer in the copy the way it answers here, or the row would report that
// package's tests as broken when they are fine. The record travels as a copy,
// so a mutated suite cannot reach the real history or the real journal.
//
// A symlink is not followed, for the reason every scan here shares: a link can
// point anywhere on the machine, and a copy that followed one would carry a
// file this project does not ship — and then mutate it.
func copyTree(from string) (string, error) {
	to, err := os.MkdirTemp("", "groundwork-mutate-")
	if err != nil {
		return "", err
	}

	err = filepath.WalkDir(from, func(p string, d fs.DirEntry, err error) error {
		if err != nil {
			return err
		}

		rel, err := filepath.Rel(from, p)
		if err != nil {
			return err
		}
		target := filepath.Join(to, rel)

		if d.IsDir() {
			return os.MkdirAll(target, 0o750)
		}
		if !d.Type().IsRegular() {
			return nil
		}

		raw, err := os.ReadFile(p)
		if err != nil {
			return err
		}
		info, err := d.Info()
		if err != nil {
			return err
		}

		return os.WriteFile(target, raw, info.Mode().Perm())
	})
	if err != nil {
		os.RemoveAll(to)

		return "", err
	}

	return to, nil
}

// baseline is what a package's tests do before anything is mutated.
//
// It is the run log that says which tests cover the target, and it is also the
// thing that makes a kill mean something: a package that was already failing
// would report every mutant as caught by the failure that was there first.
type baseline struct {
	// state is one of the four below.
	state string
	why   string
	tests int
}

const (
	baselineCovered   = "covered"
	baselineUncovered = "uncovered"
	baselineUnusable  = "unusable"

	// baselineOutOfTime is the row's own clock going, not a fact about the
	// package. Nothing is concluded about the project from it.
	baselineOutOfTime = "out of time"
)

// judge applies each sampled mutant in the copy at dir and records what the
// package's own tests did about it.
//
// Every target it was given lands in exactly one class. A run that stops early
// counts the ones it never reached as not judged, because a mutant nobody
// looked at must never read as one the suite caught.
// throwaway is the copy a mutation run happens in, and what to call it in
// evidence: the surface's own root, the way the project names it. A reader
// cannot act on a temporary directory's name, and the seam's errors are full of
// it once the run has moved into the copy.
type throwaway struct {
	dir string
	as  string
}

func judge(ctx context.Context, s scanned, in throwaway, runner packageRunner, picked []target, opts MutateOptions, t *tally) {
	bases := map[string]baseline{}

	for i, tgt := range picked {
		// A run with no clock left starts no more work.
		if ctx.Err() != nil {
			t.notJudged += len(picked) - i

			return
		}

		base, seen := bases[tgt.suite]
		if !seen {
			base = measure(ctx, s, in, runner, tgt.suite, opts)
			bases[tgt.suite] = base
		}

		switch base.state {
		case baselineOutOfTime:
			t.notJudged += len(picked) - i

			return

		case baselineUncovered:
			// Nothing could have caught it, so nothing needs running. This is
			// the loudest survivor: the code ships with no suite behind it.
			t.survivors = append(t.survivors, hit{
				file: tgt.place, line: tgt.line, subject: tgt.symbol,
				shape: fmt.Sprintf("survived, and no test covers %s", tgt.suite),
			})

			continue

		case baselineUnusable:
			t.blame(tgt.suite, base.why)

			continue
		}

		if !t.judgeOne(ctx, runner, in.dir, tgt, base, opts) {
			t.notJudged += len(picked) - i

			return
		}
	}
}

// measure runs one package's tests unmutated.
//
// The order of the checks is the point. A run that came back with an answer is
// an answer, whatever the clock did afterwards. Only a run with no answer is
// sorted by what stopped it, and the row's own budget is sorted out first: "its
// own tests do not run" is a sentence about the project, and the row's clock
// running out says nothing about the project at all.
//
// A baseline that crashed lands in unusable, like any other run that came back
// refused. That is what keeps D34 honest: a crash is only ever a kill when the
// package was clean before the mutant, and judgeOne is reached on no other kind
// of baseline.
func measure(ctx context.Context, s scanned, in throwaway, runner packageRunner, suite string, opts MutateOptions) baseline {
	got := runPackage(ctx, runner, in.dir, suite, opts)

	switch {
	case got.err == nil && failed(got.log):
		return baseline{state: baselineUnusable, why: "its own tests do not pass unmutated"}

	case got.err == nil:
		return baseline{state: baselineCovered, tests: len(got.log.Tests)}

	case errors.Is(got.err, adapter.ErrNoTests):
		return baseline{state: baselineUncovered}

	case got.rowClockDied:
		return baseline{state: baselineOutOfTime}

	case got.mutantClockDied || errors.Is(got.err, adapter.ErrTimedOut):
		return baseline{state: baselineUnusable, why: "its own tests do not finish in time"}

	case errors.Is(got.err, adapter.ErrBuildFailed):
		return baseline{state: baselineUnusable, why: "its own code does not build"}

	default:
		// Whatever else went wrong, the seam already has words for it, and they
		// are truer than any guess this row could make. A surface root that is
		// not a module root is the ordinary case: its tests are fine, and the
		// row would otherwise put "its own tests do not run" on the record
		// about them.
		return baseline{state: baselineUnusable, why: seamSaid(s, in, got.err)}
	}
}

// seamSaid renders the seam's own words for a line of evidence, without the
// sentinel they are wrapped in. "The adapter could not be run" is true of every
// failure here and says nothing; what follows it is the part a reader can act
// on. The rest is the rendering every scan uses: this machine's directories
// out, and the length capped.
func seamSaid(s scanned, in throwaway, err error) string {
	said := strings.ReplaceAll(err.Error(), in.dir, in.as)
	said = strings.TrimPrefix(said, adapter.ErrUnrunnable.Error()+": ")

	return s.said(offMachine(said))
}

// judgeOne applies one mutant and reads what the suite did about it. It reports
// false when the row's own budget went before an answer came back, which is the
// one outcome that stops the run rather than classing the mutant.
func (t *tally) judgeOne(ctx context.Context, runner packageRunner, dir string, tgt target, base baseline, opts MutateOptions) bool {
	file := filepath.Join(dir, filepath.FromSlash(tgt.file))

	was, err := os.ReadFile(file)
	if err != nil {
		t.unwritten++

		return true
	}
	// D18, and the seam's own rule said twice on purpose: a mutant identical to
	// the original damages nothing, so the suite has nothing to notice. Judging
	// it could only ever produce a survivor the row invented.
	if string(was) == tgt.content {
		t.unchanged++

		return true
	}

	if err := os.WriteFile(file, []byte(tgt.content), 0o600); err != nil {
		t.unwritten++

		return true
	}
	defer os.WriteFile(file, was, 0o600)

	got := runPackage(ctx, runner, dir, tgt.suite, opts)

	switch {
	case got.err == nil && failed(got.log):
		t.killed++

	case got.err == nil:
		t.survivors = append(t.survivors, hit{
			file: tgt.place, line: tgt.line, subject: tgt.symbol,
			shape: fmt.Sprintf("survived, and the %s of %s stayed green",
				counted(base.tests, "test", "tests"), tgt.suite),
		})

	case errors.Is(got.err, adapter.ErrBuildFailed):
		// D26: a mutant that fails to compile is inconclusive, never a catch.
		// The commonest cause is honest — blanking the one function that used
		// an import leaves that import unused — and none of it says anything
		// about what the suite would have caught.
		t.uncompiled++

	case got.rowClockDied:
		return false

	case got.mutantClockDied || errors.Is(got.err, adapter.ErrTimedOut):
		// A clock ran out — the mutant's own, or the test runner's, which D35
		// rules is the same fact wearing a panic's clothes. Nobody waited the
		// run out, so the suite was never given its chance and nothing is
		// concluded either way.
		t.outOfTime++

	case errors.Is(got.err, adapter.ErrNoTests):
		// The run finished and reported no test at all, over a package whose
		// baseline reported several. Nothing ran, so nothing noticed.
		t.unrun++

	default:
		// D34: the row asks one question, and this is an answer to it. The
		// baseline was clean — judgeOne is reached on no other kind — and with
		// the mutant applied the run came back refused. Neither clock died, the
		// code built, and the run was not a clean report of nothing. What is
		// left is the binary dying: a panic, or a test process that went away
		// mid-suite. D32 already rules a panic a failure path, so the suite
		// noticed, and the crash itself is how it said so.
		//
		// D25 is untouched. The seam still refuses to hand back a partial log
		// from a crashed run, and the run-evidence row still declines to tally
		// one. That row must name every test; this row must answer one question.
		t.killed++
		t.crashed++
	}

	return true
}

// packageRun is one run of one package's tests, and which clock ran out if
// either did.
type packageRun struct {
	log adapter.RunLog
	err error

	// rowClockDied says the whole row's budget went while this run was in
	// flight. That is the row's own clock, never the project's suite.
	rowClockDied bool

	// mutantClockDied says this one run outlived the per-mutant clock while the
	// row still had budget left.
	mutantClockDied bool
}

// runPackage runs one package's tests on the per-mutant clock.
//
// The clock is the mutant's own and not the row's. A blanked function can turn
// a loop that ends into one that does not, and a row that waited its whole
// budget out on one wedged mutant would judge nothing else in its sample.
func runPackage(ctx context.Context, runner packageRunner, dir, suite string, opts MutateOptions) packageRun {
	within, cancel := context.WithTimeout(ctx, opts.PerMutant)
	defer cancel()

	log, err := runner.RunPackage(within, dir, suite)

	got := packageRun{log: log, err: err}
	if err != nil {
		got.rowClockDied = ctx.Err() != nil
		got.mutantClockDied = !got.rowClockDied && within.Err() != nil
	}

	return got
}

// failed reports whether any test in a run log failed. One failure is the
// suite noticing, which is all a kill is.
func failed(log adapter.RunLog) bool {
	for _, tr := range log.Tests {
		if tr.Outcome == adapter.Fail {
			return true
		}
	}

	return false
}

// stuck is one package nothing could be proven in, and how many of the sample
// sat inside it. The count is what makes the arithmetic work: four targets in
// one bad package is four mutants nobody judged, said once.
type stuck struct {
	suite   string
	why     string
	targets int
}

// tally is what one run of the deletion test came to.
//
// Every sampled mutant lands in exactly one of the counts below. That is the
// whole of D33's third ruling, and result refuses to report a run whose numbers
// do not add up to the sample.
type tally struct {
	version string
	pool    int
	sampled int

	killed    int
	survivors []hit

	// crashed is how many of the kills were the suite dying rather than a test
	// reporting failure (D34). It is a split of killed, never a class beside
	// it, so it takes no part in the sum.
	crashed int

	// The inconclusive counts, each printed. A mutant nobody judged must never
	// read as one the suite caught.
	uncompiled int
	outOfTime  int
	unrun      int
	unchanged  int
	unwritten  int
	stuck      []stuck

	// notJudged is the sample the row's budget never reached.
	notJudged int

	// ignored counts the source files the build leaves out. They hold no
	// target, and a reader still gets to see how many there were.
	ignored int

	blocked []string
	notes   scanNotes
}

// blame records that one package could not be judged, and that one more of the
// sample sat inside it.
func (t *tally) blame(suite, why string) {
	for i := range t.stuck {
		if t.stuck[i].suite == suite {
			t.stuck[i].targets++

			return
		}
	}

	t.stuck = append(t.stuck, stuck{suite: suite, why: why, targets: 1})
}

// stuckTargets is how much of the sample sat in a package nothing could prove.
func (t *tally) stuckTargets() int {
	total := 0
	for _, s := range t.stuck {
		total += s.targets
	}

	return total
}

// accounted is every sampled mutant this run can name a class for.
func (t *tally) accounted() int {
	return t.killed + len(t.survivors) +
		t.uncompiled + t.outOfTime + t.unrun + t.unchanged + t.unwritten +
		t.stuckTargets() + t.notJudged
}

// class is one bucket of the sample: how many landed in it, and the words for
// it in both wordings.
type class struct {
	n     int
	words string

	// brief is the same bucket in fewer letters, for a line that will not
	// otherwise fit. The count does not change.
	brief string
}

// classes is every bucket but the kills and the survivors, which the line
// always leads with.
func (t *tally) classes() []class {
	return []class{
		{t.uncompiled, "did not compile", "uncompiled"},
		{t.outOfTime, "ran out of time", "timed out"},
		{t.unrun, "ran nothing", "no tests"},
		{t.unchanged, "changed nothing", "unchanged"},
		{t.unwritten, "could not be written", "unwritten"},
		{t.stuckTargets(), "blocked by their own package", "blocked"},
		{t.notJudged, "not judged", "unjudged"},
	}
}

// counts is what became of every mutant in the sample, in one wording or the
// other. A class at zero is left out, and the sum still reconciles: a reader
// adds up what is printed and gets the sample back.
//
// The crash split rides in brackets on the kills rather than beside them (D34).
// A class beside them would be counted twice by a reader adding the line up.
func (t *tally) counts(brief bool) string {
	kills := fmt.Sprintf("killed %d", t.killed)
	if t.crashed > 0 {
		if brief {
			kills += fmt.Sprintf(" (%d crashed)", t.crashed)
		} else {
			kills += fmt.Sprintf(" (%d by crash)", t.crashed)
		}
	}

	said := []string{kills}
	if n := len(t.survivors); n > 0 {
		said = append(said, fmt.Sprintf("survived %d", n))
	}

	for _, c := range t.classes() {
		if c.n == 0 {
			continue
		}
		words := c.words
		if brief {
			words = c.brief
		}
		said = append(said, fmt.Sprintf("%d %s", c.n, words))
	}

	return strings.Join(said, ", ")
}

// accounting is what the line would rather say: how much of the codebase this
// run looked at, which version chose it, and what became of every mutant.
func (t *tally) accounting() string {
	return fmt.Sprintf("sampled %d of %s at %s: %s",
		t.sampled, counted(t.pool, "target", "targets"), t.version, t.counts(false))
}

// shortAccounting is the same numbers in fewer words, for a run with so many
// classes that the plain wording will not fit the journal's cap.
//
// D35, restating D33: the numbers-never-cut rule binds the whole accounting. If
// the full line will not fit, words give way — this is where they start giving
// way — and never the counts.
func (t *tally) shortAccounting() string {
	return fmt.Sprintf("%d/%d at %s: %s", t.sampled, t.pool, t.version, t.counts(true))
}

// inconclusive is every mutant the run learned nothing from.
func (t *tally) inconclusive() int {
	return t.uncompiled + t.outOfTime + t.unrun + t.unchanged + t.unwritten + t.stuckTargets()
}

// collapsed is the last rung of the ladder, and the only one whose length is
// bounded by arithmetic rather than by what a project happens to hold.
//
// Two things go, and D36 rules that both may. The inconclusive classes fold
// into one counted total — sampled still equals killed plus survived plus
// inconclusive plus not judged, so the line still reconciles. And the version
// goes, because a declared version is 32 bytes of somebody else's choosing plus
// a digest, and nothing here can bound it.
//
// What is left is six numbers and a fixed set of words. Six ints cannot print
// wider than six ints, which is what makes the bound provable — see the test
// that computes it.
func (t *tally) collapsed() string {
	return collapsedCounts(t.sampled, t.pool, t.killed, t.crashed,
		len(t.survivors), t.inconclusive(), t.notJudged)
}

// collapsedCounts renders the last rung from its numbers alone.
//
// It takes numbers rather than a tally so that its widest output can be
// computed instead of measured: hand it the widest an int prints and the answer
// is the widest line this rung can ever produce.
func collapsedCounts(sampled, pool, killed, crashed, survived, inconclusive, notJudged int) string {
	said := []string{fmt.Sprintf("killed %d", killed)}
	if crashed > 0 {
		said[0] += fmt.Sprintf(" (%d crashed)", crashed)
	}

	if survived > 0 {
		said = append(said, fmt.Sprintf("survived %d", survived))
	}
	for _, c := range []struct {
		n    int
		what string
	}{
		{inconclusive, "inconclusive"},
		{notJudged, "unjudged"},
	} {
		if c.n > 0 {
			said = append(said, fmt.Sprintf("%d %s", c.n, c.what))
		}
	}

	return fmt.Sprintf("%d/%d: %s", sampled, pool, strings.Join(said, ", "))
}

// names is everything the line says after its numbers, most useful first. A
// survivor is what a reader acts on next, so it goes at the front.
func (t *tally) names() []string {
	var said []string

	for _, h := range t.survivors {
		said = append(said, h.String())
	}
	for _, s := range t.stuck {
		said = append(said, fmt.Sprintf("%s holds %s and %s",
			s.suite, counted(s.targets, "target", "targets"), s.why))
	}
	said = append(said, t.notes.items()...)
	if t.ignored > 0 {
		said = append(said, fmt.Sprintf("%s left out of this build",
			counted(t.ignored, "file was", "files were")))
	}
	said = append(said, t.blocked...)

	return said
}

// evidence renders the row's one line.
//
// heads are the same facts in falling numbers of words: the wording the row
// would rather use first, then shorter ones. Names ride on the first head only,
// and are dropped one at a time before any of it gives way. When not even one
// name fits, the line says how many it left out; when the head itself will not
// fit, the next head is tried.
//
// The counts are in every head, so nothing here can cut one. That is D35's
// restatement of D33: a line that had to cut a count is a defect in the line's
// design, not an allowed fallback.
func evidence(heads []string, names []string) string {
	// Names come before wording. A name is what a reader acts on next; the
	// wording is only how the row says it. So the line keeps as many names as
	// it can, and will take a shorter wording to keep one more of them.
	best, shown := "", 0
	for _, head := range heads {
		if fits := fitted(head, names); fits > shown {
			best, shown = head, fits
		}
	}
	if shown > 0 {
		line := best + "; " + strings.Join(names[:shown], "; ")
		if left := len(names) - shown; left > 0 {
			line += fmt.Sprintf(" and %d more", left)
		}

		return line
	}

	// Not one name fits. How many were left out still does.
	if len(names) > 0 {
		for _, head := range heads {
			line := head + fmt.Sprintf("; %s not named here",
				counted(len(names), "detail is", "details are"))
			if len(line) <= journal.MaxTextBytes {
				return line
			}
		}
	}

	for _, head := range heads {
		if len(head) <= journal.MaxTextBytes {
			return head
		}
	}

	return cut(heads[len(heads)-1])
}

// fitted is how many names fit after head, counting the "and N more" the rest
// of them would need.
//
// It measures rather than builds. A run that sampled everything can carry
// thousands of survivors, and joining a list that long once per candidate
// length would cost the square of it.
func fitted(head string, names []string) int {
	room, shown := journal.MaxTextBytes-len(head)-len("; "), 0

	body := 0
	for i, name := range names {
		add := len(name)
		if i > 0 {
			add += len("; ")
		}

		more := 0
		if left := len(names) - (i + 1); left > 0 {
			more = len(fmt.Sprintf(" and %d more", left))
		}
		if body+add+more > room {
			break
		}

		body += add
		shown = i + 1
	}

	return shown
}

// heads is the line's own ladder: the verdict and the accounting in the words
// the row would rather use, then both in fewer words, then the counts alone.
//
// The last two rungs carry no verdict at all, and that is the right thing to
// lose first: every place this line is read prints the row's outcome beside it,
// so the verdict is the one part a reader can lose and still have the whole of
// it. The last rung is the one whose length is proven rather than hoped for.
func (t *tally) heads(verdict, brief string) []string {
	return []string{
		verdict + t.accounting(),
		brief + t.shortAccounting(),
		t.shortAccounting(),
		t.collapsed(),
	}
}

// result turns the tally into the row's one line.
//
// Green needs three things, and D33 fixes all three: no survivor, at least one
// kill, and every sampled mutant accounted for. The inconclusive classes are
// non-blocking, per D26, and they are counted and printed whatever the outcome.
func (t *tally) result() Result {
	names := t.names()

	switch {
	case t.accounted() != t.sampled:
		// The row lost track of its own sample. That is a defect in this file,
		// and reporting any verdict over numbers that do not add up would put
		// the defect on the project's record instead.
		return Result{
			Outcome: Unrunnable,
			Evidence: evidence(t.heads(
				"the deletion test could not account for every mutant it sampled: ",
				"lost count of the sample: "), names),
		}

	case t.notJudged > 0:
		// A run that exhausted its budget partway through its sample is
		// unrunnable, naming how far it got. Half a mutation run says nothing
		// about what a suite catches, and the clock is the row's own — never
		// something the project is told it did wrong.
		return Result{
			Outcome: Unrunnable,
			Evidence: evidence(t.heads(
				"the deletion test ran out of its budget partway through its sample: ",
				"out of budget mid-sample: "), names),
		}

	case len(t.survivors) > 0:
		return Result{
			Outcome: Red,
			Evidence: evidence(t.heads(
				fmt.Sprintf("the deletion test found %s: ",
					counted(len(t.survivors), "surviving mutant", "surviving mutants")),
				fmt.Sprintf("%s: ", counted(len(t.survivors), "survivor", "survivors"))), names),
		}

	case t.killed == 0:
		// D17: a verifier may never pass on nothing. A run that judged no
		// mutant has not proven a suite catches anything, and green would say
		// it had.
		return Result{
			Outcome: Unrunnable,
			Evidence: evidence(t.heads(
				"the deletion test judged none of the mutants it sampled: ",
				"judged none of the sample: "), names),
		}

	default:
		return Result{
			Outcome: Green,
			Evidence: evidence(t.heads(
				fmt.Sprintf("the deletion test killed every one of %s: ",
					counted(t.killed, "mutant it judged", "mutants it judged")),
				"killed every mutant judged: "), names),
		}
	}
}
