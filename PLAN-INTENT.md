# Plan intent

This file is the plan for ledgerline, written out longhand so anyone picking
the work up can see where it is going without asking me.

The bet is called bet-ledgerline. The bet is that a plain text file plus one
small command is enough bookkeeping for one person, and that nobody needs a
database or a web app to answer "where did the money go last month". If that
holds, the tool stays under a thousand lines forever. If it does not hold, we
find out early and stop.

The bet has two milestones. The first milestone is called Totals From A File.
It is done when someone can point the command at a ledger file and get a
readable per-account total back, with a grand total under it. The second
milestone is called Slices And Budgets. It is done when the same person can
narrow the ledger to a date range and see which accounts went over a limit
they set. The first milestone is the whole product for a month or two; the
second one is what turns it from a printout into something you check.

There are five slices in all. Slice S1 parses one ledger line at a time into
an entry, and reads a whole file into a list of entries, ignoring blanks and
comments. Slice S2 folds those entries into per-account balances, dropping
accounts that net out to nothing. Slice S3 renders the balances as an aligned
column report and wires the totals command up to it, so the tool actually
runs. Slice S4 filters a list of entries down to a date range, with both ends
of the range counted as inside it. Slice S5 compares account spend against a
map of limits and reports the accounts that went over.

Slices S1, S2 and S3 belong to the first milestone. Slices S4 and S5 belong to
the second one. The order matters: S3 cannot land before S2, and S2 cannot
land before S1, because each one eats the last one's output.

Every slice has one or two proof tests. These are the tests I would point at
if someone asked me to show that a slice is really finished, rather than
merely committed.

For slice S1 the proofs are TestParseEntryRejectsMalformedAmount and
TestParseLedgerSkipsCommentLines. For slice S2 the proofs are
TestBalancesGroupByAccount and TestBalancesIgnoreZeroNetAccounts. For slice S3
the proofs are TestReportRendersAlignedColumns and
TestRunTotalsCommandWritesReport, and that second one is the one that matters
most, because it is the only test that drives the real command end to end. For
slice S4 the proof is TestFilterByDateRangeInclusive. For slice S5 the proof
is TestBudgetFlagsOverspentCategories.

The tests for S4 and S5 are written and committed ahead of the work. They sit
red on purpose. I like committing the red tests early because it stops the
shape of the future function drifting while the earlier slices are being
built, and because a red test is a better note to myself than a comment is.
Anyone reading the plan should expect those two proofs to fail until somebody
picks the second milestone up.
