# PR 1 CI follow-up

The user authorised merging PR 1 and continuing through the stack on 5 November 2026. The earlier per-PR
review stop is superseded. A design amendment, review rows requiring human acceptance, and the §10.2 cache
choice before PR 9 still require a real human decision. Each PR keeps its own worktree and proofs.

## Clean CI parser setup

The PR CI run failed six Rust tests across four files. Python was present, but the pinned tree-sitter
Rust wheels were absent on the clean runner. The test job now runs the existing setup command and its
synthetic Python/Rust parse verification before coverage. No test is skipped or relaxed.

## Capture corrections and security review

CodeQL identified entity decoding in multiple passes and case-sensitive script/style removal. The capture
now extracts inert comparison fields in one pass over visible tokens, handles mixed-case raw-text elements,
and decodes an entity once. Unit tests cover nested escaping, hidden markup and same-origin links.

HTTP capture accepts only loopback HTTP(S) origins without credentials and same-origin absolute route paths.
Redirects are not followed. A manifest cannot redirect capture to an external server. Snapshot names must be
simple JSON data filenames inside the user-selected output folder; path traversal and executable extensions
are rejected before writing.

The `js/file-access-to-http` and `js/http-to-file-access` notices describe the command's explicit requested
purpose: use authored route paths to query the user's local Groundwork server, then persist complete route
and JSON/view-model responses as comparison records. Requests are GETs to the chosen loopback server, not
uploads of file contents or secret headers to an outside server. Response data cannot choose the destination
filename, and the serialised JSON/gzip records are never executed. Those two flows are reviewed intentional
I/O, not a backdoor. Any remaining instances in these exact capture functions are false positives to be
recorded individually in code scanning; no CodeQL rule is disabled.

The original baselines remain unchanged. Fresh comparisons for Personal and Volvo report no differences;
Acme has only its already documented exact streaming-wrapper size variation. All three have zero
unexplained differences. Parser verification and focused checks pass locally. Full checks and CI results are
recorded with the follow-up validation artefacts before merge.

## Local verification

Full check passed: 3,839 tests passed, 125 existing-suite skips, 100% type coverage, and the same passing
coverage thresholds. Production build passed. The budget passed across 599 pages, all within 1,024 KB.
The frozen baselines have not been changed. Updated inventories contain 1,595 consumer rows and 6,792
id/URL candidate sites; two identical inventory runs remain byte-identical. Logs are under `validation/`;
the fresh comparison reports are under `verification/pr1-ci/`. Remote checks are on PR 64.
