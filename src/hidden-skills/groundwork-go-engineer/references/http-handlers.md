# HTTP Handlers

## Handler Framework

Handlers use typed function registration (e.g., Huma v2, Chi, or standard library). The Go types are the spec — no separate YAML to drift from production. Request types are validated before the handler runs. Error responses are serialised to RFC 9457 `application/problem+json`.

## Handler Structure

### Registration

Register every handler via a typed registration function. Pass an operation for metadata and a typed function for implementation:

```go
func RegisterEntity(api huma.API, svc service.EntityService) {
    huma.Register(api, huma.Operation{
        OperationID:   "createEntity",
        Method:        http.MethodPost,
        Path:          "/entities",
        Summary:       "Create an Entity",
        Tags:          []string{"Entities"},
        DefaultStatus: http.StatusCreated,
        Security:      []map[string][]string{{"bearerAuth": {}}},
    }, func(ctx context.Context, req *CreateEntityRequest) (*CreateEntityResponse, error) {
        // ...
    })
}
```

Each `RegisterXxx` function takes the API and the service interfaces it needs. Called once from the composition root in `internal/entrypoints/api/router.go`.

### Handler Signature

```go
func(ctx context.Context, req *InputType) (*OutputType, error)
```

- `ctx` carries request context, auth principal, and cancellation signal.
- `req` is fully validated before the function is called.
- Return `(nil, huma.NewError(...))` to abort with a specific HTTP status.
- Return `(nil, err)` for unexpected errors — framework converts to a 500.

### Request Types

Request structs compose path, query, header, and body fields with struct tags:

```go
type CreateEntityRequest struct {
    IdempotencyKey string `header:"Idempotency-Key" required:"false" format:"uuid"`
    Body           createEntityBody
}

type createEntityBody struct {
    Name  string  `json:"name" min:"1" max:"100" example:"example"`
    Email string  `json:"email" format:"email"`
    RefID *string `json:"ref_id,omitempty"`
}
```

Use a nested body type (unexported) to separate the JSON body from path/query/header fields.

### Response Types

```go
type CreateEntityResponse struct {
    Body EntityItem
}

type EntityItem struct {
    ID        string `json:"id" format:"uuid" readOnly:"true"`
    Name      string `json:"name"`
    CreatedAt string `json:"created_at" format:"date-time" readOnly:"true"`
}
```

Use `readOnly:"true"` on fields never accepted on input. Keep response types separate from request body types.

## Authentication

Extract the principal at the top of the handler:

```go
func(ctx context.Context, req *GetEntityRequest) (*GetEntityResponse, error) {
    principal, err := auth.PrincipalFromContext(ctx)
    if err != nil {
        return nil, huma.NewError(http.StatusUnauthorized, "unauthorized")
    }
    // use principal.ID(), principal.IsSystem(), etc.
}
```

Pass the principal into service calls — never access auth state from globals.

## Error Handling

Use framework helpers for expected domain errors; return unwrapped errors for unexpected failures:

```go
// Domain validation error
if err := entity.Validate(); err != nil {
    return nil, huma.NewError(http.StatusUnprocessableEntity, err.Error())
}

// Auth failure
return nil, huma.NewError(http.StatusForbidden, "insufficient permissions")

// Unexpected error — framework returns 500
saved, err := svc.Save(ctx, principal, entity)
if err != nil {
    return nil, err  // log at the service layer
}
```

Do not log errors in the handler and also return them. Log at the layer with enough context; wrap elsewhere.

## Inbound Defenses

### CORS Configuration

Configure CORS explicitly at the router level. Never use wildcard `"*"` origins in production.

```go
import "github.com/go-chi/cors"

router.Use(cors.Handler(cors.Options{
    AllowedOrigins:   []string{"https://app.example.com"}, // Loaded from config
    AllowedMethods:   []string{"GET", "POST", "PATCH", "DELETE", "OPTIONS"},
    AllowedHeaders:   []string{"Accept", "Authorization", "Content-Type", "Idempotency-Key"},
    AllowCredentials: true,
}))
```

### Idempotency Middleware

Mutating endpoints (`POST`, `PATCH`) must be idempotent. Extract the `Idempotency-Key` header and verify its state before allowing the handler to execute.

```go
func IdempotencyMiddleware(store IdempotencyStore) func(http.Handler) http.Handler {
    return func(next http.Handler) http.Handler {
        return http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
            key := r.Header.Get("Idempotency-Key")
            if key == "" && (r.Method == "POST" || r.Method == "PATCH") {
                http.Error(w, "Idempotency-Key required", http.StatusBadRequest)
                return
            }
            
            // Check store and return cached response if COMPLETED,
            // or 409 Conflict if IN_PROGRESS.
            // Otherwise, proceed.
            next.ServeHTTP(w, r)
        })
    }
}
```

## Handler Placement

- One `RegisterXxx` function per domain resource in `internal/entrypoints/api/routes/<resource>.go`
- Request/response types in the same file as the handler
- Domain conversion helpers (`toXxx`) at the bottom of the file, unexported
- Inline closures for simple handlers; named methods on a struct for handlers that share helpers
- When a handler needs more than two service calls or substantial conditional logic, move logic to the application service layer

## Operation Metadata

Every operation needs:

- `OperationID` — unique, camelCase, used as the generated client method name
- `Method` + `Path` — HTTP verb and URI template; use `{id}` placeholders
- `Summary` — one sentence, title-cased, no period
- `Tags` — group the endpoint in the OpenAPI UI
- `Security` — authentication scheme for the endpoint
- `DefaultStatus` — only for non-200 success codes (201 for creation, 204 for deletions)
