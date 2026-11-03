# EV Subsidy API checkpoint

This is a bounded, source-reviewed API unit inside the CDLS monorepo. It is not a complete app or repository capture.

The pair contains 670 records at pin `8e1fd20c525fd3ef46f89fa7734dba06b06c79fc`, snapshot `5f59c5db11e155019ace1500542dc4db1648a1616d330523ac05aa7481724664`. Native structure/ownership/snapshot validation passes, including 100 pinned source ranges. The strict pack validates all 25 requests, responses and continuations with budgets 2000 nodes/5000 records; no bounds occur.

Four actual source REST declarations are included: POST eligibility, POST income, GET status and GET docs. The three outbound fetches use the configured `PREMIE_API_BASE_URL`; no effective destination hostname or deployment is asserted. Both GET bodies return source JSON without application I/O. The local proxy implementation excludes API paths and does not declare authentication; effective framework activation remains external.

The eligibility path retains coordinate guards, DESO lookup/status propagation, missing-code return, the geography payload with literal four/twelve-month fields, eligibility response selection and local catch500. The income path retains row normalisation, finite-number guard, adult/child construction, loop and source payload, status propagation, missing income section and local catch500. Number-only coordinates/children are not strengthened into range/integer checks. Immediate fetch Promise handles and eventual Response values are separate; actual NextResponse payload associations remain separate from unknown imported response serialization.

Meaningful source transformations and branch conditions are native. The small array-selection/construction expressions are compressed into source-anchored operations rather than expanded as fictitious callback registrations. The loop records element/collection associations; it does not prove heap SSA or guard feasibility, and zero adult iterations remain possible. Unknown imported expression faults retain conservative local catch paths.

Other UI, SSR, configuration/helper and monorepo partitions remain in progress, with explicit not-examined coverage. No source app, source tests, source build, live endpoint, store, broker, registry or package installation was executed. Groundwork native validation and query APIs only were exercised.

Preserve this checkpoint's IDs and bytes. Any changed fact needs a fresh revision namespace. The coordinator owns shared source logical identity and host reconciliation across later bundles.
