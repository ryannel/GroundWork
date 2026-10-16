---
name: groundwork-workspace
description: Create a Groundwork workspace as its own repo, or register one that already exists on this machine. Use when someone wants to set Groundwork up for a company, team or project, asks "make a workspace", "where do the plans live", "add our workspace repo", or has just cloned a workspace repo and cannot see it in the app. Asks who it is for, makes the repo with npm run workspace, fills in the teams and actors the people name, sketches domains and systems from the code repos with them, and hands over to groundwork-scan.
---

# Make or register a workspace

A workspace is one repo that holds everything Groundwork knows about one company (or one part of it): the model of
the systems it runs today, and the plans that change them. The two live together because a plan is read onto
today's model: when a scan moves today, the plans that rest on it see the change in the same history, and one pull
request can carry a plan and the model fix it needed.

Groundwork itself (the app, `tools/`, `schema/` and these skills) is a separate checkout. It reads the workspaces
this machine has registered in `groundwork.local.yaml`, which is git-ignored, plus its own examples in
`workspaces/`. Every `npm run` below runs in the Groundwork checkout.

```
<id>-groundwork/                 one workspace, one repo
  workspace.yaml                 format, id, name, description, private, teams, actors, key_journeys
  domains/<domain>/domain.yaml   id, name, purpose
    systems/<system>/system.yaml id, name, team, repos, components; contracts.yaml and handlers.yaml from scans
  flows/  journeys/  story.yaml  how the systems work together today
  scans/<org>/<repo>.yaml        the commit each code repo was last read at
  plans/<plan>/plan.yaml         the plans, each an overlay on today
  AGENTS.md  README.md  .gitignore
```

## Practice

- **One workspace per repo, one repo per company or business unit.** Call it `<id>-groundwork` and keep it beside
  the Groundwork checkout. Never put a code repo inside it, and never copy code into it: facts cite code by
  permalink.
- **Access is the repo's.** `private: true` keeps a workspace off the public lists, but a static build carries
  every workspace it read. To publish one company's site, build with only its workspace:
  `GROUNDWORK_WORKSPACES=../<id>-groundwork npm run build`.
- **Owners per folder.** A `CODEOWNERS` in the workspace repo: each domain's team owns `domains/<domain>/**`, and
  each plan's owner owns `plans/<plan>/**`.
- **Nothing invented.** Teams, actors, domains and systems come from the people and the code. An empty workspace
  is fine; the landscape says so until a scan fills it.

## Make one

1. **Ask, one question at a time.** Who is it for? Pin down which organisation exactly; many company names cover
   several firms. Then its name, its id (lower case, hyphens), one sentence on what it covers, whether it is
   private, and where the repo goes (default `../<id>-groundwork`, beside Groundwork).
2. **Make the repo.**
   ```bash
   npm run workspace -- new ../<id>-groundwork --id <id> --name "<Name>" --description "<one sentence>" [--private]
   ```
   It refuses a folder that is not empty, writes `workspace.yaml`, `README.md`, `AGENTS.md` and `.gitignore`,
   commits them, registers the folder and links these skills into it. If the commit fails (no git identity), say
   so and leave it for them.
3. **Teams.** Ask which teams build and run the systems. Write each into `workspace.yaml` as `team:<id>` with its
   name, and its chat channel if they give one. Only the teams people name.
4. **Actors.** Ask who uses what the teams build: customers, staff, partners, outside systems. Each is
   `actor:<id>` with a name and a one-line summary; `uses` waits until there are systems to point at.
5. **Code.** Ask for the GitHub organisations or repos. List them (`gh repo list <org> --limit 200 --json
name,description,primaryLanguage,isArchived`), leave out archived and personal repos, and propose a first cut of
   domains and systems: a domain is a part of the business with its own language, a system is what one team runs
   for it. Read CODEOWNERS and READMEs for owners. Show the cut to the people and change it until they agree; do
   not write it before they do.
6. **Write the skeleton.** Per agreed domain, `domains/<domain>/domain.yaml` (`id`, `name`, `purpose`); per
   system, `systems/<system>/system.yaml` with `id`, `name`, `team` and `repos`, and no components yet.
7. **Check it.** `npm run workspace -- check ../<id>-groundwork`, then restart `npm run dev` (Next does not watch
   folders outside its checkout) and open `/<id>/`.
8. **Commit** in the workspace repo. Make a GitHub repo for it only when asked
   (`gh repo create <org>/<id>-groundwork --private --source ../<id>-groundwork --push`).
9. **Hand over** to [groundwork-scan](../groundwork-scan/SKILL.md) to read the repos into components, contracts and
   handlers, each fact with its sources.

## Register one that exists

Someone has cloned a workspace repo and the app does not show it:

```bash
npm run workspace -- add ../<id>-groundwork   # checks it, registers it, links the skills into it
npm run workspace -- list                     # what this checkout reads, and where
```

Then restart `npm run dev`. `add` refuses a folder without a `workspace.yaml`, and two folders with the same id;
fix the folder rather than working round it.
