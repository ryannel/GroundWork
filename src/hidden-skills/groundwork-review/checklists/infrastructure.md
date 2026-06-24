---
name: infrastructure-checklist
description: >
  Type-specific failure modes for reviewing a draft infrastructure document —
  the verified description of the running local environment.
---

# Infrastructure Checklist

This checklist checks a draft `docs/architecture/infrastructure.md`. It answers one question: **could any
developer run the local environment from this document alone — boot it, test it, and verify it
is healthy — without asking a question?**

Each item names a violation. Match it against the document text plus `docs/architecture/index.md`;
answer yes/no.

## Document Hygiene

- [ ] 🟡 **Leftover downstream summary**: the published doc still carries a `## Summary for
  Downstream` section. The cross-phase contract now lives in `.groundwork/context/infrastructure.md`,
  not in the published doc; an old-template summary section is residue and should be removed.

## Runnability

- [ ] 🔴 **Port without a boot command**: services and ports are listed but the document never
  states how to start them — an inventory is not an environment.
- [ ] 🔴 **Test path unstated**: the document does not say how to run the test suite, or names a
  test command without saying what it runs against (running stack vs self-booting).
- [ ] 🟡 **Health unverifiable**: a service is listed with no health endpoint or equivalent check
  — a developer cannot tell a booted service from a hung one.
- [ ] 🟡 **Raw commands beside a managed surface**: the environment has a single management
  surface (a `./dev` CLI or equivalent) but the document instructs raw per-service commands that
  bypass it — two run paths rot independently.
- [ ] 🟡 **Migration path missing**: a service includes a database but the document never states
  how migrations are run.

## Verification Honesty

- [ ] 🔴 **Unverified fact stated as verified**: the document presents ports, commands, or test
  results as confirmed while also recording (or omitting) that the system was never booted — a
  verification section is mandatory, and "pending" must be flagged, not papered over.
- [ ] 🔴 **Verification without results**: a verification section exists but cites no outcome —
  no test counts, no health responses, no named checks. "Everything works" is a claim, not
  evidence.
- [ ] 🟡 **Stale specificity**: the document hedges concrete facts it is responsible for
  ("typically port 4000", "the test command should be...") — this doc records the actual system,
  not the theoretical one.

## Service Inventory

- [ ] 🔴 **Architecture service missing**: a service named in `docs/architecture/index.md`
  does not appear in this document's inventory, with no explicit note that it is not yet
  scaffolded.
- [ ] 🔴 **Orphan service**: a service appears here that the architecture does not define —
  infrastructure has silently extended the system.
- [ ] 🟡 **Inventory row incomplete**: a service row lacks its language/generator, port, or base
  path — a developer cannot locate or address it.
- [ ] 🟡 **Shared infrastructure unlisted**: a dependency the services plainly use (database,
  broker, tracing backend) is absent from the infrastructure table — it will fail to exist on a
  fresh machine.

## Environment Requirements

- [ ] 🔴 **Secret or env var requirement unstated**: a service needs credentials or environment
  variables to boot (auth keys, provider tokens) and the document neither lists them nor points
  to where they are configured — the first fresh boot fails opaquely.
- [ ] 🟡 **Implicit tool dependency**: the boot path assumes a tool (Docker, a language runtime,
  a CLI) the document never names as a prerequisite.
