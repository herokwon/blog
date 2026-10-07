# Admin validation

## Status and Scope

The full v0.2.0 acceptance suite remains `Planned`. Task 2's local authentication
and request-boundary verification is recorded below; deployment checks remain
incomplete. The release scope is
defined in [Architecture Overview](../architecture/overview.md#v020-delivery-scope).
Public APIs and UI are deferred and are not part of this verification.

Use the authoritative [Content Domain](../architecture/content-domain.md),
[API Design](../architecture/api-design.md),
[Database Foundation](../architecture/database-foundation.md), and
[Security](../architecture/security.md) contracts when selecting cases.
Track implementation and verification evidence in Issues and PRs.

## Task 5 Local HTTP Verification

`pnpm exec playwright test src/routes/admin/admin-api.e2e.ts` builds the
production Worker and creates a Wrangler `--dry-run` bundle without deploying.
The fixture in `tests/admin/local-d1.ts` runs that bundle in Miniflare using
the same version already selected by Wrangler, an isolated test-only D1 ID,
and a fresh persistence directory under `.wrangler/admin-api-tests` per worker.
It applies the checked-in local migrations, resets only its own `posts` table
between tests, and removes its scoped directory after disposal or setup failure.
It never configures remote bindings or uses the production database ID.

Requests use an exact loopback HTTP origin and freshly signed RS256 JWTs.
Only the external Access JWKS fetch is substituted; the production signature,
claims and email authorization code executes unchanged. Other outbound requests
are refused. Candidate mutation rejection is simulated inside this local Worker
with a candidate URL; no network request or database write reaches a real candidate.
The separate production preview tests retain anonymous authentication coverage.

Evidence covers all nine operations, direct response shapes and empty `204`,
strict body/ID/query validation, raw omitted-field preservation, no-op and stale
revision rules, normal/trash scopes and shrinking pages, tied ordering, atomic
failed publication, real D1 slug collision errors, and competing save/delete/
restore/publication requests. Rejected writes retain the persisted row.
Admin API endpoints use `trailingSlash = 'ignore'` so the hook can authenticate
and reject untrusted writes before emitting an uncached `308` canonical redirect.
UI routes, CSP, deployed Access policies and remote migration remain later work.

## Task 6 Client Mutation Verification

`pnpm run test:unit --run src/lib/admin/mutations.spec.ts` runs the real
controller against controlled fetch responses and deterministic timers. It covers
confirmed creation and lifecycle methods, empty DELETE, strict response/error
classification, immutable original input/revision, one jittered existing-post
retry on network/timeout/502/503/504, and no retry or automatic inspection for
creation, ordinary revision conflicts or 500.

Lost-response tests compare a deleted-inclusive detail read with submitted save
fields or lifecycle targets. Matches return `observed`, never `confirmed`;
different/invalid/failed reads retain an unresolved result, request and known ID.
The 30-second deadline covers response headers and body consumption and bounds
all three possible requests. This is controller evidence; actual UI locking,
notifications, manual retries and preservation of newer unsaved input remain
Tasks 9–10. No external API writes are part of these tests.

## Required Application Checks

| Area             | Required evidence                                                                                                                                                                                      |
| ---------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------ |
| Post management  | Creation, saving, editing, publication, archiving, soft deletion, trash, restoration, status filtering, and pagination work according to the agreed contracts.                                         |
| Failure handling | Manual list inspection for uncertain creation, concurrent requests, revision conflicts, no-op exceptions, existing-post retries and lost-response recovery, and input preservation are verified.       |
| Editor           | Supported text formatting, language selection and syntax highlighting, plain-text language fallback, publication gating, unsaved-navigation confirmation, and deletion/restoration confirmations work. |
| Security         | Authentication, authorization, origin enforcement, unsafe-link and executable-HTML prevention, and Admin `no-store` responses are verified through both UI and direct API requests.                    |
| Database         | Local migrations create the agreed schema and constraints; post mutations are atomic, while failed or rejected mutations leave data unchanged.                                                         |

Verify the protected [Admin detail page](../architecture/content-domain.md#admin-detail),
its persisted-content rendering, and the agreed post-mutation navigation,
including editor locking while saving or creating/publishing a new post,
through automatic retries and outcome-recovery reads. Verify that failure
or an unconfirmed outcome unlocks the editor without losing input, and
that duplicate mutation actions cannot be submitted while pending.

Verify that editor revision conflicts retain input and unlock editing.
Latest-post inspection opens Admin detail in a new tab; loading latest
content occurs in the original tab only after discard confirmation and
replaces title, body, and revision together. Canceling confirmation or a
failed fetch preserves input and the base revision. Verify no automatic
merge, force overwrite, or revision-only refresh and resubmission.
Lifecycle conflicts refresh state and available actions without
automatically repeating the action or discarding unsaved input.

Verify direct numbered-page navigation in normal and trash lists, default
and invalid page/limit parameters, matching item and total-count scopes,
stable ordering when timestamps tie, status-filter reset to page 1, empty
states, and changes to page contents and totals after mutations.
Verify fixed groups of five page numbers, group transitions between pages
5/6 and 10/11, and a final partial group aligned from the left without
backfilling earlier pages, ellipses, or extra first/last buttons. Previous
and next move one page and are disabled at the corresponding list boundary.
Include deletion of the last item on the last normal-list page and
restoration of the last item on the last trash page: refetch the new last
page when it exists, preserve the filter and limit, and reset to the
page-1 empty state when the entire scope becomes empty. Verify that a
mutation which leaves the current page valid retains that page.

Verify localStorage input recovery for new posts after refresh and reopening, explicit
recover/discard selection without automatic application, recovered input
remaining unsaved. Verify that
discarding a recovery copy does not mutate server content, and that confirmed
creation success clears the submitted recovery copy, including when the
subsequent publish fails. Failed or unconfirmed creation
must preserve the recovery copy.
Verify the seven-day expiry boundary measured from the last input edit,
extension on new edits only, exclusion and removal of expired copies,
and deletion of all site Admin input recovery copies on explicit logout.
Reopening the browser must retain unexpired copies when browser storage
remains available.
Verify that uncertain creation preserves browser input, offers manual list
inspection, and triggers no automatic creation retry or submission after
restoring input. Input-copy expiry does not establish whether creation
succeeded. Creation uses no request-key header, request-record table, or
persistent request snapshot. A confirmed created draft can be opened from
the list instead of creating it again.
Verify the simplified recovery scope: one new-post copy per browser and
site, with no persistent input recovery for existing-post editing and no
IndexedDB dependency for input recovery. Reopening an existing post loads
saved server content; revision preconditions still protect mutations.
Verify that unchanged input does not trigger writes and that debounced
serialization and localStorage writes do not cause unacceptable input
delay with representative long posts on desktop and mobile.
Verify that unavailable localStorage or a failed recovery write shows a
single concise notice without blocking authoring or server saving, repeated
alerts, or fallback storage.
Independent new-post copies across tabs and editing during pending requests
are outside v0.2.0.

Verify that persisted Markdown containing unsupported authoring constructs
blocks body editing and saving with a reason, preserves its original source,
and cannot be silently rewritten through an editor round trip. Cover mixed
supported and unsupported content, retained list/detail access and permitted
lifecycle actions, and unsupported code-block languages using plain-text
fallback without triggering the unsupported-construct block.

Verify the full Admin flow at desktop and mobile viewport sizes, including
the agreed [Admin layout](../architecture/content-domain.md#admin-layout),
the 1024px desktop maximum content width, table-to-card adaptation, and
preserved action grouping and availability. Exact mockup styling and gaps
are provisional and are not pixel-matching acceptance criteria. Include
touch interaction, Crepe formatting controls, tables, code blocks and language
selection, action accessibility, and confirmation dialogs. Mobile support
remains `Planned` until verified; record browser/device coverage and limitations.

Use unit or integration checks for contracts, state transitions, persistence,
and failure classification, and browser checks for user flows and editor
behavior. Include concurrent and lost-response scenarios; happy-path checks
alone do not establish retry or conflict safety. Test writes and migrations
only against local D1 during development and candidate validation.

The disposable 2026-10-06 Markdown/Crepe probe establishes feasibility only;
see the [technical review](../architecture/security.md#markdown-and-editor-feasibility-review).
Product checks must cover supported-document round trips without rewriting
an unedited body, unsupported-content preflight and paste/drop rejection,
URL-policy bypass cases, and disabled nested code editors while pending.
Verify response nonce propagation through SvelteKit hydration/navigation,
CodeMirror remounts, floating menus, and table interactions under enforced
CSP. Confirm that bundled fonts remain same-origin and no source HTML,
disallowed URL, image, or executable code preview is activated.
First verify the Milkdown-based Admin reading view with authoring controls
removed and stored source preserved. If external rendering or sanitization
tools are required, document the demonstrated gap and selected configuration
before adding them; the fallback pipeline probe does not mandate dependencies.

Run the relevant repository checks (`pnpm check`, `pnpm lint`, unit tests,
E2E tests, and the production build) as required by the implementation scope
and existing CI. Document test setup and evidence on the corresponding PR.

## Local Authentication Configuration

Task 2 uses `jose` to verify RS256 Access JWTs against the team's HTTPS
`/cdn-cgi/access/certs` endpoint. Signature, issuer, audience, expiry, and
required identity claims are verified before checking the email allowlist.
The email header is never trusted. Only public verification keys are cached;
identity is assigned to `event.locals.admin` per request.
See [Cloudflare JWT validation](https://developers.cloudflare.com/cloudflare-one/access-controls/applications/http-apps/authorization-cookie/validating-json/)
and [jose runtime support](https://github.com/panva/jose).

For deployed Workers, configure these server-side bindings through the existing
deployment configuration/secrets process:

| Binding           | Value                                                          |
| ----------------- | -------------------------------------------------------------- |
| `ACCESS_ISSUER`   | Team origin, e.g. `https://your-team.cloudflareaccess.com`     |
| `ACCESS_AUDIENCE` | Access application's audience                                  |
| `ADMIN_EMAILS`    | Comma-separated allowed emails; comparison is case-insensitive |
| `ADMIN_ORIGIN`    | Exact production origin, including scheme and non-default port |

The issuer must be a Cloudflare Access HTTPS origin without a trailing slash.
Missing or unsafe authentication configuration fails closed. Set the production
origin on candidates as well: only requests on that origin may mutate data;
all other deployed hosts, including Version URLs, remain read-only. Authentication
and authorization happen before mutation rejection. Every mutation also requires
an exact matching `Origin` header, including direct API requests.

For local development, create an ignored `.dev.vars` containing only:

```dotenv
ADMIN_LOCAL_AUTH=true
```

Run `pnpm dev` on `localhost`, `127.0.0.1`, or `[::1]`. The bypass additionally
requires SvelteKit's development runtime, and returns the fixed identity
`local-admin@example.invalid`. It cannot activate in a production bundle,
including `pnpm preview`, even if the flag or a loopback host is present.
Development must use the local D1 binding; do not configure a remote development
binding. Local mutation clients must supply their exact development origin.
`.env*` and `.dev.vars*` are ignored before local files are created; never put
real credentials or identities in trackable examples/test files.

Task 2 verification covers actual asymmetric JWT verification, request path
matching, request-scoped identity, Origin enforcement, candidate write rejection,
JSON errors, and `no-store` on successful/error/redirect responses. CSP and other
Admin security headers are integrated and validated in Task 7. Deployed Access
policies and exact-candidate behavior still require the deployment checks below.

SvelteKit's built-in form CSRF check runs before `handle` in production. To keep
authentication before mutation rejection for every content type, the configuration
delegates Origin enforcement to the hook (`csrf.trustedOrigins: ['*']`). This does
not authorize cross-origin Admin writes: the hook enforces the exact trusted origin
after authentication. For Public form requests, the hook retains SvelteKit's
production same-origin policy, including its binary form content type. Local
production HTTP tests cover both boundaries and encoded Admin paths.

## Deployment Checks

Follow [CI/CD operations](ci-cd.md) for candidate identity, promotion,
production migrations, deployment, and recovery; this document does not
change the release workflow or authorize extra production writes.

- Before promotion, validate local migrations and the complete read, write,
  and failure-recovery flows. On the exact candidate Version URL, verify
  authentication, authorization, and server-enforced mutation rejection.
- After production migration and release deployment, verify post reads on
  that candidate Version URL and actual production authentication and Admin
  access. Workflow success alone does not establish application correctness;
  record observed results and any limitations.
- Candidate Version URLs share production D1. Authenticated post reads
  require the candidate's schema to exist in that database. A missing
  schema is a validation prerequisite failure, not a passing read check.

For the first content-schema release, this sequence accounts for production
migrations running during promotion, after candidate upload. Do not apply
development migrations or write test posts against production D1 merely to
enable pre-promotion reads. Record candidate post-read checks as passed only
after actually performing them against the migrated schema.

## Remaining Technical Decisions

Rendering configuration and exact CSP directives under the accepted
[Admin header baseline](../architecture/security.md#admin-security-headers)
require technical review and documentation before the corresponding implementation,
as defined in [Security](../architecture/security.md#implementation-decisions).
