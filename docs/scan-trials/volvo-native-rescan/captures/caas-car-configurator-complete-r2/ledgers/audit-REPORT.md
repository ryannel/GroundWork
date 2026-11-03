# CaaS finite aid regression audit

Two unsupported range-key type projections require a minimal successor. Sealed complete-01 remains unchanged. No computed-map-key or init-cardinality defect was found.

Source pin: `5495209c1485f7098f666ad066a44ccc140a4fb9`. This is an audit of two concrete authoring patterns and generated init identity, not another source extraction or compiler/heap proof.

## Actionable facts

Both values below are labelled `Source range key/index for this iteration` and point at `shape/source-type/6da88c34ba124c41` (`Go source scalar int`). Their actual source ranges use a blank first variable. The imported method return signature is unavailable, and available local source does not establish its first yielded type. Neither value has an outgoing native flow or used source variable binding. Clear only these two unsupported shape references and attach exact native source gaps/claims:

| Native value suffix after `caas-car-configurator-5495209-complete-r1/` | Actual source                                                                                                 |
| ---------------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------- |
| value/ebfdc63acc19c2c3/v/65068                                         | `internal/domain/ruleset/nextcarkey.go:456–462`: `for _, subSelectionID := range selection.SubSelectionIDs()` |
| value/bfaa4a423a918691/v/73320                                         | `internal/domain/ruleset/selection.go:74–79`: `for _, id := range selected.IDs()`                             |

This identifies unsupported source projection, not a demonstrated different SDK runtime type. It does not change the actual yielded component IDs, execution, I/O or storage facts. The source return signature/policy remains unresolved.

## Supported facts retained

All 247 key projections were reconciled in `range-audit.json`: 213 established source arrays/slices; 17 established source map keys; seven local alias chains (`PackageVariant -> ManyComponents -> []Component`); one integer range; five `puan.Selections` sites constrained to slices by local builtin `append`; and two `puan.TimeBoundVariables` sites constrained by available source syntax. Those two latter sites are not blanket-labelled unknown merely because the definition is imported: `convert_stored.go:152` uses builtin make; ordinary source `ruleset/fake.go:70–72` constructs an unkeyed `puan.TimeBoundVariables{timeBoundVariable}`; source also ranges over it. Together those source requirements exclude map, struct, channel and integer alternatives. This is a local source constraint, not an assertion that the imported type definition was inspected. `Selections` similarly has unshadowed builtin append at `selection.go:82` and `nextcarkey.go:73–83`. Exact imported element fields remain unresolved. Local aliases are explicit at `ruleset/components.go:19` and `package_variants.go:13`.

All four explicit map literals occur in generated protobuf enum declarations and have eight literal keys. There are no computed composite map keys, no selector/computed key expressions, and no nonidentifier native shape field names. Existing dynamic map indexing/assignment is separate source syntax. No CPAM-style `river.QueueDefault` field fabrication exists here.

All seven generated same-package `init` declarations have seven distinct source path/start keys, native implementation IDs, logical IDs, entry operations and body frames. Their names coincide, but no actual init frame was collapsed. The preparation-only function lookup may overwrite same-name syntax candidates; native expansion uses the complete method list and list-valued package-function index. No explicit `init()` call is bound (Go does not permit ordinary source invocation of init). No runtime initialisation ordering is inferred.

The successor must use namespace complete-r2, preserve logical IDs, retain all source tuples, replay all 125 primary plus four control author requests and the parent's 26 strict harness queries, and verify the immutable predecessor seal. No source build/test, fetch, dependency download or live call is needed.
