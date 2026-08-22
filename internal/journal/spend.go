package journal

import (
	"encoding/json"
	"fmt"
	"slices"
	"strings"
)

// spendKeys is the closed vocabulary for how a spend query groups dispatches.
var spendKeys = []string{"role", "tier", "session"}

// SpendKeys returns the keys a spend query can group by.
func SpendKeys() []string {
	return slices.Clone(spendKeys)
}

// noKey stands in for a group value a dispatch line does not carry. It is
// never a real role, tier or session: parentheses fall outside the session
// charset checkSession enforces, so a live session id can never collide
// with it. A line this old or malformed still counts toward the totals; it
// just cannot name its own group.
const noKey = "(none)"

// SpendRow is one group's totals from a spend query. Key is the group's
// value: a role, a tier, or a session id, depending on what Spend was asked
// to group by. A line missing that field groups under noKey ("(none)")
// rather than under an empty string.
type SpendRow struct {
	Key        string
	Dispatches int64
	TokensIn   int64
	TokensOut  int64

	// TokensTotal is read as written, straight from the line's tokens.total
	// field. It is not recomputed as TokensIn + TokensOut: a line's own
	// figure is the one thing on record, even if a future writer ever lets
	// the two drift apart. Spend sorts rows by this field.
	TokensTotal int64

	DurationMS int64
}

// Spend reads every dispatch line from the tip of the journal ref at repoDir
// and groups it by by, which must be one of SpendKeys(). Lines of any other
// kind are skipped, not treated as errors.
//
// Rows come back sorted by TokensTotal descending. A tie sorts by Key.
//
// The second return, hasRef, reports whether the journal ref exists at all.
// A repo that has never written to the journal has hasRef false and no rows.
// A journal that exists but holds no dispatch line (only dial or seal lines,
// say) has hasRef true and no rows: those are two different, both honest,
// answers, and a caller that wants to say so needs to tell them apart.
//
// A line that cannot be parsed as JSON fails the whole query, and the error
// names the object id. That matches the policy highestSeq and rungOf
// already use: one unreadable line is not silently skipped, because a
// silent skip would under-report spend rather than announce the problem.
//
// Spend is read-only. It does not create the ref, write any object, or touch
// the repo's index or working tree.
func Spend(repoDir, by string) (rows []SpendRow, hasRef bool, err error) {
	if !slices.Contains(spendKeys, by) {
		return nil, false, fmt.Errorf("by %q is not one of: %s", by, strings.Join(spendKeys, ", "))
	}

	if err := checkRepo(repoDir); err != nil {
		return nil, false, err
	}

	tip, err := resolve(repoDir, Ref)
	if err != nil {
		return nil, false, err
	}
	if tip == "" {
		return nil, false, nil
	}

	// --full-tree keeps the path meaning the same from any directory in the
	// repo, matching how the write path itself reads the tree.
	out, err := gitOut(repoDir, nil, nil,
		"ls-tree", "-r", "-z", "--full-tree", tip, "--", "events/")
	if err != nil {
		return nil, true, err
	}

	oids, err := treeOIDs(out)
	if err != nil {
		return nil, true, err
	}
	if len(oids) == 0 {
		// A ref only ever exists once its first line has landed, so this is
		// not expected in practice. It is handled the same as a ref with no
		// dispatch lines, rather than assumed away.
		return nil, true, nil
	}

	groups := map[string]*SpendRow{}
	var order []string

	err = eachObject(repoDir, oids, func(oid string, data []byte) error {
		var e struct {
			Kind       string `json:"kind"`
			Role       string `json:"role"`
			Tier       string `json:"tier"`
			Session    string `json:"session"`
			Tokens     tokens `json:"tokens"`
			DurationMS int64  `json:"duration_ms"`
		}
		if err := json.Unmarshal(data, &e); err != nil {
			return fmt.Errorf("journal object %s is not valid JSON: %w", oid, err)
		}
		if e.Kind != "dispatch" {
			return nil
		}

		key := spendKeyOf(by, e.Role, e.Tier, e.Session)
		if key == "" {
			key = noKey
		}

		row, found := groups[key]
		if !found {
			row = &SpendRow{Key: key}
			groups[key] = row
			order = append(order, key)
		}
		row.Dispatches++
		row.TokensIn += int64(e.Tokens.In)
		row.TokensOut += int64(e.Tokens.Out)
		row.TokensTotal += int64(e.Tokens.Total)
		row.DurationMS += e.DurationMS

		return nil
	})
	if err != nil {
		return nil, true, err
	}

	rows = make([]SpendRow, 0, len(order))
	for _, key := range order {
		rows = append(rows, *groups[key])
	}

	slices.SortFunc(rows, func(a, b SpendRow) int {
		switch {
		case a.TokensTotal > b.TokensTotal:
			return -1
		case a.TokensTotal < b.TokensTotal:
			return 1
		default:
			return strings.Compare(a.Key, b.Key)
		}
	})

	return rows, true, nil
}

// spendKeyOf picks the field a dispatch line groups by. It may return an
// empty string, for a line that does not carry the field: the caller maps
// that to noKey.
func spendKeyOf(by, role, tier, session string) string {
	switch by {
	case "tier":
		return tier
	case "session":
		return session
	default: // "role", already validated by the caller.
		return role
	}
}
