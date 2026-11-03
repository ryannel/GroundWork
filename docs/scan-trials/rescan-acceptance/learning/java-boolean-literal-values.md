# Native boolean values and equally spelt strings

State: verified by six native language regressions and the final Customer-service archival replay.
All 225 frozen mutations reject, and all seven native probes pass with explicit edge-ID migration; see
[the independent question review](../customer-independent-question-review.json).

The fresh Customer-service source graph at `09623ab3a1f39845d8fc02abc3d591b53a3b5fea` differed from the
accepted graph at 17 semantic nodes: 16 Java boolean literals had become string values, plus one legitimate
improvement to a parsed string/character literal. The native seven-probe replay did not exercise all these
atoms. The frozen 225-mutation suite correctly rejected Q12, Q13, Q16 and Q19 positive baselines.

The Java adapter historically encodes `LiteralTree` booleans as `literalValue: "true"` or `"false"`.
The shared native-literal improvement began preferring that value over source spelling so Python
single-quoted strings, booleans and nulls could retain actual AST values. It needed to preserve the Java
compiler's boolean **kind**, rather than interpreting the metadata's JSON string as a source string.

`backend-semantic-nodes.ts` now handles `BOOLEAN_LITERAL` first. An already typed boolean remains a
boolean; canonical true/false metadata becomes a boolean. `STRING_LITERAL` with the same characters
remains a string. The native parser/index format and retained indexes remain compatible; regenerating
facts closes this issue without rewriting the frozen oracle or forcing unnecessary source reparsing.

`native-literal-values.test.ts` checks actual Java, C#, Python, Rust and TypeScript adapters with true/false
and equally spelt string values. The Go counterexample preserves predeclared identifier syntax as
unresolved identifiers, since parse-only syntax cannot prove that `true` or `false` was not shadowed.
All six checks passed. An in-memory diagnostic normalisation of exactly the 16 failed candidate atoms
also restored every Q12/Q13/Q16/Q19 positive clause; that diagnostic is deliberately not an accepted capture.

Preserve the failed receipt, publish a fresh immutable source generation under current fingerprints, and
rerun all 225 frozen mutations and the seven native probes. No affected question can be counted as freshly
supported from the diagnostic or the UI. The frozen source tally stays 13 supported, eight partial and one
unsupported only when the fresh evidence validates; inference and remote/runtime uncertainty stay separate.
