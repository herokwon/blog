# Security Architecture

## Status and Scope

Admin authentication and the security enforcement policies below are
`Planned`. Runtime bindings and CI/CD credential references are configured
in the repository; this does not verify deployed resources, registered
secrets, permissions, or production behavior. Admin authentication and
`src/hooks.server.ts` are not implemented, and deployed Cloudflare
Access policies have not been verified.

This document defines security boundaries.
[Content Domain](content-domain.md) defines Post rules,
[API Design](api-design.md) defines response contracts, and
[Deployment](deployment.md) defines deployment environments.

## Bindings and Credentials

[wrangler.jsonc](../../wrangler.jsonc) declares `DB` for D1 access and
`ASSETS` for static assets. Server-side
[getDb(d1)](../../src/lib/server/db/index.ts) receives the D1 binding and
creates the Drizzle connection; browsers do not receive database access.

Deployment workflows reference `CLOUDFLARE_API_TOKEN` and
`CLOUDFLARE_ACCOUNT_ID` from GitHub Actions secrets. These are CI/CD
settings, not credentials passed to the browser or application runtime.
GitHub automation references App private keys from Actions secrets to
generate task tokens; some jobs use `github.token` instead.

Database, account, and App identifiers are not authentication tokens.
Distinguish identifiers from authentication secrets such as API tokens
and private keys, even when both are stored in Actions secrets.

[.gitignore](../../.gitignore) excludes `.env` and `.env.*`, except
`.env.example` and `.env.test`. Trackable example and test files must
contain no real credentials. Secret values must not appear in the
repository, client bundles, API responses, or logs.

See [CI/CD operations](../operations/ci-cd.md#production-d1-migrations-and-worker-deployment)
for deployment credential registration and permission requirements.
Future Access configuration names and storage choices will be decided
before authentication implementation.

## Admin Authentication and Authorization

Cloudflare Access authenticates Admin users through GitHub.
The application verifies the Access JWT and checks the verified
identity against an email allowlist.

The initial system has one Admin role. Role and permission tables
are deferred until a concrete multi-user requirement exists.

### Protected Paths

Protect these paths on production and Version URL hostnames:

```text
/admin
/admin/*

/api/admin
/api/admin/*
```

Parent and descendant paths are explicit because Access wildcards
do not cover their parent path. Use `*`, not `**`.

The shared `requiresAdminAccess()` predicate matches `/admin` and
`/api/admin`, including descendants such as the Admin trash page.
It must not match unrelated prefixes such as `/administrator` or
`/api/admin-tools`.

Public pages and APIs remain accessible without Admin authentication.

### Server Verification

For Admin requests that reach the Worker, `src/hooks.server.ts`:

1. Validates the JWT in `Cf-Access-Jwt-Assertion`, including its
   signature, expected issuer, application audience, and validity.
2. Derives identity from verified claims.
3. Checks the identity against the Admin email allowlist.

An email header or an unverified decoded token is not proof of
authentication. Reject Admin access when identity or authorization
cannot be established.

Identity and authorization state are request-scoped, never stored
in mutable global state.

### Local Authentication

Explicitly enabled local execution may use a local-only test Admin
identity for development and write-flow validation.

Data operations under that identity use local D1 state. Production
and Version URLs must reject test identities and use Access JWT
verification and the email allowlist.

The activation mechanism and identity injection method are
implementation decisions.

## Request Enforcement

```text
Admin request
  -> Cloudflare Access, or explicitly enabled local test identity
  -> server authentication and authorization
  -> environment and request-origin checks
  -> route validation and Post rules
  -> Drizzle and D1
```

Admin UI and API use the same origin. All mutation requests require
server-side request-origin validation to prevent cross-site request
forgery.

Before implementation, verify the coverage of SvelteKit's built-in
protection and supplement it wherever necessary, including API
mutations. Define the exact validation and rejection behavior then.

Server enforcement applies to direct API requests as well as UI
actions. Browsers never access D1 directly.

### Version URLs

Version URLs share production D1 and permit read-only validation.
Admin authentication does not authorize mutations through those URLs.

After authentication and authorization, all Admin mutation requests through
Version URLs return `403 FORBIDDEN`, including
creation, editing, publishing, archiving, deletion, and restoration.
Disabling UI actions alone is insufficient.

Validate write flows and migrations locally. Worker versions do not
isolate or version database state.

## Public Post Boundary

All Public pages and APIs expose only content satisfying:

```sql
status = 'published' AND deleted_at IS NULL
```

Posts in `draft` or `archived` status and deleted content remain unavailable through
Public interfaces, even to an authenticated administrator.
Inspection uses the protected Admin boundary.

Public detail requests for missing or non-public content return
`404 POST_NOT_FOUND`. Responses expose only the Public fields
defined in API Design.

## Markdown Rendering

Milkdown provides Admin authoring; persisted content remains Markdown
source text.

Public rendering and any Markdown rendering in Admin use a common rendering
pipeline and security policy. This does not introduce a separate preview page.
Apply the same safety requirements to the Admin editor's displayed content.

- Preserve stored Markdown source.
- Do not render embedded source HTML as executable HTML.
- Allow only approved link and image URL protocols; block dangerous
  URLs such as `javascript:`.
- Apply the output sanitization required by the selected rendering
  pipeline and extensions.

Choose libraries, permitted HTML elements and attributes, URL rules,
and sanitization configuration immediately before implementation.
Document those decisions before implementing them.

## Responses and Caching

Cloudflare Access may handle authentication before a request reaches
the Worker. Its login and denial responses are outside the
application API error contract.

Admin UI authentication on production and Version URLs follows the Access
login flow; explicitly enabled local execution uses the test identity above.
Admin API requests that reach the application return JSON errors
rather than HTML login redirects:

| Condition                                 | HTTP status | Code         |
| ----------------------------------------- | ----------- | ------------ |
| Missing or invalid authentication         | 401         | UNAUTHORIZED |
| Authenticated identity not allowed        | 403         | FORBIDDEN    |
| Authorized mutation through a Version URL | 403         | FORBIDDEN    |

Use the common error shape and predefined codes in API Design.
Do not expose credentials, tokens, database details, complete input
values, or stack traces.

All application Admin page and API responses use
`Cache-Control: no-store` and are excluded from shared caches.
This includes authentication and authorization failures handled
by the application.

## Implementation Decisions

Resolve and document externally observable behavior before
implementing the corresponding feature:

- Request-origin validation, including requests with missing or
  unusable origin information and their error responses
- Markdown rendering libraries and permitted rendering rules
- Security headers, considering the renderer and external resources

JWT library selection, key retrieval, configuration names, and
local test identity activation and injection are implementation
details that must preserve the policies above.

## References

- [Cloudflare Access application paths](https://developers.cloudflare.com/cloudflare-one/access-controls/policies/app-paths/)
- [Cloudflare Access JWT validation](https://developers.cloudflare.com/cloudflare-one/access-controls/applications/http-apps/authorization-cookie/validating-json/)
