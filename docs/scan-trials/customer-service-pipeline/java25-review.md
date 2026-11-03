# Java 25 parser review

This review is limited to `volvo-cars/cds-ecom-customer-service` at
`09623ab3a1f39845d8fc02abc3d591b53a3b5fea`. Other repository scans remain stopped.
Trial 003 is the immutable baseline: 334 diagnostic-free Java files and six quarantined files.
A compatible parser restores local source facts; it does not close the wider system questions.

## Independent source expectations

The six affected files were read from their pinned Git objects with implicit fetching and terminal
prompting disabled. Their source establishes these regression checks:

- `FactoryContext.getConnectToken`, lines 65–67, and `getEntraIdUser`, lines 71–73, return complete
  conditional expressions. The positive arm calls `Optional.of` with the matching record binding;
  the negative arm calls `Optional.empty`. Neither return may stop after `instanceof`.
- `IIndividualFactory.createFromContext`, lines 24–34, switches between null, an unnamed Volvo ID
  binding, a Connect token binding and an Entra ID user binding. Named bindings belong to their own
  cases; the unnamed binding introduces no queryable variable.
- The unnamed catches in `OrderUpdateEventConsumer` line 90, `OidcTokenDecoder` line 72,
  `TrustedIssuerValidator` line 80 and `PhoneNumberValidator` line 21 preserve their typed catch
  bodies without inventing a variable named `_`.
- `OrderUpdateEventConsumer.isValidOrderEvent`, lines 128–132, retains every conjunction despite
  the inline comment between the final two operands.

## Defect caught during implementation

The initial pattern lowering handled cases and positive `if` arms, but omitted conditional
expressions. That would parse `FactoryContext` successfully while leaving its actual token/user
operands disconnected from their pattern bindings. The implementation now includes the positive
conditional arm, with a regression using identical names in both arms to reject binding leakage.

## Six-file smoke review

Independent smoke extraction read the six retained baseline source indexes and parsed only those six
files, using the default managed `javac/25.0.5` runtime. It performed no Git source reads and did not
run an application build or the service's tests. All six parsed without diagnostics and emitted native
semantic graphs. All six retained source contents hash to the exact Git blob IDs in the pinned trial 003
inventory. All 1,862 native syntax-node source anchors were recomputed from their source spans and
matched the exact start/end lines, alongside repository, revision and path checks.

The full `FactoryContext` return-to-conditional relations and both arms passed, including pattern
`reaching_definition` links for the token/user operands. The constructor's token use inside its lambda
has a `captures` relation to its declaration. `IIndividualFactory` has four distinct case alternatives;
its Connect and Entra ID operands link to the declarations in their own cases. The order admission
guard retains a typed final `&&` and the `StringUtils.hasText(payload.customerId())` right operand.
All four unnamed catches retain a structured body.

The smoke review caught a second defect before accepting unnamed-binding semantics: Java 25 returns
an **empty** `VariableTree.getName()` for `_`. Testing only the spelling `_` therefore missed it.
All four unnamed catches initially had a `parameter` relation, with the parameter's name falling back
to its full syntax (for example `NumberParseException _`). The corrected adapter recognises the compiler's
empty name. After the production freeze, all six real-file smoke checks passed the semantic validator;
all four unnamed catches had zero parameter relations, preserved bodies and no named `_` binding.
The factory conditional, switch, capture and comment-operator checks also passed again.

An independent malformed-source probe under the actual Java 25 runtime still failed closed: two parser
diagnostics, one pinned source and parser gap, zero semantic nodes, summaries or candidates.

Thirteen runtime-selection/provenance regressions pass. They cover explicit override precedence,
missing-manifest fallback, malformed/stale managed state, executable validation, identical effective
compiler selection for parsing and fingerprinting, and invalidation when its actual version or adapter content changes.
The owned tests pass ESLint; TypeScript checking passes.

## Publication review

The accepted parser-upgrade selection is
[trial 005](../../../reports/customer-service-pipeline-005/repository.json). Independent inspection
found all 340 Java paths exactly once across nine shards, with zero diagnostics and 18 passing public
validations across the first and unchanged phases. All nine unchanged generations equal their first
phase's generation. The scanner rule fingerprint is uniform; the toolchain fingerprint changed from
trial 003. Local freshness is unchanged; remote and deployed freshness remain unproved.

| Phase | Java source Git reads | Parses | Index hits |
| ----- | --------------------: | -----: | ---------: |
| First |                     0 |    340 |          0 |
| Warm  |                     0 |      0 |        340 |

This is a parser-change reprocess using retained source, not another cold source-read benchmark.
The new default managed compiler was used without an explicit `--java` override. The actual six-file
smoke identified it as `javac/25.0.5`. Runtime-version and adapter-content fingerprint regressions
independently establish invalidation inputs; the full trial establishes retained-source reuse.

All six published semantic graphs match the independently validated smoke records exactly, including
their source lines. Their restored native records are:

| File                     | Semantic nodes | Semantic edges |
| ------------------------ | -------------: | -------------: |
| FactoryContext           |            406 |            717 |
| IIndividualFactory       |            207 |            375 |
| OrderUpdateEventConsumer |            493 |            945 |
| OidcTokenDecoder         |            315 |            566 |
| TrustedIssuerValidator   |            384 |            744 |
| PhoneNumberValidator     |             88 |            157 |

Every shard uses the same unknown analysis host component and environment. Supporting source records
remain local to each shard. This consistency does not establish deployed component identity.

Trial 004 stopped with a validation failure after three published shards, before the unnamed-catch
correction. Its partial artefacts remain unchanged; it is not an accepted repository selection.
Trial 003 remains the immutable baseline. The previous 22-question answerability scores were not
rerun, and all 2,720 broad obligations remain unresolved. Parsing modern features and restoring these
local facts does not establish complete endpoint answers or deployed behaviour. No other repository
scan or application migration is part of this acceptance.

## Remaining modern-syntax limits

Pattern bindings are proved only within their matching case or a positive `if`/conditional arm whose
condition is the direct `instanceof` pattern. Negated, compound and more general flow-sensitive pattern
scopes remain unsupported. The parser is not a Java type checker and does not establish exhaustiveness,
class loading, overload resolution or runtime dispatch. Preserved unnamed syntax does not introduce a
usable variable. Callback capture establishes lexical origin, not asynchronous scheduling or completion.
