# Security

## The Posture

A Next.js app runs in two places at once, and the boundary between them is the whole security model. Server Components, Server Actions, and route handlers run on a trusted server; everything else ships to a browser the user controls. Code, props, and environment values that cross into the client are public — assume an attacker reads the bundle and replays every request. This file is the Next.js idiom of the framework security canon (`docs/principles/quality/security.md`); when this file and the canon disagree, the canon wins and this file is the one to fix.

The single discipline underneath every rule below: validate and authorize on the server, never trust the client. Client-side validation is UX; the server check is the security boundary (`references/mutations-and-forms.md` → Error Flow).

## XSS: Trust React's Escaping

React escapes every value interpolated into JSX by default — `{userValue}` cannot break out of its text node. XSS re-enters only when you opt out of that escaping.

- `dangerouslySetInnerHTML` is the named opt-out. Render it only with HTML you produced or sanitised server-side (a vetted sanitiser such as DOMPurify); never with a value that originated from a user or an API.
- A `javascript:` or `data:` URL in an `href`/`src` is script. Validate that user-supplied URLs are `https:` before rendering them.
- Untrusted JSON parsed and injected as markup is the same hole by another route — keep untrusted data as text.

```tsx
// Hostile — renders attacker markup into a privileged origin
<div dangerouslySetInnerHTML={{ __html: order.customerNote }} />

// Safe — React escapes it; the note is text, not markup
<div>{order.customerNote}</div>
```

## The Client Bundle Is Public

Every value reachable from client code is shipped to the browser. The `NEXT_PUBLIC_` prefix is the boundary: a variable with that prefix is inlined into the bundle, and a variable without it is unreadable from any `'use client'` module.

- Secrets — API keys, signing secrets, database URLs — never carry the `NEXT_PUBLIC_` prefix and are read only in server code (Server Components, Server Actions, route handlers, `lib/api.ts` on the server).
- A secret consumed by the client is a secret leaked. If a feature "needs" a key in the browser, the call belongs on the server: route it through a Server Action and keep the key server-side.
- The downward dependency graph (`references/architecture.md`) keeps this honest — schemas and the API client never import client-only code, so server secrets have no path into a client component by construction.

```ts
const apiKey = process.env.UPSTREAM_API_KEY;        // server-only — correct
const pub = process.env.NEXT_PUBLIC_ANALYTICS_ID;   // inlined into the bundle — public by design
```

## Server Action Input Validation

A Server Action is a public POST endpoint — anyone can invoke it with any payload, regardless of what the form allows. Every Server Action re-validates its input with the same Zod schema the form uses, on the server, before any work (`references/type-system.md` → Zod as the Contract).

```tsx
'use server';

export async function updateOrderAction(
  id: string,
  formData: FormData,
): Promise<ActionResult<Order>> {
  const principal = await requirePrincipal();           // 1. authenticate the caller
  const parsed = updateOrderSchema.safeParse({          // 2. validate every field
    quantity: Number(formData.get('quantity')),
    note: formData.get('note'),
  });
  if (!parsed.success) {
    return { data: null, error: parsed.error.issues[0].message };
  }
  if (!(await canEditOrder(principal, id))) {           // 3. authorize this action on this resource
    return { data: null, error: 'Not found' };          //    deny as not-found — do not confirm existence
  }
  // ... mutate, revalidatePath, return ActionResult
}
```

The order is non-negotiable: authenticate, validate, authorize, then act. A Server Action that trusts the form's own validation is unauthenticated and unvalidated.

## Auth and Sessions: httpOnly Cookies

The session token lives in an `httpOnly`, `Secure`, `SameSite` cookie set by the server — never in `localStorage` or a JS-readable cookie. A token JavaScript can read is a token an XSS payload can exfiltrate; `httpOnly` removes it from script's reach entirely.

```ts
cookies().set('session', token, {
  httpOnly: true,
  secure: true,
  sameSite: 'lax',   // lax/strict is the baseline CSRF defence for cookie auth
  path: '/',
});
```

- Authentication runs through a proven provider (OIDC); the app does not hand-roll JWT verification or session crypto. Auth is boring technology — `docs/principles/system-design/identity-and-access.md`.
- The session is read and verified on the server (Server Component / Server Action / route handler), and the proxy (`proxy.ts`) gates protected segments. A client-side `isLoggedIn` flag is UX, never a gate.

## CSRF on Mutations

Cookie-authenticated mutations need CSRF protection, because the browser attaches the session cookie to cross-site requests automatically. The first layer is `SameSite=lax`/`strict` on the session cookie, which blocks the classic cross-site form post.

- Server Actions carry framework-level protection: Next.js verifies an origin/action token, so a third-party page cannot replay one. Keep that — do not expose the same mutation as an unprotected route handler that bypasses it.
- A route handler that mutates state under cookie auth validates the `Origin` header against an allowlist (and uses a CSRF token if it cannot rely on `SameSite`). A `GET` never mutates.

## SSRF on Server Fetches

Server-side `fetch` runs from inside your network, so a fetch aimed at an input-supplied URL is an SSRF vector — an attacker points it at cloud metadata endpoints or internal services.

- The API client (`lib/api.ts`) targets a configured base URL, never a host taken from the request. Keep outbound targets constant or allowlisted.
- A feature that must fetch a user-supplied URL (a webhook, an image proxy) validates the resolved host against an allowlist and rejects non-`https:` schemes and private address ranges before the call.

## Content-Security-Policy

A strict CSP is the second line that contains an XSS that slips past escaping. Set it on responses via the proxy (`proxy.ts`) or `next.config.ts` headers.

```
default-src 'self'; script-src 'self'; object-src 'none'; base-uri 'self'; frame-ancestors 'none'
```

- `frame-ancestors 'none'` (or an allowlist) blocks clickjacking; pair it with `X-Content-Type-Options: nosniff`.
- Avoid `'unsafe-inline'` in `script-src`; use a nonce for any inline script Next.js requires. A CSP containing `*` in `script-src` is not a CSP.

## Security Review Checklist

For any PR touching Server Actions, route handlers, auth, `proxy.ts`, or `dangerouslySetInnerHTML`:

- [ ] No `dangerouslySetInnerHTML` on unsanitised or user-origin HTML
- [ ] No secret without the `NEXT_PUBLIC_` decision being deliberate; no secret read in a `'use client'` module
- [ ] Every Server Action authenticates, Zod-validates, and authorizes before acting
- [ ] Session token in an `httpOnly` `Secure` cookie — never `localStorage`
- [ ] Mutating route handlers check `Origin`; `GET` never mutates
- [ ] Server fetches target a constant/allowlisted host — no input-supplied URL unchecked
- [ ] CSP present and not weakened to `*`/`unsafe-inline` script
- [ ] Authorization decided on the server; no client flag used as a gate
