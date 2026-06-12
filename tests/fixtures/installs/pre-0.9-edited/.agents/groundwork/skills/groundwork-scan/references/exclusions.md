# Exclusions & File Priority

Governs what the scan reads and what it skips, at every depth. The goal is to read what carries meaning and never burn context on generated, vendored, or binary noise.

## Always Exclude

Never read these — they are dependencies, build output, or noise, not the project's own code:

- `node_modules/`, `vendor/`, `.venv/`, `venv/`, `target/`, `.git/`
- `dist/`, `build/`, `out/`, `.next/`, `.nuxt/`, `coverage/`
- Minified and sourcemap files: `*.min.js`, `*.min.css`, `*.map`
- Lockfiles — confirm a stack from them, never read their contents: `package-lock.json`, `pnpm-lock.yaml`, `yarn.lock`, `go.sum`, `poetry.lock`, `Cargo.lock`, `uv.lock`
- Binary and media: images, fonts, audio, video, archives, compiled binaries
- Generated code clearly marked as such (a `// Code generated ... DO NOT EDIT` header, `*.pb.go`, `*_gen.go`)

## Contract-Bearing Priority (read first, at every depth)

These files carry the most architectural signal per byte. Read them first in every partition, even at Quick depth, because the architecture extract phase depends on them:

- **API contracts** — OpenAPI/Swagger (`openapi.{yaml,json}`, `swagger.{yaml,json}`), AsyncAPI, Protobuf (`*.proto`), GraphQL SDL (`*.graphql`, `schema.gql`)
- **Data schema** — DB migrations (`migrations/`, `*.sql`), ORM models (`schema.prisma`, `models.py`, `entity.ts`), seed files
- **Routes & handlers** — route registration, controllers, resolvers, command definitions — the public surface
- **Manifests** — `package.json`, `go.mod`, `pyproject.toml`, `Cargo.toml`, `requirements.txt`
- **Infrastructure** — `docker-compose*.{yml,yaml}`, Dockerfiles, `*.tf`, `k8s/` and `helm/` manifests, CI workflows (`.github/workflows/`)
- **Config & env** — `*.env.example`, config files that declare ports, dependencies, and feature flags

## Depth Behaviour

- **Quick** — the contract-bearing priority files, the README, and top-level config only. No deep source reading.
- **Deep** — Quick plus every file in the critical directories for the project type (the source roots, the route/handler layers, the model layers). Skim test fixtures and generated assets.
- **Exhaustive** — every file except the Always Exclude set.

## Critical Directories by Project Type

Stay generic — these are structural heuristics, never product-domain assumptions:

- **Go service** — `cmd/`, `internal/`, `pkg/`, `api/`, `migrations/`
- **Python service** — the package root, `app/`, `api/`, `models/`, `alembic/` or `migrations/`
- **Next.js / React app** — `app/`, `pages/`, `components/`, `lib/`, `src/`, the Tailwind/theme config
- **Node service** — `src/`, `routes/`, `controllers/`, `models/`
- **CLI** — the command tree, the entry binary, the config layer
- **Library** — the public entry module and its exported surface

When the project type is unrecognised, fall back to reading the manifest, the entry point, and any directory the structural map flags as high-centrality.
