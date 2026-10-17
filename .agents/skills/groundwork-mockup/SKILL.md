---
name: groundwork-mockup
description: Capture what people see in Groundwork and build a plan's walking mockup. Use when a plan or the system model touches what people see (pages, admin tools, emails, pushes, printed documents) and someone asks to add screenshots or wireframes, link Figma designs, mark which part of a page changes, show the before and after of a screen, or make a clickable mockup the room can walk through. Writes screens in the model, `screen:` on flow steps, the new look as ops in the plan, and plans/<plan>/mockups/walking.html.
---

# Screens, UI journeys and the walking mockup

Flows tell the system's story; screens tell the person's. The app shows what people see today, a strip of the
screens each flow crosses, the screens a plan changes (today's picture beside the new one, regions outlined by
status, the Figma link, the mockup) and a screens catalogue in the reference chapter. All of it is derived from
`screens`, `screen:` on steps, and ops on `scr:` ids. Rules: [groundwork-schema](../groundwork-schema/SKILL.md)
rule 14 and [cookbook](../groundwork-schema/cookbook.md) §15.

## Today's screens go in the model

First read [granular journeys](journey-granularity.md). Map each starting screen and control, each interaction,
the backend work and the visible result before arranging pictures. This applies even to a journey that stays on
one page; a gallery of screens is not a substitute for the flow.

1. **Which screens.** Walk every flow the feature touches and ask, at each step a person drives: what are they
   looking at? One screen per page, modal, sheet, email, push or print, in the `screens:` of the system whose
   component serves it (its `contracts.yaml`). Internal tools count. An explorer finds routes and templates
   ([groundwork-explore](../groundwork-explore/SKILL.md)); the picture and the regions come from people.
2. **Today's picture.** A real screenshot or design export in `<workspace>/assets/` (`png`, `jpg`, `gif`,
   `webp`, `svg` or `html`; no data URIs, no `..`, no URLs), named after the screen: `<screen-slug>.png`. Take it
   in the browser or export it from Figma. If none exists yet, write the entry anyway (the validator warns and the
   app shows a placeholder) and leave a TODO for the driver.
3. **Regions.** Only the parts a plan talks about: a box in percent of the picture (`at`), what the person sees
   there (`shows`, present tense, their words), and the records or fields behind it (`reads`). Three to six per
   screen. Check the outlines sit on the picture in the app.
4. **Steps point at screens.** On the flow step where the person acts or sees the result, set
   `screen: scr:x#region` (or `scr:x`). The screen's component must be the step's `from` or `to`. A step that only
   shows a result is `from: <component>`, `to: <UI component>`, `via: internal`.
5. **Sources.** The screen cites the page component, route table or template, like any extracted fact, and
   carries an `origin`.

## The new look goes in the plan, as ops

On the change that alters the screen, never in the model:

- `modify: scr:x set: { image: assets/x-tobe.png, figma: <link>, mockup: mockups/walking.html }`: the new
  picture (in `plans/<plan>/assets/`), the design and the mockup entry point. Set `mockup:` on every screen the
  walking mockup contains, so each changed screen offers the mockup and lands on its own section.
- `add: region into: scr:x` for what is new; `modify: "scr:x#r" set: { shows, at, reads }` or
  `drop: { reads: […] }` for what changes; `remove: "scr:x#r"` for what goes.
- `add: screen` for a new sheet, push, email or page, with its regions in the value and `screen:` on the added
  steps that show it.
- The UI actions behind it are handlers (`on: ui:…`); a new action gets `add: handler`, a changed one an op on its
  `h:` id.
- Say what the change is for in its `why`; a decision that chose the design goes in `changes[].decisions`.

Before and after are derived: the app pairs today's picture with the new one and colours regions added, modified
or removed.

## The walking mockup

`<workspace>/plans/<plan>/mockups/walking.html` is one static page: a section per new screen
(`<section data-screen="scr:…" id="scr:…">`), the new picture inside it, each region a hotspot linking to the
screen the journey goes to next. The app serves it at `/<ws>/plans/<plan>/mockups/walking.html` and opens it at
`#scr:…`.

Plan Atlas scaffolded it with `tools/mockup.mjs`; Groundwork has no scaffold yet (TODO), so write it by hand,
starting from an existing `walking.html`:

- Follow each new flow's step order: a region that is the last on its screen links to the next screen of the
  journey. Chain journeys: when one ends on a screen and another starts from something on it, link them, so cart
  → checkout → email → tracking walks as one path.
- A header link back to the plan, and on each section a link to its own stop in the plan.
- Realistic copy on the picture itself; the hotspot caption names the action ("Place order →").
- The branch the plan cares about: the failure path from `fails`, the empty state, the "no answer" default. One
  extra section per branch, linked from the region that forks.
- One file, no framework, no build. Images are relative (`../assets/x-tobe.png`). Never real customer data.

Links that follow step order are not proof of a transition. Check them against
[granular journeys](journey-granularity.md) and keep missing-transition questions rather than inventing a
plausible next click.

## Check

`npm run workspace -- check <workspace>`, then under `npm run dev` open what people see today, a flow with its journey strip, and the screens
that change in the plan. A screen is done when the picture is a file, every region box sits on the thing it names,
the steps that show it carry `screen:`, the changed screen has a new picture or a Figma link, and the mockup walks
the main journey end to end from its first screen.
