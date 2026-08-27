package board

import (
	"slices"

	"github.com/ryannel/groundwork/internal/journal"
)

// TrailerKey is the trailer a slice's commit carries beside Bet and Tests. It
// is what makes landed-ness readable from git, and it is what keeps expected
// state out of the plan file (R8).
const TrailerKey = "Slice"

// trailerKeys is every key this repo's own commits write as a trailer: the two
// the working agreement fixes, and this one.
//
// It lives here because this is where a trailer key is spelled. A reader that
// has to tell a quoted trailer block from a paragraph of prose asks this rather
// than keeping a list of its own, and a test holds the list to the pages that
// declare it (D65 ruling 4).
var trailerKeys = []string{"Bet", TrailerKey, "Tests"}

// TrailerKeys returns the keys this repo's own commits write as trailers.
func TrailerKeys() []string {
	return slices.Clone(trailerKeys)
}

// Claim is one Slice trailer, as git found it. Nothing here is judged yet: the
// derivation does the judging, in one place, so a claim can never be counted by
// one reader and refused by another.
type Claim struct {
	// Commit is the commit the trailer sat on.
	Commit string

	// Value is what the trailer said, exactly as git read it.
	Value string

	// Merge says the commit has more than one parent.
	Merge bool

	// Alone says this was the only Slice trailer on its commit.
	Alone bool
}

// History is what this repo's own history says about landed-ness.
type History struct {
	Claims  []Claim
	Commits int

	// Shallow says this clone holds only part of its history, so the claims may
	// be short. It is said rather than guessed at.
	//
	// It is not a refusal. A history the clone cannot see can only ever leave a
	// slice unlanded, which moves a proof from expected green to expected red —
	// the flagged direction, never a silent pass over a regression. The waiver
	// counter's shallow rule goes the other way for the opposite reason: there,
	// history nobody can see counts as zero grants and passes a threshold.
	Shallow bool

	// Head is the commit the claims were read at.
	Head string
}

// ReadHistory reads every Slice trailer reachable from HEAD.
//
// git's own trailer parser does the reading, through the journal package's one
// git seam. A scan of commit bodies written here would be a second definition
// of what a trailer is.
func ReadHistory(dir string) (History, error) {
	commits, err := journal.Trailers(dir, TrailerKey)
	if err != nil {
		return History{}, err
	}

	shallow, err := journal.Shallow(dir)
	if err != nil {
		return History{}, err
	}

	h := History{Commits: len(commits), Shallow: shallow}
	if len(commits) > 0 {
		h.Head = commits[0].ID
	}

	for _, commit := range commits {
		for _, value := range commit.Values {
			h.Claims = append(h.Claims, Claim{
				Commit: commit.ID,
				Value:  value,
				Merge:  commit.Parents > 1,
				Alone:  len(commit.Values) == 1,
			})
		}
	}

	return h, nil
}
