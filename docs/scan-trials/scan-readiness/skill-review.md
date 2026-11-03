# Scanning skill review

Reviewed on 25 October 2026 against OpenAI's
[Astra skill guidance](https://developers.openai.com/blog/rethinking-skills-and-prompts-for-gpt-6-astra),
[skill authoring documentation](https://learn.chatgpt.com/docs/build-skills) and
[skill evaluation guidance](https://developers.openai.com/blog/eval-skills), plus the installed system
`skill-creator` instructions.

The official guidance favours precise discovery descriptions, conditional reference loading and room for
model judgement. It also calls for clear completion boundaries and evidence from realistic evaluations.
We applied those principles to the scanning workflow; no model-specific skill format or model switch was
introduced. The user's requested model and parallelism continue to govern a run.

## Findings and corrections

| Finding                                                                                   | Correction                                                                                                                                                           |
| ----------------------------------------------------------------------------------------- | -------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Long descriptions mixed discovery with implementation detail                              | Short descriptions identify scanning, single-repository exploration, schema authoring or evidence-based questions                                                    |
| New scan work loaded legacy YAML and execution-proof procedures                           | Short entrypoints select a format; legacy and canonical detail now lives in conditional references                                                                   |
| A prohibition on inferring actor intent conflicted with the required interpretation phase | Source proof still requires typed evidence; useful contextual guesses are explicitly required and labelled **Inferred**                                              |
| Repeated manual reconstruction had no shared improvement workflow                         | The [learning loop](../../../.agents/skills/groundwork-scan/learning.md) requires a reproducer, reusable correction, regression and affected-evidence follow-through |
| Tool improvements during parallel work could mix analysis versions                        | One owner integrates shared changes at a checkpoint; new outputs use current fingerprints and retain old receipts                                                    |
| Read-only questions could be mistaken for scanner maintenance                             | The question skill answers from selected evidence and records maintenance gaps for an authorised scan                                                                |

The existing legacy procedures were preserved in `legacy-refresh.md`, `legacy-fragment.md`, `legacy-yaml.md`
and `legacy-map.md`. Canonical execution details remain available separately. The legacy stable-ID anchor
and the graph skill's rule-15 reference continue to resolve. Current pipeline commands, immutable publication,
provenance, stopped-scope boundaries and runtime uncertainty remain explicit.

The adjacent graph and landscape skills were reviewed too. Graph mapping now explicitly selects the
production YAML workflow; missing traffic or ownership no longer discards technical discoveries, and an
auth directive or regional cache key does not by itself prove enforcement or public cache eligibility.
Landscape proposals explicitly permit useful labelled purpose and participation inferences. Both keep
their focused existing references rather than inheriting every scan mode's procedures.

## Instruction footprint

| Skill entrypoint   | Before, lines | After, lines | Description before/after, characters |
| ------------------ | ------------: | -----------: | -----------------------------------: |
| groundwork-scan    |           314 |           70 |                            659 / 160 |
| groundwork-explore |           208 |           64 |                            588 / 155 |
| groundwork-schema  |           208 |           48 |                            558 / 147 |
| groundwork-ask     |            81 |           39 |                            383 / 138 |

Together, the four entrypoints decreased from 62,498 to 15,846 characters, approximately 75%. Their discovery
descriptions decreased from 2,188 to 600 characters. Supporting detail is loaded when relevant rather than
removed. These are file measurements, not measured token, quota or runtime savings; a task may load only
one skill. Before/after snapshots and hashes are retained in
[`scan-skill-review-001`](../../../reports/scan-skill-review-001/metrics.json).

## How learning persists

Each distinct gap has a concise run-local learning record with evidence, affected questions, expected/actual
behaviour, reproducer, correction, verification and follow-through. Future briefs carry open patterns. The
lasting memory is the shared scanner's fix and regression, with only reusable operating knowledge added to
the skills. A verified gap must have regenerated, validated evidence or an explicit excluded stale scope.

Missing external implementations and runtime observations remain deferred proof obligations. They do not
justify invented semantics. Local repairs can proceed within the authorised maintenance scope without
repeated confirmation; stopped repositories, additional source access and application migrations retain
their existing boundaries. Testing is proportional to the changed capability, not a full acceptance pack
for every ordinary data capture.

## Independent forward test

A fresh Sol Medium subagent received the revised skills, an isolated synthetic typed-child capture, a small
failing checker and source/context snippets. It was asked to repair the checker, preserve source inputs,
record learning, interpret the small component and address absent external behaviour. No intended repair
or prior diagnosis was supplied.

The agent produced a reusable role-binding correction, six regression test methods and before/after replay.
The original checker failed the same test suite; the correction passed permutations, renamed IDs, malformed
and destructive variants. The parent independently reran its replay. Input hashes remained unchanged and
the affected fixture binding was regenerated under the new checker digest.

The agent also supplied a medium-confidence **Inferred** account-profile purpose, retained identity and
durability as unknown/deferred, and distinguished a read-only question from authorised tooling repair.
Writes stayed in the scratch fixture directory. The
[report](../../../reports/scan-skill-review-001/forward-test/REPORT.md),
[verification](../../../reports/scan-skill-review-001/forward-test/verification.json) and learning records
are retained for inspection. This was one synthetic workflow evaluation, not a new Volvo scan, statistical
model comparison or new production-extractor acceptance proof.

## Verification

All six reviewed skills pass the installed skill validator. Sixty relative reference targets across nineteen
Markdown files resolve. Repository lint, tests, combined checks and build results are retained with the
review artefacts. The wider scan queue remains stopped; this review changed skills and documentation, with
the fixture repair isolated from production tooling.

`npm test` passed 2,788 tests; the combined check passed 2,837 tests, including architecture checks, with
119 explicit skips. The build passed. The first combined run used the default worker count and hit five
5-second fixture timeouts; the unchanged suite passed with `VITEST_MAX_WORKERS=2 npm run check`. Both logs
are retained. This host-specific process correction is recorded in the review's learning notes rather than
being imposed as a universal scanner rule. No assertions, timeout limits or coverage requirements changed.
