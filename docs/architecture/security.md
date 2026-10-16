# Security Architecture

## Status and Scope

Admin JWT authentication, authorization, request-origin enforcement, candidate
write rejection, and `no-store` responses are implemented locally by Task 2.
Rendering safety and Admin security headers were implemented in Task 7;
Tasks 9–10 exercise actual browsing/authoring routes under enforced CSP.
Current local evidence and outstanding deployed checks are tracked in
[v0.2.0 acceptance](../operations/v0.2.0-acceptance.md).
Runtime bindings and CI/CD credential references are configured
in the repository; this does not verify deployed resources, registered
secrets, permissions, or production behavior. Deployed Cloudflare Access
policies have not been verified. See the
[local configuration and verification scope](../operations/admin-validation.md#local-authentication-configuration).

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
Access configuration uses server-side `ACCESS_ISSUER`, `ACCESS_AUDIENCE`,
`ADMIN_EMAILS`, and `ADMIN_ORIGIN` bindings. Local `.dev.vars*` files are ignored.

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

The shared `isAdminPath()` predicate matches `/admin` and
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

Production candidates retain Production D1 and reject Admin mutations. The
v0.2.1 environment policy is `Locally implemented; remote acceptance pending`: only the separate Preview Worker's
default Worker URL permits remote testing writes, with Preview D1 as its sole DB.
See the [environment matrix](deployment.md#v021-isolated-preview).

Configure a separate Preview Access audience and the authorized Admin email
allowlist. Reuse the verified issuer/JWKS/JWT policy, not the local identity
bypass. Protect the same Admin page/API paths on the default Preview Worker URL and individual Preview
Version URLs; home/public paths remain outside the Admin Access application.
Verify actual Access hostname/path coverage before enabling remote testing.

For Preview mutations, both request URL origin and `Origin` must exactly
equal the configured HTTPS default Worker origin. No suffix matching, wildcard
origin permission, forwarded-host trust, or Production-origin substitution.
Missing, malformed, mismatched, and individual-version origins return
`403 FORBIDDEN` after normal identity checks. Production retains its exact
configured domain and read-only candidate URLs. Enforce these checks for
direct API requests as well as UI actions. Local bypass retains its existing
compile-time development, loopback, and explicit-flag requirements.

Worker versions do not isolate or version database state.

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
| Authorized mutation through a read-only Version URL             | 403         | FORBIDDEN    |
| Authorized mutation with missing, unusable, or different origin | 403         | FORBIDDEN    |

Use the common error shape and predefined codes in API Design.
Do not expose credentials, tokens, database details, complete input
values, or stack traces.

## Admin Security Headers

The following baseline is implemented and verified against the local Worker.
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

### v0.2.1 CSP Investigation

Status: `Locally implemented; deployed acceptance pending`. Built-Worker
Chromium probes identified SvelteKit's announcer inline style as the
`style-src-attr` source. Crepe's `container.style.display` updates produced no
violation; its disappearing controls were a separate reactive-render bug:
the readonly branch stopped observing the version used to rerender on unlock.
Zod's caught dynamic-compilation probe also produced a `script-src` eval event.

Version-scoped pnpm patches remove only SvelteKit 3.0.1's announcer inline
style (the existing `#svelte-announcer` stylesheet retains its hidden live
region) and keep Crepe 7.22.2's TopBar subscribed across readonly transitions.
Source and shipped ESM/CJS Crepe entries are patched. Zod uses its supported
`jitless` setting before constructing shared Admin schemas. No dependency
upgrade or CSP permission change is involved. Revalidate both package patches
against upstream changes on dependency upgrades; remove them when upstream
provides equivalent behavior. See [Tasks 3–4 evidence](../operations/v0.2.1-authoring.md#tasks-34-local-evidence-2026-10-11).

Before choosing a fix, reproduce recovery/pending locks and editor remounts
under the built Worker's enforced policy. Capture `securitypolicyviolation`
details, the offending element/action, console errors, and visibility/focus
state. Distinguish TopBar, framework announcer, and other editor/menu writes.
Verify title-to-Toolbar-to-body traversal and short/long scroll behavior in
the same actual-page tests, rather than treating a hidden editor as solved
by the modal alone.

Prefer supported integration and stylesheet/class behavior for the proven
source. Do not remove `style-src-attr 'none'`, broadly permit inline styles,
or add a general console-error ignore to hide the report. Preserve nonce
propagation, Markdown/URL/transfer guards, and existing script restrictions.
Any necessary policy exception or dependency/integration change must be
specified and reviewed before implementation. Recheck initial load, client
remount, locks, menus, and nested CodeMirror editors. Existing exact-hash
announcer handling is historical evidence, not permission to ignore new errors.

### CSP Configuration and Verification

Task 7 selected Crepe/Kit `7.22.2`; the current dependency stack uses CodeMirror view `6.43.14` and state
`6.7.6`. Admin reading uses read-only Crepe, with authoring controls disabled;
no separate HTML renderer or sanitizer is required. A Markdown AST display
projection removes source HTML except standalone, attribute-free break markers
(`br` with an optional self-closing slash) used by Crepe for empty paragraphs.
The marker must be its entire HTML block under the document, blockquote or list
item; inline markers within text, links and table cells remain unsupported.
It also removes images and footnotes and unwraps disallowed links before Crepe
parses it. This projection never replaces persisted source.
Authoring preflight allows only that structural break-marker exception, rejects
all other HTML and unsupported constructs, and preserves the complete source.
Capture-phase paste/drop checks run before library parsing/upload, followed by
a document/stored-mark transaction guard using the same URL policy.

SvelteKit CSP auto mode owns framework script hashes/nonces. Each response
gets a fresh 128-bit random style nonce; the hook inserts it into the initial
HTML's `meta[name="admin-style-nonce"]` and permits it in `style-src`.
The client freezes that document value in `src/lib/editor/nonce.ts` and passes
it to CodeMirror's `cspNonce` facet for every remount. Public HTML also carries
the matching style permission so client navigation into Admin retains a usable
initial document nonce. Framework script permissions are preserved, with no
`unsafe-inline` or `unsafe-eval` script exception. Admin adds `font-src 'self'`,
`img-src 'none'`, `object-src 'none'`, `frame-src 'none'`,
`frame-ancestors 'none'`, `base-uri 'none'` and `style-src-attr 'none'`.
The app root uses a stylesheet class and Vite asset inlining is disabled.
Crepe uses system fonts and the bundled frame theme without remote font loading.

The editor removes Crepe's trailing-paragraph normalization plugin to avoid
marking a selection-only action as an edit. It uses document-change observation,
not serialization callbacks, and returns the original Markdown until an actual
edit. CodeMirror lock state and editable DOM are explicitly reconfigured,
including code blocks initialized lazily while locked. Fixed TopBar controls
carry text names and keyboard activation; BlockEdit is disabled because fixed
controls cover the supported actions and avoid its deferred teardown callback.

These component/header selections also have actual-route local verification
from Tasks 9–10, including hydration, client navigation, floating menus, table
interactions and dynamic styles. No style exception is introduced.

Task 9 exercises protected list/detail HTML, read-only code blocks, client
navigation/remounts, and lifecycle controls with the actual local production
Worker at desktop and mobile sizes. Admin omits the favicon link because
`img-src 'none'` rejects it. Task 9 originally recorded SvelteKit's fixed
announcer inline style by its exact hash while the shared stylesheet supplied
the equivalent hidden presentation. v0.2.1 removes the offending inline style
and that test exception; browser checks now require no console errors.
No CSP permission is added.
Task 10 adds authoring controls and floating editor UI coverage. Deployed Access
verification remains release acceptance work.

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

The disposable probe used SvelteKit 2.70.3, which supports CSP auto mode and framework-generated
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
