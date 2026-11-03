# Configuration protobuf contracts independent notes

All21files fully read. This pin contains19proto declarations, README and CODEOWNERS; no service/RPC/HTTP/producer/consumer/store implementation. README generation paths use older cce directories and Betterproto1.2.5; source instructions are not deployed/generated artifact proof. Topic fields and event-named messages are declarations rather than subscriptions.

Separate fully qualified v1 and v2 CarKey/Component/MarketAuthIdentifier identities. Nested Rule.Component and recursive Rule.Condition must resolve in lexical scope before package-level Component/Condition. Repeated fields and recursive shapes must retain references, not flatten indefinitely. Preserve exact ParterNames spelling. Enum numeric tags and field numbers are declared; gaps/nonsequential numbering do not establish reserved ranges.

V2CarDetails local_trim_edition_code tag10 is explicitoptional/deprecated; local_edition_code tag11 explicitoptional. V2CarSpecificationRemoved deprecated local_trim_edition_code tag4 remains distinct from local_edition_code tag5. StylingSpecification.default_combination tag3 is deprecated and default_colors/default_upholsteries tags4/5 are repeated. Package optional ExactlyOne fields and standard_wheel/default_code explicit presence remain distinct from ordinary proto3 scalars and runtime codec defaults.

CarSpecification.forbidden_structure_week_periods uses tag8 despite declaration order; Option required_wheels tag8 and forbids_wheels9/forbids_upholsteries10 likewise. Fully qualified google.protobuf.Timestamp import source is external/unavailable. Do not substitute observed JSON field names/defaults or envelope/header routing without consumer/generated authority at matching revision.
