# Keep the progress contract independent

The live progress reader and writer previously compiled the format-1 plan schema to validate
`progress.yaml`. The consolidated plan schema now holds the exact `date`, `progressEvent` and
`progress` definitions. Only the two progress definitions were transferred. The canonical date
definition was already identical. Generated types and all progress readers use this authority.

A comparison against the format-1 validator at `329dc9f2` found all three definitions structurally
identical. Both validators accepted all three checked Volvo progress files and all six events.
Eight invalid inputs returned identical diagnostics, including missing fields, bad date and
subject values, an invalid state, invalid URI and issue values, and an extra property. Focused
writer, generated-contract and progress projection tests passed 20 tests. The existing writer
tests also cover append behaviour and duplicate GitHub event handling.

The remaining format-1 plan types and schema still serve the retained readers and proof tools.
This change removes the live progress dependency without changing its schema or records.
