# PR8: Frozen plan addresses and canonical readers

The frozen Volvo manifest is unchanged (SHA-256 `ed5b6b345b32bdcac28532e7f4d39e16ede3b7c3fff61bcd74238aa6934e8209`). The canonical route receipt, `native-plan-routes-volvo.json`, checks the actual eight plan folders: 8 covers, 64 chapter screens and 8 thing tokens all resolve in the same native outline and current identities used by the route. The 8 `plan.json` addresses are separately labelled; this receipt proves their plan identities, not the JSON response or its payload. It does not claim an HTTP or production build proof.

The missing addresses were restored without redirecting to a cover:

| Original screen | Plans | Native source |
| --- | --- | --- |
| changes/contracts | financing status, sales tool, stock reservation | Actual affected contract identities and full change records: 6, 3 and 3 matching operations respectively |
| changes/more | Care online | Other affected records and full changes: the schema and screen operations |
| changes/flows | immutable IDs, sourced financing terms | 4 and 14 distinct changed authored flow roots, respectively; the chosen flow is read from the selected index |
| changes/flow-gpe-price-configuration-calculation | unify price breakdown | The exact changed flow, with its full change records |
| journey/empty | Care online, order change, sales tool, stock reservation | A visible absence: those sources have no authored story, execution or affected flow |
| prove/e2e | All except Care online | Only actual authored end-to-end tests: 1, 1, 1, 1, 2, 4 and 2 respectively |

Canonical cover, chapter and thing routes now use only the selected model projection and independent plan metadata. An unknown plan or chapter returns not found. Progress show/add and system-narrative packet/check read the canonical workspace; progress still reads and validates the independent append-only record without an old plan reader. Legacy files remain for their separately tracked retirement.

Focused verification: 31 tests passed across plan outline, plan rendering, native routes and the real CLI suite. The restored contract screen retains the full change; the end-to-end view distinguishes contract tests; the empty journey does not invent a walk. The grouped flow screen renders the selected authored flow and keeps the others reachable with the team and version view preserved. The five CLI subprocess tests exercise progress show/add, refusal of an unknown subject without a write, and narrative fingerprint/backing validation on isolated data.
