# PR 5: authored entry flows

The entry flow route now reads the canonical model through `flowOf(entryId)`. It shows the recorded callers, handling component or external provider, backed effects, control paths, failures and gaps. Selecting a node reveals its authored detail, referenced contract and pinned citations. Calls and explicit `causes` links lead to their recorded entries.

The synthetic model fixture includes an early-return guard, transaction, store write, loop, call, named parallel lanes, retry exhaustion, failure and cited leaves. Its existing plan shows the original write before, and the new label, audit step, field note and changed failure after. Only the selected projection crosses the browser boundary as serialisable values.

The canvas uses shared UI pieces and a design-system specimen. Final production captures show both themes, before/after, the narrow details sheet and stacked branches. At 1,280 px the named branches share a row; at 390 px they stack and the document remains 390 px wide. Images and measurements are in `verification/pr5/browser/`.

Native workspace discovery and overlays use their own contracts. The native workspace home enters through its entries; legacy workspace readers retain their existing inputs. The first slice exposed two concrete failures: the URL decoder recognised only legacy prefixes, and an external entry hid its explicitly recorded provider. Focused tests reproduced both; the decoder now uses the existing complete vocabulary, and the header retains Payments as an external provider while showing its missing-handler gap. One fixture assertion now finds the transaction by its stable id after the required guard was inserted.

The frozen application has the following completed verification. The separately merged checks-workflow update (PR68) changes only instructions, hooks and their tests; its mandatory pre-push full check and current-head CI validate those additional inputs:

- Completed local full check before that upstream integration: 4,261 tests in 536 files; the existing 125 skipped tests remain. Type coverage is 100%, line coverage 97.53% and branch coverage 87.72%. Architecture, style, duplication and design-drift gates pass unchanged.
- Production build and page budget: 606 pages, including six explicit entry-flow variants; maximum 1,021 KB against 1,024 KB. Required seed responses must succeed.
- Mutation: the exact six requested whole files pass at 75.42% against 75%, with report scope and current source text independently checked. Unrelated inherited cache results do not contribute.
- Inventory: 1,673 consumer rows, 8,990 literal/helper candidates and zero scattered runtime ID operations. All 20 old explorer capabilities remain unretired and unproven.

Every business fact matches merged PR4 exactly. All 188 captured legacy routes retain their status, headings, links and visible payload. The baseline audit retains all 8 Personal, 80 Acme and 16,334 Volvo today-node identities and their backed facts. PR4's previously evidenced ownership, placement and ordering corrections are rechecked by `baseline-fidelity.py`.

PR5 adds only transport differences: the library's text boundary, Next's new `entries` route-sibling metadata and streaming wrapper/order variations. Sixty-two exact observed byte pairs have raw response hashes and referenced-value proofs. `transport-proof.py --verify` checks those witnesses without rewriting authored identities, fields or array order. All 193 PR1 baseline files are unchanged.

The final production capture reports retain their flags from capture time. Reports and command logs are losslessly compressed; the original working files remain on disk. After documenting each exact allowance, `accept-comparisons.mjs` recomputes **every** difference from the frozen before/after snapshots with the unchanged comparator and current policy. It records zero unexplained differences for Personal, Acme and Volvo in `comparison-acceptance.json`. This separates acceptance of an observed response from another, potentially differently framed network sample.

Run the evidence checks from this PR's checkout:

```sh
node --import ./tools/register.ts --conditions=react-server artifacts/rebuild/verification/pr5/accept-comparisons.mjs
python3 artifacts/rebuild/verification/pr5/fidelity.py --comparison comparison-complete
python3 artifacts/rebuild/verification/pr5/baseline-fidelity.py --comparison comparison-complete
python3 artifacts/rebuild/verification/pr5/transport-proof.py --verify
python3 artifacts/rebuild/verification/pr5/transport-proof.py --verify --report transport-proof-final.json
python3 artifacts/rebuild/verification/pr5/transport-proof.py --verify --report transport-proof-complete.json
```

The final source fingerprints, model proof, command logs and exact-scope mutation report are in `verification/pr5/`. The external-provider correction was followed by a repeated full check, build, budget and mutation run. No producer, cache, old explorer capability or company data is retired. Volvo and the user's checkout files were not edited.
