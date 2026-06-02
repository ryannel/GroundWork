# Plan intent

This is the plan for inkwell, written as prose so that nobody has to guess
what I meant.

The bet is called bet-inkwell. The bet is that plain text layout is a small
enough job to finish properly once, in one library, instead of half finishing
it inside every program I write. Finishing it properly means the awkward cases
are handled, not just the easy ones: the word longer than the line, the string
that ends in the middle of a letter, the list marker somebody actually asked
for. If the awkward cases turn out to be endless, the bet is wrong and I
should go back to copying twenty lines between projects.

There are two milestones. The first is called Paragraphs, and it is done when
text can be wrapped to a width and a block can be indented and a long string
can be shortened. The second is called Awkward Cases, and it is done when the
things that make plain text layout annoying are handled: a hanging indent that
lines continuations up under the first line, tabs that take the width they
occupy rather than counting as one character, truncation that never cuts a
letter in half, list markers of the caller's choosing, and title casing that
knows what to do with a hyphen.

There are four slices. Slice S1 wraps a paragraph to a width, keeping blank
lines between paragraphs and never breaking a word that is longer than the
line. Slice S2 adds block indenting and truncation with an ellipsis. Slice S3
adds the hanging indent, tab handling, and rune-safe truncation. Slice S4 adds
bullet and numbered lists and title casing.

Slices S1 and S2 belong to the first milestone. Slices S3 and S4 belong to the
second one.

Now the proofs. For slice S1 they are TestWrapBreaksAtWidth and
TestWrapKeepsLongWordsIntact. For slice S2 they are TestIndentPrefixesEveryLine
and TestTruncateAddsEllipsis. For slice S3 they are
TestHangAlignsContinuationLines, TestWrapExpandsTabs and
TestTruncateRespectsRuneBoundaries. For slice S4 they are
TestBulletsUseTheGivenMarker and TestTitleCaseHandlesHyphenatedWords.

The first milestone is finished and its four proofs pass.

The second milestone is not finished. There are commits against S3 and S4, and
there is code in the tree with the right function names in it, but the awkward
cases the milestone exists for are still not handled. So the plan expects five
proofs to be red at the tip of this branch, and those five are
TestHangAlignsContinuationLines, TestWrapExpandsTabs,
TestTruncateRespectsRuneBoundaries, TestBulletsUseTheGivenMarker and
TestTitleCaseHandlesHyphenatedWords. A green run of the whole suite is not on
its own a reason to call the second milestone done. The behaviour described
above is the standard, and the proofs are only useful while they hold that
standard.
