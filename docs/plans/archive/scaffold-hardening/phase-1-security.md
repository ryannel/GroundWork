# Phase 1 — Security defaults

**Prerequisite:** Phase 0 complete (verification harness works: `./dev test generation`, `./dev test compilation`, `./dev test scaffolds`, and the generated `./dev migrate` / `./dev test integration` flow).

**Phase goal:** Eliminate the live vulnerabilities in generated output so that every freshly scaffolded service is safe-by-default. Protected HTTP endpoints must require auth, required secrets must fail-fast at startup in non-dev, CORS must be env-driven instead of wildcard, and request bodies must be validated. The guiding principle for every task is FAIL LOUD, NOT SILENT — no fail-open defaults, no silent acceptance of forged input.

**Phase acceptance gate (run from repo root after all tasks land):**

```bash
# 1. Build (no-op for these edits — see note — but house rule requires it)
npm run build

# 2. Structural generation across all option combinations
./dev test generation        # expect: PASS

# 3. Pairwise compile (go build / tsc / uv sync)
./dev test compilation       # expect: PASS

# 4. Regenerate the demo workspace WITH auth and grep the safe-by-default markers
GJSON=/Users/ryannel/Workspace/groundWork/generators.json
TMP=/Users/ryannel/Workspace/groundWork/.sandboxes/demo
rm -rf $TMP; mkdir -p $TMP/services
printf '{}' > $TMP/nx.json
printf '{"name":"demo"}' > $TMP/package.json
(cd $TMP && npx --yes nx g $GJSON:workspace-dev-cli --appName demo)
(cd $TMP && npx --yes nx g $GJSON:go-microservice --name api --auth clerk)

# Go markers (gofmt may reshuffle whitespace — match format-stable substrings only):
grep -q 'router.Use(AuthMiddleware())'                 $TMP/services/api/internal/entrypoints/api/router.go        # Task 1.1
grep -q 'AppEnv'                                        $TMP/services/api/internal/config/config.go                 # Task 1.2
! grep -q 'whsec_stub'                                  $TMP/services/api/internal/config/config.go                 # Task 1.2 (removed)
grep -q 'CORS_ALLOWED_ORIGINS'                          $TMP/services/api/internal/config/config.go                 # Task 1.3
grep -q 'minLength'                                     $TMP/services/api/internal/entrypoints/api/app_handler.go   # Task 1.4
echo "GO MARKERS OK"
```

> **Build note:** No task in this phase edits any `generator.ts`. All edits are to `*.template` (EJS) files. Nx `generateFiles` reads templates live from `src/...` at generation time, so `npm run build` does not affect template output — it is kept in the steps to satisfy the house rule but does nothing for these edits. Acceptance therefore relies on **regenerate + grep + the test harness**, not on build artifacts.

> **EJS note:** Every file under a generator's `files/` tree is processed as an EJS template, regardless of extension. Files ending in `.template` have only that suffix stripped; files like `lib/config.ts` (no `.template`) are STILL run through EJS (that is why `config.ts` already contains `<%= fileName %>`). Never write a literal `<` `%` or `%` `>` sequence into any comment in these files unless you intend it as an EJS tag.

---

### Task 1.1 — Wire the Clerk auth middleware into the router
- **Files:** `/Users/ryannel/Workspace/groundWork/src/generators/go-microservice/files/internal/entrypoints/api/router.go.template`
- **Depends on:** none
- **Goal:** Apply `AuthMiddleware()` to all routes so protected endpoints stop being public. `/health` and `/webhooks` are already allow-listed inside the middleware itself, so no per-route exception is needed here. Emit the wiring only when `auth === 'clerk'` (that is the only mode where `middleware_auth.go` exists).
- **Gating fact:** `middleware_auth.go.template` is emitted only when `auth === 'clerk'` (generator.ts deletes it otherwise, line ~209). The `Use()` call MUST be wrapped in the same `<% if (auth === 'clerk') { -%>` guard or non-clerk builds will fail to compile (undefined `AuthMiddleware`).
- **Allow-list verification (already true — do NOT re-implement):** `middleware_auth.go.template` lines 29–34 bypass auth for `/health` and `/webhooks`:
  ```go
  // src/generators/.../middleware_auth.go.template (lines 29–34)
  return http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
      // Allow bypassing auth for specific routes like /health or webhooks
      if strings.HasPrefix(r.URL.Path, "/health") || strings.HasPrefix(r.URL.Path, "/webhooks") {
          next.ServeHTTP(w, r)
          return
      }
      clerkHandler.ServeHTTP(w, r)
  })
  ```
- **Anchor (current code to find — router.go.template lines 50–59):**
  ```go
  	// Inbound Defenses
  	router.Use(LoadSheddingMiddleware(100))               // Max 100 concurrent requests
  	router.Use(TimeoutMiddleware(30 * time.Second))       // Global 30s timeout
  	router.Use(RateLimitMiddleware(cfg.Redis.URI, db))    // Rate limiter

  	// Idempotency requires a backing store (DB or Redis)
  	if db != nil {
  		idempotencyRepo := idempotency.NewPostgresRepository(db)
  		router.Use(idempotency.Middleware(idempotencyRepo))
  	}
  ```
- **Change:** Insert the auth middleware **after the Rate limiter line and before the Idempotency block** (so `X-User-ID` is set before idempotency keys the request). It MUST be added among the `router.Use(...)` calls — chi panics at runtime if `Use()` is called after any route is registered (`router.Post("/webhooks/clerk")` at line ~65 and `humachi.New(...)` at line ~78 both register routes). Replace the anchor with:
  ```go
  	// Inbound Defenses
  	router.Use(LoadSheddingMiddleware(100))               // Max 100 concurrent requests
  	router.Use(TimeoutMiddleware(30 * time.Second))       // Global 30s timeout
  	router.Use(RateLimitMiddleware(cfg.Redis.URI, db))    // Rate limiter

  <% if (auth === 'clerk') { -%>
  	// Authentication — protects all routes EXCEPT /health and /webhooks,
  	// which AuthMiddleware allow-lists internally. Must run before idempotency
  	// so the authenticated principal (X-User-ID) is set before keying requests.
  	router.Use(AuthMiddleware())
  <% } -%>

  	// Idempotency requires a backing store (DB or Redis)
  	if db != nil {
  		idempotencyRepo := idempotency.NewPostgresRepository(db)
  		router.Use(idempotency.Middleware(idempotencyRepo))
  	}
  ```
- **Acceptance:**
  ```bash
  # Regenerate WITH clerk (see gate block above for full setup) then:
  grep -q 'router.Use(AuthMiddleware())' $TMP/services/api/internal/entrypoints/api/router.go && echo "T1.1 wired"
  # Confirm it is NOT emitted without clerk:
  rm -rf $TMP/services/noauth; (cd $TMP && npx --yes nx g $GJSON:go-microservice --name noauth --auth none)
  ! grep -q 'AuthMiddleware' $TMP/services/noauth/internal/entrypoints/api/router.go && echo "T1.1 gated OK"
  ```
  Then `./dev test compilation` (expect PASS — proves both clerk and non-clerk variants build). Behavioral proof (unauthenticated request to a protected endpoint returns 401) is asserted in Task 1.7's inner system test.
- **Guardrails:** Do not edit `middleware_auth.go.template` — its allow-list is already correct. Do not add a per-route auth exception in router.go. Do not move the `Use()` call below any `router.Post`/`humachi.New` line. Do not remove the `-%>` trim markers (they keep generated whitespace clean).

---

### Task 1.2 — Remove fail-open webhook secret default; fail-fast in non-dev
- **Files:** `/Users/ryannel/Workspace/groundWork/src/generators/go-microservice/files/internal/config/config.go.template`
- **Depends on:** none
- **Goal:** `CLERK_WEBHOOK_SIGNING_SECRET` currently defaults to `"whsec_stub"`, so a service deployed without the real secret silently accepts forged webhooks. Remove the default and add startup validation that errors when required secrets are empty in non-dev (`APP_ENV != "development"`). Keep dev ergonomic: empty secret allowed in dev with a loud warning.
- **Gating fact:** The `Auth` field and `AuthConfig` struct exist only under `<% if (auth === 'clerk') %>` (lines 14–16 and 19–23). The new secret validation MUST be inside an `auth === 'clerk'` EJS guard. The `AppEnv` field is generic and stays UNGATED.
- **Import fact:** This file imports the standard library `"log"` (line 4), NOT zerolog. Use `log.Printf` / `log.Fatalf`. `log.Warn()` does not exist here and will break compilation.
- **Anchor A (current code — config.go.template lines 9–23):**
  ```go
  type Config struct {
  	Server    ServerConfig
  	Database  DatabaseConfig
  	Redis     RedisConfig
  	Telemetry TelemetryConfig
  <% if (auth === 'clerk') { %>
  	Auth      AuthConfig
  <% } %>
  }

  <% if (auth === 'clerk') { %>
  type AuthConfig struct {
  	ClerkWebhookSecret string `env:"CLERK_WEBHOOK_SIGNING_SECRET" envDefault:"whsec_stub"`
  }
  <% } %>
  ```
- **Anchor B (current code — config.go.template lines 43–49):**
  ```go
  func Load() *Config {
  	var cfg Config
  	if err := env.Parse(&cfg); err != nil {
  		log.Fatalf("failed to load configuration: %v", err)
  	}
  	return &cfg
  }
  ```
- **Change — step 1: add a generic `AppEnv` field and drop the fail-open default.** Replace Anchor A with:
  ```go
  type Config struct {
  	AppEnv    string `env:"APP_ENV" envDefault:"development"`
  	Server    ServerConfig
  	Database  DatabaseConfig
  	Redis     RedisConfig
  	Telemetry TelemetryConfig
  <% if (auth === 'clerk') { %>
  	Auth      AuthConfig
  <% } %>
  }

  <% if (auth === 'clerk') { %>
  type AuthConfig struct {
  	// No envDefault: a missing secret must fail loud in non-dev, not fall back
  	// to a stub that would accept forged webhooks.
  	ClerkWebhookSecret string `env:"CLERK_WEBHOOK_SIGNING_SECRET"`
  }
  <% } %>
  ```
- **Change — step 2: add fail-fast validation in `Load()`.** Replace Anchor B with:
  ```go
  func Load() *Config {
  	var cfg Config
  	if err := env.Parse(&cfg); err != nil {
  		log.Fatalf("failed to load configuration: %v", err)
  	}

  <% if (auth === 'clerk') { %>
  	// Required secrets must be present outside development. Fail loud, not open.
  	if cfg.Auth.ClerkWebhookSecret == "" {
  		if cfg.AppEnv == "development" {
  			log.Printf("WARNING: CLERK_WEBHOOK_SIGNING_SECRET is empty — allowed in development only. Webhook signature verification will reject all events.")
  		} else {
  			log.Fatalf("FATAL: CLERK_WEBHOOK_SIGNING_SECRET is required when APP_ENV=%q", cfg.AppEnv)
  		}
  	}
  <% } %>

  	return &cfg
  }
  ```
- **Acceptance:**
  ```bash
  # Regenerate WITH clerk then:
  ! grep -q 'whsec_stub'                  $TMP/services/api/internal/config/config.go && echo "T1.2 default removed"
  grep -q 'APP_ENV'                       $TMP/services/api/internal/config/config.go && echo "T1.2 AppEnv added"
  grep -q 'CLERK_WEBHOOK_SIGNING_SECRET is required' $TMP/services/api/internal/config/config.go && echo "T1.2 fail-fast added"
  ```
  Then `./dev test compilation` (expect PASS — proves clerk and non-clerk both build; non-clerk must NOT reference `cfg.Auth`).
- **Guardrails:** Do not remove the `<% if (auth === 'clerk') %>` guards around `Auth`/`AuthConfig` — the field only exists in clerk mode. Do not import zerolog; use stdlib `log`. Keep `APP_ENV` defaulting to `"development"` so the demo workspace and `./dev test scaffolds` (which set no `APP_ENV`) stay green. Do not change `Server`, `Database`, `Redis`, or `Telemetry` defaults.

---

### Task 1.3 — Drive CORS allowed origins from env, not wildcard
- **Files:** `/Users/ryannel/Workspace/groundWork/src/generators/go-microservice/files/internal/config/config.go.template`, `/Users/ryannel/Workspace/groundWork/src/generators/go-microservice/files/internal/entrypoints/api/router.go.template`
- **Depends on:** Task 1.2 (edits the same `config.go.template`; apply 1.2 first, then 1.3, to avoid anchor drift)
- **Goal:** Replace `AllowedOrigins: []string{"*"}` with a comma-separated env-driven list (`CORS_ALLOWED_ORIGINS`), defaulting to localhost dev origins. Wildcard origin combined with `AllowCredentials: true` is invalid per the CORS spec, so this is also a correctness fix.
- **Gating fact:** Both edits are UNGATED — `ServerConfig` and the CORS block are emitted for all auth modes.
- **Import fact:** `router.go.template` already imports `"strings"` (line 6). No new import needed.
- **Anchor A (current code — config.go.template lines 25–27):**
  ```go
  type ServerConfig struct {
  	Port int `env:"PORT" envDefault:"8080"`
  }
  ```
- **Change A:** Add a comma-separated origins field with localhost defaults:
  ```go
  type ServerConfig struct {
  	Port int `env:"PORT" envDefault:"8080"`
  	// Comma-separated list of allowed CORS origins. Defaults to local dev origins.
  	// Set explicitly in non-dev — never widen to "*" with credentials enabled.
  	CorsAllowedOrigins string `env:"CORS_ALLOWED_ORIGINS" envDefault:"http://localhost:3000,http://localhost:4000"`
  }
  ```
- **Anchor B (current code — router.go.template lines 40–48):**
  ```go
  	// CORS middleware
  	router.Use(cors.Handler(cors.Options{
  		AllowedOrigins:   []string{"*"}, // TODO: Configure via env
  		AllowedMethods:   []string{"GET", "POST", "PUT", "DELETE", "PATCH", "OPTIONS"},
  		AllowedHeaders:   []string{"Accept", "Authorization", "Content-Type", "Idempotency-Key"},
  		ExposedHeaders:   []string{"Link", "Location"},
  		AllowCredentials: true,
  		MaxAge:           300,
  	}))
  ```
- **Change B:** Read origins from config:
  ```go
  	// CORS middleware — origins come from CORS_ALLOWED_ORIGINS (comma-separated).
  	router.Use(cors.Handler(cors.Options{
  		AllowedOrigins:   strings.Split(cfg.Server.CorsAllowedOrigins, ","),
  		AllowedMethods:   []string{"GET", "POST", "PUT", "DELETE", "PATCH", "OPTIONS"},
  		AllowedHeaders:   []string{"Accept", "Authorization", "Content-Type", "Idempotency-Key"},
  		ExposedHeaders:   []string{"Link", "Location"},
  		AllowCredentials: true,
  		MaxAge:           300,
  	}))
  ```
- **Acceptance:**
  ```bash
  # Regenerate WITH clerk then:
  grep -q 'CORS_ALLOWED_ORIGINS' $TMP/services/api/internal/config/config.go && echo "T1.3 config field"
  ! grep -q '"\*"'               $TMP/services/api/internal/entrypoints/api/router.go && echo "T1.3 wildcard gone"
  grep -q 'cfg.Server.CorsAllowedOrigins' $TMP/services/api/internal/entrypoints/api/router.go && echo "T1.3 router wired"
  ```
  Then `./dev test compilation` (expect PASS).
- **Guardrails:** Keep `AllowCredentials: true` as-is. Do not touch `AllowedMethods`, `AllowedHeaders`, `ExposedHeaders`, or `MaxAge`. Do not add a new import — `strings` is already present. Keep the localhost default so the demo regen and scaffold boot tests pass without extra env.

---

### Task 1.4 — Add Huma input validation to the create-entity body
- **Files:** `/Users/ryannel/Workspace/groundWork/src/generators/go-microservice/files/internal/entrypoints/api/app_handler.go.template`
- **Depends on:** none
- **Goal:** `CreateEntityRequest.Body.Name` is an unbounded string. Add `minLength`/`maxLength` Huma validation struct tags so empty or oversized names are rejected with a 422 by Huma before the handler runs.
- **Gating fact:** UNGATED — `app_handler.go.template` is emitted for all auth modes.
- **Huma tag fact (verified):** Huma v2 validation is expressed via struct tags, confirmed by existing usage at line 28 of this file: `query:"limit" default:"20" minimum:"1" maximum:"100"`. For strings use `minLength`/`maxLength`. Do NOT add `required:"true"` to the body field — a non-pointer body field is already required in Huma v2 by default. The `required:"false"` seen on the `cursor` query param (line 29) is a query-param concept, not how body-object requiredness works.
- **Anchor (current code — app_handler.go.template lines 15–19):**
  ```go
  type CreateEntityRequest struct {
  	Body struct {
  		Name string `json:"name" doc:"Name of the entity"`
  	}
  }
  ```
- **Change:** Add length bounds (non-pointer string is already required):
  ```go
  type CreateEntityRequest struct {
  	Body struct {
  		Name string `json:"name" minLength:"1" maxLength:"255" doc:"Name of the entity"`
  	}
  }
  ```
- **Acceptance:**
  ```bash
  # Regenerate WITH clerk then:
  grep -q 'minLength' $TMP/services/api/internal/entrypoints/api/app_handler.go && echo "T1.4 minLength"
  grep -q 'maxLength' $TMP/services/api/internal/entrypoints/api/app_handler.go && echo "T1.4 maxLength"
  ```
  Then `./dev test compilation` (expect PASS — confirms the tags parse and the struct still compiles).
- **Guardrails:** Do not add `required:"true"` to the body field. Do not change the `json:"name"` key or the `doc:` text. Do not alter the handler body or `ListEntitiesRequest`.

---

### Task 1.5 — Python: env-driven CORS + bearer-token guard (replace anonymous idempotency principal)
- **Files:**
  - `/Users/ryannel/Workspace/groundWork/src/generators/python-microservice/files/src/provider/config.py.template`
  - `/Users/ryannel/Workspace/groundWork/src/generators/python-microservice/files/src/main.py.template`
  - `/Users/ryannel/Workspace/groundWork/src/generators/python-microservice/files/src/entrypoints/api/middleware.py.template`
  - `/Users/ryannel/Workspace/groundWork/src/generators/python-microservice/files/src/entrypoints/api/dependencies.py.template`
  - `/Users/ryannel/Workspace/groundWork/src/generators/python-microservice/files/src/entrypoints/api/router.py.template`
- **Depends on:** none
- **Goal:** Read CORS origins from config (`ALLOWED_ORIGINS`) instead of the hardcoded `["https://your-frontend.com"]`. Add a FastAPI bearer-token guard dependency (a clearly-marked verify hook — the Python generator has no Clerk option) and apply it to mutating routes. Replace the hardcoded `user_id = "anonymous"` in the idempotency middleware with best-effort extraction from the `Authorization` header.
- **Gating facts:**
  - The Python generator has NO `auth` option (schema: `name, rest, postgres, messaging, websockets, runpod, llm`). `config.py` and `main.py` are emitted UNCONDITIONALLY.
  - `dependencies.py` and `router.py` live under `src/entrypoints/api/`, which is deleted when `rest === false` (generator.ts line ~180). So the route-level guard is `rest`-gated automatically — no extra EJS guard needed; just edit those files normally.
  - `middleware.py` is emitted unconditionally.
- **Framework fact:** `IdempotencyMiddleware` is a Starlette `BaseHTTPMiddleware` (line 69) — it CANNOT use FastAPI `Depends`. It must read `request.headers.get("Authorization")` directly. The enforcing dependency goes at the route layer.
- **pydantic-settings fact:** pydantic-settings JSON-decodes `List[str]` env vars and will crash on a plain comma-separated string. Declare `allowed_origins` as a `str` and split it where consumed.

- **Anchor A (config.py.template lines 4–7):**
  ```python
  class Settings(BaseSettings):
      model_config = SettingsConfigDict(env_file='.env', env_file_encoding='utf-8', extra='ignore')

      server_port: int = <%= assignedPort %>
  ```
- **Change A:** Add a comma-separated `allowed_origins` string (localhost default):
  ```python
  class Settings(BaseSettings):
      model_config = SettingsConfigDict(env_file='.env', env_file_encoding='utf-8', extra='ignore')

      server_port: int = <%= assignedPort %>
      # Comma-separated CORS origins. Declared as str (not List[str]) because
      # pydantic-settings JSON-decodes list-typed env vars and rejects plain CSV.
      # Split at the consumption site. Defaults to local dev origins.
      allowed_origins: str = "http://localhost:3000,http://localhost:4000"
  ```

- **Anchor B (main.py.template lines 58–65):**
  ```python
  # 4. CORS
  app.add_middleware(
      CORSMiddleware,
      allow_origins=["https://your-frontend.com"],
      allow_credentials=True,
      allow_methods=["GET", "POST", "PUT", "DELETE"],
      allow_headers=["*"],
  )
  ```
- **Change B:** Split the configured origins:
  ```python
  # 4. CORS — origins from ALLOWED_ORIGINS (comma-separated), never "*" with credentials.
  app.add_middleware(
      CORSMiddleware,
      allow_origins=[o.strip() for o in settings.allowed_origins.split(",") if o.strip()],
      allow_credentials=True,
      allow_methods=["GET", "POST", "PUT", "DELETE"],
      allow_headers=["*"],
  )
  ```
  (`settings` is already imported in main.py at line 6.)

- **Anchor C (middleware.py.template lines 82–83):**
  ```python
          # In real life, extract user_id from auth token
          user_id = "anonymous"
  ```
- **Change C:** Best-effort principal extraction from the bearer token (middleware runs before route dependencies, so this is keying-only; enforcement is the route dependency in Change E):
  ```python
          # Best-effort principal for idempotency keying. The Authorization header
          # is validated/enforced by the route-level verify_bearer_token dependency;
          # BaseHTTPMiddleware cannot use Depends, so we derive a key here only.
          auth_header = request.headers.get("Authorization", "")
          token = auth_header[7:].strip() if auth_header.startswith("Bearer ") else ""
          user_id = token if token else "anonymous"
  ```

- **Anchor D (dependencies.py.template lines 1–2):**
  ```python
  from fastapi import Depends
  from src.core.service.example_service import ExampleService
  ```
- **Change D:** Add a clearly-marked bearer-token verify hook dependency. **Replace the 2-line anchor (lines 1–2 above) in full** with the block below. The block re-imports `Depends` alongside `HTTPException`/`status` and keeps the `ExampleService` import exactly once — do NOT keep the original two lines as well, or you will duplicate both imports:
  ```python
  from fastapi import Depends, HTTPException, status
  from fastapi.security import HTTPBearer, HTTPAuthorizationCredentials
  from src.core.service.example_service import ExampleService

  # --- Authentication guard -------------------------------------------------
  # VERIFY HOOK: this scaffold ships a structural bearer-token guard, NOT a full
  # identity provider integration. Replace verify_bearer_token's body with real
  # token verification (e.g. Clerk/JWKS validation) before production. It already
  # fails loud on a missing/empty token so protected routes are not public.
  _bearer_scheme = HTTPBearer(auto_error=True)

  def verify_bearer_token(
      credentials: HTTPAuthorizationCredentials = Depends(_bearer_scheme),
  ) -> str:
      """Return the authenticated principal (the raw token for now). Raises 401
      if absent. TODO: validate the token signature/claims with your IdP."""
      if not credentials or not credentials.credentials:
          raise HTTPException(
              status_code=status.HTTP_401_UNAUTHORIZED,
              detail="Missing or invalid Authorization bearer token.",
          )
      return credentials.credentials
  ```

- **Anchor E (router.py.template lines 12–18):**
  ```python
  @router.post("")
  async def create_example(
      request: CreateExampleRequest,
      service: ExampleService = Depends(get_example_service)
  ):
      entity = await service.create_example(name=request.name)
      return entity
  ```
- **Change E:** Apply the guard to the mutating POST route (add the import and a dependency param):
  ```python
  @router.post("")
  async def create_example(
      request: CreateExampleRequest,
      service: ExampleService = Depends(get_example_service),
      principal: str = Depends(verify_bearer_token),
  ):
      entity = await service.create_example(name=request.name)
      return entity
  ```
  And update the import at the top of router.py (line 5):
  ```python
  from src.entrypoints.api.dependencies import get_example_service, verify_bearer_token
  ```

- **Acceptance:**
  ```bash
  # Regenerate a python service into the demo workspace (rest enabled):
  rm -rf $TMP/services/pyapi
  (cd $TMP && npx --yes nx g $GJSON:python-microservice --name pyapi --rest --postgres)
  grep -q 'allowed_origins'      $TMP/services/pyapi/src/provider/config.py            && echo "T1.5 cfg origins"
  ! grep -q 'your-frontend.com'  $TMP/services/pyapi/src/main.py                       && echo "T1.5 hardcoded gone"
  grep -q 'verify_bearer_token'  $TMP/services/pyapi/src/entrypoints/api/dependencies.py && echo "T1.5 guard defined"
  grep -q 'verify_bearer_token'  $TMP/services/pyapi/src/entrypoints/api/router.py     && echo "T1.5 guard applied"
  ! grep -q 'user_id = "anonymous"$' $TMP/services/pyapi/src/entrypoints/api/middleware.py && echo "T1.5 anon principal replaced"
  ```
  Then `./dev test generation` and `./dev test compilation` (expect PASS — `uv sync` / import resolution proves `HTTPBearer` and the new symbols resolve).
- **Guardrails:** Do not add an `auth` option to the Python generator schema or `generator.ts`. Keep `allow_credentials=True`. The verify hook is intentionally a structural placeholder — keep the `VERIFY HOOK` comment so engineers know to wire a real IdP. Do not apply `verify_bearer_token` to the `/health`, `/healthz`, `/readyz` routes in main.py (they must stay public for probes). Leave the GET routes in router.py without the guard unless you also intend to protect reads — protecting only the mutating POST is the minimum and matches the idempotency-keying change.

---

### Task 1.6 — Next.js: secret-leak guard documentation for the NEXT_PUBLIC_* footgun
- **Files:**
  - `/Users/ryannel/Workspace/groundWork/src/generators/nextjs-app/files/lib/config.ts`
  - `/Users/ryannel/Workspace/groundWork/src/generators/nextjs-app/files/.env.example.template`
- **Depends on:** none
- **Goal:** Document the `NEXT_PUBLIC_*` footgun (any var prefixed `NEXT_PUBLIC_` is inlined into the client bundle and shipped to browsers) and make the server-only guarantee explicit. The `import "server-only"` line is already the build-time enforcement: importing this module from a Client Component throws at build. Keep it, and add documenting comments so no server secret is ever referenced without that guard.
- **Gating facts:**
  - `lib/config.ts` is EJS-processed (it already contains `<%= fileName %>`) and is deleted when `apiProxy === false` (generator.ts line ~211). It is NOT gated on auth. Do not write literal EJS-tag character sequences into the comments.
  - `.env.example.template` is emitted unconditionally; the Clerk key block is inside `<% if (auth === 'clerk') %>` (lines 8–19). The `NEXT_PUBLIC_` warning belongs inside that clerk block, since that is where the public/secret key pair lives.
- **Anchor A (current code — lib/config.ts lines 1–21, full file):**
  ```ts
  /**
   * Server-only configuration module.
   *
   * Centralises runtime configuration, validates required env vars,
   * and provides a typed Config object to server-side code.
   *
   * IMPORTANT: This file must NEVER be imported from Client Components.
   */

  import "server-only";

  export const config = {
    /** URL of the backend API (no trailing slash). */
    apiUrl: process.env.API_URL ?? "http://localhost:4000",

    /** OpenTelemetry service name. */
    otelServiceName: process.env.OTEL_SERVICE_NAME ?? "<%= fileName %>",

    /** Whether we're in a sandbox/dev mode without auth. */
    isSandbox: !process.env.NEXT_PUBLIC_CLERK_PUBLISHABLE_KEY,
  } as const;
  ```
- **Change A:** Expand the header comment to document the build-time guard and the footgun. Replace the opening doc-comment block (lines 1–8) with:
  ```ts
  /**
   * Server-only configuration module.
   *
   * Centralises runtime configuration, validates required env vars,
   * and provides a typed Config object to server-side code.
   *
   * BUILD-TIME GUARD: the `import "server-only"` below is the enforcement
   * mechanism — if any Client Component imports this module, the Next.js build
   * FAILS. This guarantees server secrets read here (process.env.*) never reach
   * the browser bundle.
   *
   * NEXT_PUBLIC_* FOOTGUN: any env var named with the NEXT_PUBLIC_ prefix is
   * inlined into the client bundle and shipped to every browser. NEVER give a
   * secret a NEXT_PUBLIC_ name. Only the publishable (non-secret) key below is
   * read via that prefix; the secret key (CLERK_SECRET_KEY) is read WITHOUT the
   * prefix and only from server code.
   *
   * IMPORTANT: This file must NEVER be imported from Client Components.
   */
  ```
- **Anchor B (.env.example.template lines 8–13):**
  ```
  <% if (auth === 'clerk') { %>
  # Clerk Auth (REQUIRED — get from https://dashboard.clerk.com → API Keys)
  # Use pk_test_ / sk_test_ keys for local dev
  NEXT_PUBLIC_CLERK_PUBLISHABLE_KEY=pk_test_...
  CLERK_SECRET_KEY=sk_test_...
  ```
- **Change B:** Add the footgun warning above the key pair:
  ```
  <% if (auth === 'clerk') { %>
  # Clerk Auth (REQUIRED — get from https://dashboard.clerk.com → API Keys)
  # Use pk_test_ / sk_test_ keys for local dev
  #
  # SECURITY: vars prefixed NEXT_PUBLIC_ are inlined into the browser bundle and
  # are PUBLIC. Only the publishable key may carry that prefix. CLERK_SECRET_KEY
  # has NO prefix and must stay server-side — never rename it to NEXT_PUBLIC_*.
  NEXT_PUBLIC_CLERK_PUBLISHABLE_KEY=pk_test_...
  CLERK_SECRET_KEY=sk_test_...
  ```
- **Acceptance:**
  ```bash
  # Regenerate a Next.js app WITH clerk + apiProxy into the demo workspace:
  rm -rf $TMP/services/web
  (cd $TMP && npx --yes nx g $GJSON:nextjs-app --name web --auth clerk --apiProxy)
  grep -q 'server-only'                  $TMP/services/web/lib/config.ts && echo "T1.6 server-only kept"
  grep -q 'inlined into the client bundle' $TMP/services/web/lib/config.ts && echo "T1.6 footgun documented in config"
  grep -q 'inlined into the browser bundle' $TMP/services/web/.env.example && echo "T1.6 env warning present"
  ```
  Then `./dev test generation` (expect PASS) and `./dev test compilation` (expect PASS — `tsc` confirms config.ts still type-checks; the `import "server-only"` is unchanged).
- **Guardrails:** Do NOT remove the `import "server-only";` line — it is the actual guard. Do not change `process.env.*` reads or the `config` object shape. Do not introduce any literal EJS-tag character sequence inside the comments (it would be evaluated). Keep the `<% if (auth === 'clerk') %>` boundaries in `.env.example.template` intact.

---

### Task 1.7 — Add a live unauthenticated→401 system test for the Go service
- **Files:** `/Users/ryannel/Workspace/groundWork/src/generators/system-test-runner/files/tests/system/test_system.py.template`
- **Depends on:** Task 1.1 (the behavior under test only exists once auth is wired)
- **Goal:** The inner system tests currently assert nothing about auth — the CRUD/webhook assertions are commented stubs. Add one active test proving a protected endpoint rejects unauthenticated requests (`GET /api/v1/entities` → 401), which is the behavioral proof that Task 1.1 closed the public-endpoint hole. This is achievable in-test because it asserts a rejection, not a valid Clerk session.
- **Gating fact (verified):** This template is generated UNCONDITIONALLY by the `system-test-runner` generator (`generator.ts` has no option-based deletes — it only does `generateFiles` + `formatFiles`). No EJS guard is needed.
- **Port fact (verified):** In the test topology (`docker-compose.test.yml.template`) the backing services are remapped (db→5433, redis→6380), and the application Go service is reached on host port **5430** — that is the port the file's one ACTIVE assertion already uses (`http://localhost:5430/health`, line 13). Use `http://localhost:5430` for the protected route, NOT `4000` (4000 is the dev-stack port from the commented stub and is not the test topology).
- **Anchor (current code — test_system.py.template lines 33–44, the commented webhook test):**
  ```python
  @pytest.mark.asyncio
  async def test_clerk_webhook_signature_rejection(cluster, api_client: httpx.AsyncClient):
      """
      Verifies that the Clerk webhook handler strictly enforces Svix signature verification.
      This test expects a 400 Bad Request when an invalid or missing signature is provided.
      """
      # Uncomment if using the Clerk auth template
      # url = "http://localhost:5430/webhooks/clerk"
      # payload = {"type": "user.created", "data": {"id": "user_123"}}
      # 
      # resp = await api_client.post(url, json=payload)
      # assert resp.status_code in [400, 401], "Expected webhook request to be rejected without signature"
  ```
- **Change:** Insert a new ACTIVE test immediately after that commented webhook test (after line 44, before `test_idempotency_middleware`). This test is unconditional and self-skips if the auth template is not in use (a 200 means auth is off, which is expected for `--auth none` services):
  ```python

  @pytest.mark.asyncio
  async def test_protected_endpoint_requires_auth(cluster, api_client: httpx.AsyncClient):
      """
      Safe-by-default check: a protected endpoint must reject unauthenticated
      requests. With the Clerk auth middleware wired, GET /api/v1/entities returns
      401 without an Authorization header. If the service was generated with
      --auth none there is no auth layer, so a 2xx is acceptable and we skip.
      """
      url = "http://localhost:5430/api/v1/entities"
      try:
          resp = await api_client.get(url, timeout=5.0)
      except httpx.RequestError as e:
          pytest.skip(f"Service not reachable at {url}: {e}")
          return

      if resp.status_code < 400:
          pytest.skip("Service appears to run without auth (e.g. --auth none); nothing to enforce.")
          return

      assert resp.status_code == 401, (
          f"Expected 401 for unauthenticated protected request, got {resp.status_code}"
      )
  ```
- **Acceptance:**
  ```bash
  # Structural: the new test is present in generated output.
  # (system-test-runner is generated by the workspace-dev-cli / its own generator;
  #  regenerate the demo workspace per the gate block, then:)
  find $TMP -name test_system.py -path '*system*' -exec grep -l 'test_protected_endpoint_requires_auth' {} \; | head -1 && echo "T1.7 test generated"
  # Behavioral (slow, requires Docker): runs the full boot + inner tests.
  ./dev test scaffolds   # expect: PASS — health checks green AND the new auth test passes (401) for the clerk service / skips for none
  ```
- **Guardrails:** Keep the test resilient — it must `pytest.skip` (not fail) when the service is unreachable or runs without auth, so it does not break `--auth none` scaffold boots or environments where the service is down. Do not uncomment or alter the existing stub tests. Do not assert a 2xx authed response (no real Clerk token is available in-test).

---

## Definition of done for Phase 1

- [ ] **T1.1** `router.go.template`: `router.Use(AuthMiddleware())` added among the `Use()` calls (before idempotency, after rate limiter), guarded by `<% if (auth === 'clerk') %>`. Present with `--auth clerk`, absent with `--auth none`.
- [ ] **T1.2** `config.go.template`: `whsec_stub` default removed; `AppEnv` field added (`envDefault:"development"`); `Load()` fail-fasts on empty `ClerkWebhookSecret` when `APP_ENV != "development"`, warns (stdlib `log.Printf`) in dev. Validation guarded by `auth === 'clerk'`.
- [ ] **T1.3** `config.go.template` + `router.go.template`: `CORS_ALLOWED_ORIGINS` config field with localhost default; router uses `strings.Split(cfg.Server.CorsAllowedOrigins, ",")`; no `"*"` origin remains.
- [ ] **T1.4** `app_handler.go.template`: `CreateEntityRequest.Body.Name` has `minLength:"1" maxLength:"255"` (no `required:"true"`).
- [ ] **T1.5** Python: `allowed_origins` (str) in `config.py`; `main.py` CORS split from config, `your-frontend.com` gone; `verify_bearer_token` HTTPBearer dependency in `dependencies.py`; applied to the POST route in `router.py`; `IdempotencyMiddleware` derives `user_id` from the `Authorization` header instead of hardcoded `"anonymous"`.
- [ ] **T1.6** Next.js: `import "server-only"` retained in `lib/config.ts`; NEXT_PUBLIC_* footgun documented in `config.ts` and in the clerk block of `.env.example.template`.
- [ ] **T1.7** `test_system.py.template`: active `test_protected_endpoint_requires_auth` asserting unauth `GET /api/v1/entities` → 401, skipping when unreachable or auth-less.
- [ ] **Gate:** `./dev test generation` PASS, `./dev test compilation` PASS, demo regen grep markers all print OK, and (where Docker is available) `./dev test scaffolds` PASS with the new auth test green/skipped.
- [ ] No `generator.ts` was modified (all changes are EJS `.template` / EJS-processed files); no fail-open default remains in any generated config.
