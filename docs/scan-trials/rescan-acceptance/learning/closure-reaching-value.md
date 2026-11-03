# Closure assignment and reaching values

State: verified on synthetic counterexamples and the bounded Rust router source selection. Historical
native proof packs remain immutable and require replay under the current analysis fingerprints.

The bounded `graphql-federation-router` selection at
`b8e0790b09e8f6772b8ada267a1e5114ab4fc707`, `src/require_client_name.rs`, exposed three invalid
`reaching_value` edges for the locally assigned `handler` and `get_header_value` closures.
`appendAssignment` requested an `assigned_value` edge from the outer identifier to the closure function.
The existing ownership filter correctly rejected that relation across lexical owners. It then emitted
`reaching_value` edges anyway. The semantic validator rejected them because their target did not have one
established assigned identifier value.

The reusable correction in `backend-semantic-relations.ts` emits reaching values only when the assigned
value and target have the same owner. It leaves the ownership filter intact. Cross-owner closure callback
and capture topology remains represented separately. This is a semantic correction, not an edge-id migration
or a reason to replace old expected answers silently.

The regression `retains closure callback topology and scalar reaching values without inventing closure
assigned values` in `python-rust-semantic-bindings.test.ts` asserts callback topology, ordinary scalar
reaching values and complete domain semantic validation together. It detects the original bug; testing only
that parsing succeeded would not. Python/Rust syntax recovery, direct-call rebinding, imported framework
counterexamples and parsed operators beside comments are separate regressions.

The prior three invalid Rust edges were:

- `semantic-edge:v1:e2869f881d007f33ddb8a45249afb770fcacded5c06e1271eaf40299c163d8d9`
- `semantic-edge:v1:a4d1bd7e85ce9bf98f0ce013b71dbd13b2ec2613d86d1c2927d9540ecc686a46`
- `semantic-edge:v1:b8c67e1a4133ffbbb0c3ad394549338a2a470194cdc095e22717bf23fc110710`

These failed candidate graphs were never accepted publications. A separate Rust correction maps its
value-yielding `if` construct to a conditional expression, so a conditional can be a call argument without
relaxing any node-kind rule. Python/Rust operators now come from compiler AST/operator tokens; unsupported
operators and unsafe Python integer precision remain unresolved. No validator or frozen oracle was weakened.

Every source-dependent receipt, including the old seven native probes and 225 frozen questions, must be
replayed by its owner. If a historical answer depended on one of these invalid reaching edges, record the
changed answer and affected records as a typed semantic delta; do not force byte equality or classify the
change as a harmless identity rename.
