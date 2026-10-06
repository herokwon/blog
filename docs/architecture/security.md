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

### Request Origin

Admin UI and API use the same origin. After authentication and authorization,
all Admin mutation requests, including creation, must carry a valid `Origin`
matching the application's expected scheme, host, and port. Reject missing,
unusable, or different origins with `403 FORBIDDEN` before any data change.
The policy applies to local execution and authenticated administrators as
well as direct API calls; development tools must explicitly supply the
correct origin. Read requests do not require this mutation precondition.

Before implementation, verify the coverage of SvelteKit's built-in
protection and supplement it wherever necessary to enforce this policy,
including API mutations.

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

Milkdown/Crepe is the preferred starting point for Admin authoring and
reading; persisted content remains Markdown source text. A separate
Markdown renderer or additional sanitization library is not a default
dependency. First evaluate the existing capabilities against the agreed
display and security requirements, adding external tools only for a
demonstrated gap. Document the reason and configuration when adding one.

Public rendering and any Markdown rendering in Admin share supported-content
rules and security policy, reusing a rendering pipeline where appropriate.
This does not introduce a separate preview page or require the future Public
site to initialize the Admin editor runtime.
Apply the same safety requirements to the Admin editor's displayed content.
The protected Admin detail page renders persisted Markdown under this policy.

- Preserve stored Markdown source.
- Do not render embedded source HTML as executable HTML.
- Enforce the link policy below. Images, videos, and embeds are excluded
  from the v0.2.0 authoring scope defined in Content Domain.
- Apply the output sanitization required by the selected rendering
  pipeline and extensions.

### Link URLs

Allow links using `https:`, `http:`, or `mailto:`, site-internal paths
starting with a single `/`, and document fragments starting with `#`.
Reject protocol-relative external URLs such as `//example.com`; authors
must specify `https:` or `http:`. All other schemes or address forms,
including `javascript:`, `data:`, and `file:`, are disallowed.

The editor rejects applying a disallowed link and explains why. Existing
Markdown containing one must not render it as a clickable link. Preserve
stored source; apply validation during authoring and rendering rather than
silently rewriting persisted content. URL parsing and normalization must
not permit bypasses of this allowlist.

Choose libraries, permitted HTML elements and attributes,
and sanitization configuration immediately before implementation.
Document those decisions before implementing them.

### Markdown and Editor Feasibility Review

A disposable 2026-10-06 Chromium probe used Crepe 7.22.2 and CodeMirror
view 6.43.13 in a production Vite bundle. It verified the fixed top toolbar,
tables, task lists, code-block initialization, Markdown serialization,
unknown-language/code-text retention, and outer-editor locking/unlocking.
Crepe exposes `create`, `destroy`, `getMarkdown`, `setReadonly`, `on`, and
the underlying editor for plugins. Serialization normalized bullet and
horizontal-rule markers, table spacing, and trailing newlines; it is not
byte-for-byte preservation. The [editor integration contract](content-domain.md#editor-integration)
therefore preserves an unedited body rather than rewriting it on load.

With ImageBlock disabled, the remaining schema still contained image,
HTML, and footnote nodes, and an image disappeared during serialization.
A minimal transaction-filter probe rejected excluded content and retained
the prior document. This establishes an extension mechanism, not a complete
production guard. Full toolbar, nested code editor, paste/drop, and mobile
behavior still require integration checks.

On 2026-10-06, a disposable Node/Chromium probe tested a candidate pipeline:
`unified` 11.0.5, `remark-parse` 11.0.0, `remark-gfm` 4.0.1,
`remark-rehype` 11.1.2, `rehype-sanitize` 6.0.0, and
`rehype-stringify` 10.0.1. These are reviewed candidates, not installed
product dependencies or a completed production security audit.
The reviewed pipeline remains a fallback option if a separate renderer
becomes necessary; its feasibility does not select it for v0.2.0.

The candidate parses Markdown/GFM, converts to HTML AST without
`allowDangerousHtml`, applies the application link policy, sanitizes, and serializes
HTML. Do not enable `rehype-raw`. The probe rendered tables, strikethrough,
and disabled task checkboxes while excluding executable source HTML and
JavaScript URLs. Default sanitization still allowed images and
protocol-relative links; a restricted tag schema and additional link check
removed them while preserving allowed HTTPS, internal, fragment, and mailto
links. Use one application URL policy for editor actions, pasted content,
and rendered links; built-in library sanitizers do not provide the complete
application policy or the required rejection explanation.

For that candidate pipeline, the reviewed HTML tag allowlist is `h1`–`h6`, `p`, `br`, `strong`, `em`,
`del`, `blockquote`, `hr`, `ul`, `ol`, `li`, `a`, `pre`, `code`, `table`,
`thead`, `tbody`, `tr`, `th`, `td`, and `input`. Start from the sanitizer's
safe attribute rules and narrow them to generated output: permitted link
`href`/`title`, ordered-list `start`, table alignment, and task-checkbox
type/checked/disabled and list classes. Permit only disabled checkbox inputs.
Exclude source-controlled styles, event handlers, arbitrary IDs/classes,
images, media, frames, and embedded objects. If read-view syntax highlighting
is added, document its generated span/class allowlist and sanitizer ordering
before enabling it; it was not tested by this probe.

Preflight Markdown AST checks detected images, source HTML, and footnotes
before entering Crepe. Raw source remains persisted unchanged by rendering.
Production URL normalization, reference links, HTML paste, image/file drops,
and malformed-input bypass cases still require explicit acceptance tests.

Primary references: [Crepe feature configuration](https://milkdown.dev/docs/api/crepe),
[Crepe builder APIs and presets](https://github.com/Milkdown/milkdown/blob/main/packages/crepe/src/core/builder.ts),
[remark-rehype](https://github.com/remarkjs/remark-rehype),
[remark-gfm](https://github.com/remarkjs/remark-gfm), and
[rehype-sanitize](https://github.com/rehypejs/rehype-sanitize).

## Responses and Caching

Cloudflare Access may handle authentication before a request reaches
the Worker. Its login and denial responses are outside the
application API error contract.

Admin UI authentication on production and Version URLs follows the Access
login flow; explicitly enabled local execution uses the test identity above.
Admin API requests that reach the application return JSON errors
rather than HTML login redirects:

| Condition                                                       | HTTP status | Code         |
| --------------------------------------------------------------- | ----------- | ------------ |
| Missing or invalid authentication                               | 401         | UNAUTHORIZED |
| Authenticated identity not allowed                              | 403         | FORBIDDEN    |
| Authorized mutation through a Version URL                       | 403         | FORBIDDEN    |
| Authorized mutation with missing, unusable, or different origin | 403         | FORBIDDEN    |

Use the common error shape and predefined codes in API Design.
Do not expose credentials, tokens, database details, complete input
values, or stack traces.

## Admin Security Headers

The following baseline is accepted and remains `Planned` for implementation.
It adapts the [OWASP HTTP Security Response Headers Cheat Sheet](https://cheatsheetseries.owasp.org/cheatsheets/HTTP_Headers_Cheat_Sheet.html)
to the Admin scope; it does not imply that deployed responses have been verified.

| Header                    | Policy                                                                                                                                                                                                  |
| ------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `Content-Security-Policy` | Same-origin resource loading by default, with explicit approval for required framework resources; block unapproved script execution, frame loading, framing of Admin pages, and object/embed execution. |
| `X-Content-Type-Options`  | `nosniff`; responses must also declare the correct `Content-Type`.                                                                                                                                      |
| `Referrer-Policy`         | `strict-origin-when-cross-origin`.                                                                                                                                                                      |
| `X-Frame-Options`         | `DENY` on Admin HTML pages.                                                                                                                                                                             |
| `Cache-Control`           | `no-store` on all application Admin page and API responses, including application-handled authentication and authorization failures; exclude these responses from shared caches.                        |

Application response headers do not configure Cloudflare Access login or
denial responses handled before the Worker. `no-store` governs HTTP caching;
browser persistence of new-post input follows the
[input recovery contract](content-domain.md#browser-input-recovery).

### CSP Configuration and Verification

A production-bundle Chromium probe with Crepe 7.22.2 demonstrated that
`style-src 'self'` blocks CodeMirror's generated style element. Passing
the response's permitted style nonce through CodeMirror's
`EditorView.cspNonce.of(nonce)` in Crepe's CodeMirror `extensions` removed
that violation. The tested initialization used `script-src 'self'`,
`style-src 'self' 'nonce-<probe-value>'`, `style-src-attr 'none'`,
`font-src 'self'`, `img-src 'none'`, `object-src 'none'`, `frame-src 'none'`,
`frame-ancestors 'none'`, and `base-uri 'none'`. Vite's asset inlining was
disabled so bundled fonts were same-origin files rather than data URLs.
The fixed nonce was solely a disposable-probe value; production must use
an unpredictable per-response nonce and no inline-script/eval exemption.

Installed SvelteKit 2.70.3 supports CSP auto mode and framework-generated
nonces/hashes. Product integration must ensure that the initial HTML nonce,
the style permission in its response header, and every mounted CodeMirror
instance agree, including client navigation and remounts. Framework-generated
nonce handling must not be assumed to authorize third-party injected styles.
The current app template's inline `display: contents` style must be moved
to a stylesheet class if retaining `style-src-attr 'none'`. Do not combine
a nonce-bearing app template with prerendering; account for future Public
prerendering separately. Only initialization was CSP-tested: floating menus,
link editing, table resizing, nested editors, and full SvelteKit/Cloudflare
responses still need integration verification before policy completion.

Primary references: [CodeMirror nonce support](https://github.com/codemirror/view/blob/main/src/editorview.ts)
and [SvelteKit CSP configuration](https://svelte.dev/docs/kit/@sveltejs-kit-vite#csp).

Before implementation, select and document exact CSP directives and any
necessary exceptions against the installed SvelteKit, Crepe, and CodeMirror
versions. Verify editor initialization, formatting, code highlighting, and
floating UI with the enforced policy. Allow only justified exceptions;
policy acceptance does not establish library compatibility.

Distinguish blocking frames inside Admin (`frame-src`) from blocking Admin
inside another page (`frame-ancestors`); disallow both and object loading
(`object-src`). CSP supplements Markdown validation and rendering safety.
See [MDN's CSP reference](https://developer.mozilla.org/en-US/docs/Web/HTTP/Reference/Headers/Content-Security-Policy)
for directive semantics and script approval mechanisms.

## Implementation Decisions

Resolve and document externally observable behavior before
implementing the corresponding feature:

- Markdown rendering libraries and permitted rendering rules
- Exact CSP configuration and verified compatibility under the accepted
  [Admin header baseline](#admin-security-headers)

JWT library selection, key retrieval, configuration names, and
local test identity activation and injection are implementation
details that must preserve the policies above.

## References

- [Cloudflare Access application paths](https://developers.cloudflare.com/cloudflare-one/access-controls/policies/app-paths/)
- [Cloudflare Access JWT validation](https://developers.cloudflare.com/cloudflare-one/access-controls/applications/http-apps/authorization-cookie/validating-json/)
- [OWASP HTTP Security Response Headers Cheat Sheet](https://cheatsheetseries.owasp.org/cheatsheets/HTTP_Headers_Cheat_Sheet.html)
- [MDN Content-Security-Policy reference](https://developer.mozilla.org/en-US/docs/Web/HTTP/Reference/Headers/Content-Security-Policy)
