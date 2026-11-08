# Historical plan fixture boundary

The current generator writes only the five consolidated workspace, plan and evidence
contracts. Running it produced a clean diff for all five. The historical plan schema moved
into the fixture directory. Formatting changed and the parsed schema is identical. The existing fixture generator equality check and
legacy plan fixture validator still run in tests. The test-only generator keeps the exact old
declaration and removes legacy output from the normal authoring command.

Some current views still share the old declaration's plain presentation types. The active
routes have zero legacy model fact bindings. Their rendering and data access did not change
when the test schema and generator were isolated.
