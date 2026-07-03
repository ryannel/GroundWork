# Releasing GroundWork

Part of the `groundwork-contributor` skill. Read this before cutting a version.

GroundWork versions with semver from `0.x`. Three version points must agree (decision D4 in
`docs/plans/archive/bmad-quality-uplift.md`): the npm package version, the `groundwork.version`
stamp the CLI writes into installed projects' `state.json`, and the operating contract's
`version` frontmatter (bumped only on breaking protocol changes).

## Release checklist

1. Move the `## [Unreleased]` content in `CHANGELOG.md` under a new `## [X.Y.Z] - <date>`
   heading. Prefix any entry that requires action in an existing installation with
   `[migration]` — `npx groundwork-method update` surfaces those lines to users when it
   detects a version jump. Keep each `[migration]` entry on a single line ending with its
   registry id in parens (see "Shipping a Change That Touches Installed Projects" in
   `SKILL.md`); purely additive changes that old installs don't need carry `[no-migration]`
   instead.
2. Bump `package.json` (`npm version <minor|patch> --no-git-tag-version`). Bump the operating
   contract's `version` frontmatter only if a protocol changed incompatibly, and add a
   `[migration]` changelog entry when you do.
3. Rebuild the dev bundle: `npm run build:dev-cli`. The bundle embeds the package version
   (`./dev --version`), so every version bump changes it — a stale committed bundle fails
   the freshness contract test.
4. Verify every new `migrations/index.json` entry is exercised by a fixture under
   `tests/fixtures/installs/` (add the pre-change shape if no existing fixture covers it).
5. Reproduce the build locally: `./dev ci` (the same command CI and release run — lint +
   generation + contracts + cli + compilation; contracts includes the migration-coverage
   gate and the changelog↔registry cross-check).
6. Commit, tag `vX.Y.Z`, push the tag. `.github/workflows/release.yml` verifies tag ↔
   package.json ↔ CHANGELOG agreement, runs `./dev ci`, and publishes.

## Channels (the `latest` tag, and the deferred `next`)

Every release publishes to the default `latest` dist-tag, so `npx groundwork-method` and the CLI's async update check both track it. A pre-release `next` channel is deliberately **not** cut today: at single-maintainer cadence the migrations registry plus the upgrade brief already give installs a safe lag path, so a second channel would add release surface without a consumer. If one is ever wanted, the mechanics are: publish the pre-release with `npm publish --tag next` (OIDC handles auth as for `latest`); pre-release versions carry a semver suffix (`0.15.0-rc.1`), which the CLI's `isNewerVersion` ignores by design, so a `next` build never nags a `latest` user; opt in with `npx groundwork-method@next`; and promote with `npm dist-tag add groundwork-method@0.15.0 latest`. Document the channel in this file and in `docs/host-support.md` before advertising it.

## Publishing (OIDC, no token)

The package publishes as `groundwork-method` (the bare npm name `groundwork` is held by an
unrelated package — aniftyco/groundwork). The release workflow publishes **for real** via
npm **trusted publishing (OIDC)** — no `NPM_TOKEN` secret, and provenance is attached
automatically. It relies on a trusted publisher configured for the package on npmjs.com
(org `ryannel`, repo `GroundWork`, workflow `release.yml`). One-time bootstrap (npm only
allows configuring a trusted publisher once the package exists): the package name was first
reserved with a placeholder publish (`npx --yes setup-npm-trusted-publish groundwork-method`
from an interactive `npm login`), after which OIDC handles every release. There is no
dry-run gate.
