package plan

import (
	"errors"
	"fmt"
	"io/fs"
	"os"
	"path"
	"path/filepath"
	"strings"
)

// resolve holds the units together. Parsing says each file is well formed;
// this says the files agree with each other.
//
// Two rules do the work. An id names one thing in the whole repo, so no two
// units may wear one. And every reference a plan file makes has to reach
// something that exists — with one deliberate exception, the program ladder,
// whose later entries are one-line sketches of bets nobody has designed yet.
func resolve(root string, set *Set) []string {
	var problems []string

	problems = append(problems, uniqueIDs(set)...)
	problems = append(problems, oneLadderPerBet(set)...)
	problems = append(problems, oneTestPerProof(set)...)

	programs := map[string]*Program{}
	for i := range set.Programs {
		programs[set.Programs[i].ID] = &set.Programs[i]
	}

	// A bet is reached by the directory it sits in, never by its id alone.
	// The directory is what decides which bet a slice file belongs to, and one
	// answer is better than two that can disagree.
	betAt := map[string]*Bet{}
	for i := range set.Bets {
		betAt[path.Dir(set.Bets[i].Path)] = &set.Bets[i]
	}

	// The slice files each bet directory actually holds.
	sliceAt := map[string]map[string]bool{}
	for _, slice := range set.Slices {
		dir := path.Dir(slice.Path)
		if sliceAt[dir] == nil {
			sliceAt[dir] = map[string]bool{}
		}
		sliceAt[dir][slice.ID] = true
	}

	for _, bet := range set.Bets {
		problems = append(problems, resolveBet(root, bet, programs, sliceAt)...)
	}
	for _, slice := range set.Slices {
		problems = append(problems, resolveSlice(root, slice, betAt)...)
	}

	return problems
}

// uniqueIDs holds R1's second sentence: an id is unique across the repo.
//
// One flat space, not one per shape. A reference names an id and nothing else,
// so a proof and a facing item wearing one id would make every mention of it a
// guess about which was meant.
func uniqueIDs(set *Set) []string {
	var problems []string

	seen := map[string]string{}
	claim := func(id, where string) {
		if id == "" {
			return
		}
		if first, taken := seen[id]; taken {
			problems = append(problems, fmt.Sprintf(
				"the id %s is declared in %s and again in %s, and an id names one thing", id, first, where))

			return
		}
		seen[id] = where
	}

	// A bet that has files declares its own id in its own file, so a ladder
	// entry naming it is a reference and not a second declaration. A bet
	// nobody has cut yet has no file, and its ladder entry is then the only
	// place that id is written down — so the entry claims it, and a milestone
	// or a facing item may not wear it.
	hasFiles := map[string]bool{}
	for _, bet := range set.Bets {
		hasFiles[bet.ID] = true
	}

	for _, program := range set.Programs {
		claim(program.ID, program.Path)

		for _, entry := range program.Ladder {
			if !hasFiles[entry.ID] {
				claim(entry.ID, program.Path)
			}
		}
	}
	for _, bet := range set.Bets {
		claim(bet.ID, bet.Path)
		for _, milestone := range bet.Milestones {
			claim(milestone.ID, bet.Path)
		}
		for _, facing := range bet.Facing {
			claim(facing.ID, bet.Path)
		}
	}
	for _, slice := range set.Slices {
		claim(slice.ID, slice.Path)
		for _, proof := range slice.Proofs {
			claim(proof.ID, slice.Path)
		}
	}

	return problems
}

// oneLadderPerBet holds a bet to one place on one ladder.
//
// A bet listed twice on one ladder has two positions in one order, and the
// order is what "next" means. A bet on two ladders belongs to two programs,
// and a bet belongs to one. The bet file's own slices list is already held to
// the first of these, and this is the same rule read from the program's end.
func oneLadderPerBet(set *Set) []string {
	var problems []string

	onLadderOf := map[string]string{}

	for _, program := range set.Programs {
		listed := map[string]bool{}

		for _, entry := range program.Ladder {
			if entry.ID == "" {
				continue
			}
			if listed[entry.ID] {
				problems = append(problems, fmt.Sprintf("%s lists the bet %s twice on its ladder",
					program.Path, entry.ID))

				continue
			}

			listed[entry.ID] = true

			if first, taken := onLadderOf[entry.ID]; taken {
				problems = append(problems, fmt.Sprintf(
					"the bet %s is on the ladder of %s and again on the ladder of %s, and a bet belongs to one program",
					entry.ID, first, program.Path))

				continue
			}

			onLadderOf[entry.ID] = program.Path
		}
	}

	return problems
}

// oneTestPerProof holds R9's half of the id rule: one test result answers for
// one proof, never two. The board joins the test run to the plan through these
// names, and a name that answers twice would put one result in two places.
//
// Two rules. No two proofs may declare one marker. And no proof id may open
// with another proof id and an underscore: a marker is TestProof_<id>_<words>,
// so the test name TestProof_a_b_runs opens with the marker prefix of the
// proof a and with that of the proof a_b.
func oneTestPerProof(set *Set) []string {
	var problems []string

	markers := map[string]string{}

	type held struct{ id, where string }

	var ids []held

	for _, slice := range set.Slices {
		for _, proof := range slice.Proofs {
			if proof.Marker != "" {
				if first, taken := markers[proof.Marker]; taken {
					problems = append(problems, fmt.Sprintf(
						"%s and %s both name the marker %s, and one test names one proof",
						first, slice.Path, clip(proof.Marker)))
				} else {
					markers[proof.Marker] = slice.Path
				}
			}
			if proof.ID != "" {
				ids = append(ids, held{id: proof.ID, where: slice.Path})
			}
		}
	}

	for _, one := range ids {
		for _, other := range ids {
			if !strings.HasPrefix(one.id, other.id+"_") {
				continue
			}

			problems = append(problems, fmt.Sprintf(
				"the proof %s in %s opens with the proof %s in %s and an underscore, and one test name would answer for both",
				one.id, one.where, other.id, other.where))
		}
	}

	return problems
}

// resolveBet checks one bet's references: its program, its design docs, its
// milestones, its slices, and its deferrals.
func resolveBet(root string, bet Bet, programs map[string]*Program, sliceAt map[string]map[string]bool) []string {
	var problems []string

	// The program a bet belongs to is the one whose directory it sits in. This
	// is the bet's half of the rule resolveSlice holds a slice to: the file's
	// place decides, and the field has to agree with it.
	under := path.Base(path.Dir(path.Dir(bet.Path)))

	program, ok := programs[bet.Program]
	switch {
	case bet.Program != under:
		problems = append(problems, fmt.Sprintf("%s names the program %s, and it sits in the directory of %s",
			bet.Path, bet.Program, under))
	case !ok:
		problems = append(problems, fmt.Sprintf("%s names the program %s, and no program file declares it",
			bet.Path, bet.Program))
	case !ladderHolds(program, bet.ID):
		problems = append(problems, fmt.Sprintf("%s does not name the bet %s on its ladder, and %s says it belongs there",
			program.Path, bet.ID, bet.Path))
	}

	// The path is somebody else's text, up to the path cap, and every other
	// value on these lines is clipped. An unclipped one would spend the
	// evidence line's whole budget on itself.
	for _, where := range bet.Design {
		if err := mustExist(root, where); err != nil {
			problems = append(problems, fmt.Sprintf("%s names the design doc %s, which %s", bet.Path, clip(where), err))
		}
	}

	milestones := map[string]bool{}
	for _, milestone := range bet.Milestones {
		milestones[milestone.ID] = true
	}

	held := sliceAt[path.Dir(bet.Path)]
	listed := map[string]bool{}
	for _, entry := range bet.Slices {
		switch {
		case listed[entry.ID]:
			problems = append(problems, fmt.Sprintf("%s lists the slice %s twice", bet.Path, entry.ID))
		case !held[entry.ID]:
			problems = append(problems, fmt.Sprintf("%s lists the slice %s, and its directory holds no %s.md",
				bet.Path, entry.ID, entry.ID))
		}
		listed[entry.ID] = true

		if !milestones[entry.Milestone] {
			problems = append(problems, fmt.Sprintf("%s puts the slice %s on the milestone %s, which it does not hold",
				bet.Path, entry.ID, entry.Milestone))
		}
	}

	facing := map[string]bool{}
	for _, item := range bet.Facing {
		facing[item.ID] = true
	}
	for _, deferral := range bet.Deferred {
		if !facing[deferral.ID] {
			problems = append(problems, fmt.Sprintf("%s defers %s, which it never declares as a facing item",
				bet.Path, deferral.ID))
		}
	}

	return problems
}

// resolveSlice checks one slice's references: its bet, its milestone, the
// facing items it claims, and the design each proof comes from.
func resolveSlice(root string, slice Slice, betAt map[string]*Bet) []string {
	var problems []string

	for _, proof := range slice.Proofs {
		where, _, _ := strings.Cut(proof.From, "#")
		if err := mustExist(root, where); err != nil {
			problems = append(problems, fmt.Sprintf("%s says the proof %s comes from %s, which %s",
				slice.Path, proof.ID, clip(where), err))
		}
	}

	// The bet a slice belongs to is the one whose directory it sits in. A
	// slice naming another bet is a plan that reads two ways, so the file's
	// place decides and the field has to agree with it.
	bet, ok := betAt[path.Dir(slice.Path)]
	if !ok {
		return problems
	}
	if slice.Bet != bet.ID {
		problems = append(problems, fmt.Sprintf("%s names the bet %s, and it sits in the directory of %s",
			slice.Path, slice.Bet, bet.ID))
	}

	milestones := map[string]bool{}
	for _, milestone := range bet.Milestones {
		milestones[milestone.ID] = true
	}

	var entry *SliceEntry
	for i := range bet.Slices {
		if bet.Slices[i].ID == slice.ID {
			entry = &bet.Slices[i]
		}
	}

	switch {
	case !milestones[slice.Milestone]:
		problems = append(problems, fmt.Sprintf("%s sits on the milestone %s, which %s does not hold",
			slice.Path, slice.Milestone, bet.Path))
	case entry == nil:
		problems = append(problems, fmt.Sprintf("%s plans the slice %s, and %s does not list it",
			slice.Path, slice.ID, bet.Path))
	case entry.Milestone != slice.Milestone:
		problems = append(problems, fmt.Sprintf("%s sits on the milestone %s, and %s puts it on %s",
			slice.Path, slice.Milestone, bet.Path, entry.Milestone))
	}

	facing := map[string]bool{}
	for _, item := range bet.Facing {
		facing[item.ID] = true
	}

	// A slice claims an item once. Claiming it twice is a doubled declaration,
	// and every other doubled declaration is refused here — a bet listing one
	// slice twice, a program listing one bet twice. D61 ruling 3 puts this one
	// beside them: read further on, one slice claiming one item twice is a
	// traceability red that names one slice twice and tells a reader nothing.
	claimed := map[string]bool{}
	for _, id := range slice.Facing {
		switch {
		case claimed[id]:
			problems = append(problems, fmt.Sprintf("%s claims the facing item %s twice", slice.Path, id))
		case !facing[id]:
			problems = append(problems, fmt.Sprintf("%s claims the facing item %s, and %s does not declare it",
				slice.Path, id, bet.Path))
		}

		claimed[id] = true
	}

	return problems
}

// ladderHolds reports whether a program's ladder names a bet.
func ladderHolds(program *Program, id string) bool {
	for _, entry := range program.Ladder {
		if entry.ID == id {
			return true
		}
	}

	return false
}

// mustExist says whether a path a plan file names reaches a file in this repo.
func mustExist(root, where string) error {
	info, err := os.Stat(filepath.Join(root, filepath.FromSlash(where)))
	switch {
	case errors.Is(err, fs.ErrNotExist):
		return errors.New("is not a file in this repo")
	case err != nil:
		return fmt.Errorf("could not be read: %v", reasonOnly(err))
	case info.IsDir():
		return errors.New("is a directory, not a file")
	}

	return nil
}
