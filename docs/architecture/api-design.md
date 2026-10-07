# API Design

## Status and Contracts

The HTTP APIs described here are `Planned`. Admin runtime contracts and repository
reads are implemented in `src/lib/admin/contracts.ts` and
`src/lib/server/posts/read.ts`. Atomic mutations are implemented in
`src/lib/server/posts/mutate.ts`; HTTP handlers remain pending.
Zod is the source of truth for
path parameters, query parameters, request bodies, responses, and errors.
Future OpenAPI generation will derive `docs/openapi.json` from these
contracts; the artifact will not be maintained by hand.

[Content Domain](content-domain.md) defines validation, lifecycle,
visibility, timestamps, summary extraction, and slug generation.
[Security](security.md) defines authentication, authorization, request-origin
checks, rendering safety, and Admin response caching.
[Architecture Overview](overview.md) defines runtime boundaries and
environment restrictions.
[ADR 0003](../adr/0003-use-explicit-save-and-publication.md) records the
rationale for explicit saves and separate creation and publication.

## Endpoints

API resource paths use `posts`; page routes use `/posts` and
`/admin/posts`. Public endpoints identify content by `slug`; Admin
endpoints use the internal UUIDv7 `id`.
See [Content Domain](content-domain.md#identification-and-authoring) for
the planned page routes and their responsibilities.

### Public

Public endpoints require no Admin authentication and expose only content
where `status = published AND deleted_at IS NULL`.

| Method | Path               | Success response     |
| ------ | ------------------ | -------------------- |
| GET    | `/api/posts`       | `200`, Public list   |
| GET    | `/api/posts/:slug` | `200`, Public detail |

Missing, draft, archived, and deleted articles return
`404 POST_NOT_FOUND`.

### Admin

All Admin endpoints require authentication and authorization.

| Method | Path                           | Operation                                   | Success response    |
| ------ | ------------------------------ | ------------------------------------------- | ------------------- |
| GET    | `/api/admin/posts`             | List all non-deleted statuses               | `200`, Admin list   |
| POST   | `/api/admin/posts`             | Create a draft                              | `201`, Admin detail |
| GET    | `/api/admin/posts/trash`       | List deleted content in all statuses        | `200`, Admin list   |
| GET    | `/api/admin/posts/:id`         | Retrieve content, including deleted content | `200`, Admin detail |
| PATCH  | `/api/admin/posts/:id`         | Update title or body                        | `200`, Admin detail |
| DELETE | `/api/admin/posts/:id`         | Soft-delete content                         | `204`, no body      |
| POST   | `/api/admin/posts/:id/publish` | Publish or republish                        | `200`, Admin detail |
| POST   | `/api/admin/posts/:id/archive` | Archive                                     | `200`, Admin detail |
| POST   | `/api/admin/posts/:id/restore` | Restore                                     | `200`, Admin detail |

`trash` is a reserved collection path, not a content ID.
Deleted content can be inspected; restoration is its only management
action that changes persisted data.

## Creation and Editing

| Request         | Accepted body                                                                                            |
| --------------- | -------------------------------------------------------------------------------------------------------- |
| POST collection | Required `title` and `body`                                                                              |
| PATCH resource  | Required `expected_revision` and one or both of `title` and `body`; at least one editable field required |

```json
{
  "title": "Hello World",
  "body": "# Hello World"
}
```

Unknown body fields return `400 VALIDATION_ERROR` rather than being
ignored. Clients cannot assign IDs, lifecycle fields, or timestamps.

Title must contain a non-whitespace character. Body must have a raw
length greater than zero; whitespace-only body is valid and its
whitespace is preserved. Omitted PATCH fields remain unchanged.

Creation always produces `draft` content with `slug`, `published_at`,
and `deleted_at` set to `null`. Immediate publication requires creation
followed by a separate `publish` request using the returned ID.

PATCH changes title or body only. Saving published content updates its
public content; saving archived content does not publish it.
Deleted content cannot be edited.

### Revision Preconditions

All existing-post mutations (PATCH, publication, archiving, deletion,
and restoration) require a positive integer `expected_revision` in the
JSON request body. Missing or invalid values return `400 VALIDATION_ERROR`.
The value is a precondition, not a client assignment to `revision`.

Actual changes require the submitted value to match the persisted
revision, checked atomically with the permitted state and mutation.
A mismatch returns `409 POST_VERSION_CONFLICT` without changing the post.
The [conflict UI](content-domain.md#concurrent-changes) preserves input and
offers inspection of the latest state without silently replacing the
expected revision. No-op saves require a matching revision; already-satisfied
lifecycle commands follow their success rules below even if the submitted
revision is stale.
Authentication, authorization, and request validation still apply.

Creation has no existing revision to match. A new draft starts at revision
`1`. Immediate publication uses that returned revision; subsequent mutations
use the revision returned by the preceding confirmed operation.

## Lifecycle Commands

Commands operate on persisted content and do not save unsaved editor
changes.

| Command   | Current state           | Effect                                                                              |
| --------- | ----------------------- | ----------------------------------------------------------------------------------- |
| `publish` | Non-deleted `draft`     | Establish `published` status, unique slug, and first publication timestamp together |
| `publish` | Non-deleted `archived`  | Publish again; preserve slug and first publication timestamp                        |
| `archive` | Non-deleted `published` | Change status to `archived`                                                         |
| DELETE    | Any non-deleted status  | Set `deleted_at`; preserve status                                                   |
| `restore` | Deleted                 | Clear `deleted_at`; preserve status                                                 |

First-publication failure must not leave partially published content.

Already-satisfied commands return success without changing any data,
including `revision`, `updated_at`, `published_at`, or slug:

| Command   | Already-satisfied state | Response            |
| --------- | ----------------------- | ------------------- |
| `publish` | Non-deleted `published` | `200`, Admin detail |
| `archive` | Non-deleted `archived`  | `200`, Admin detail |
| DELETE    | Deleted                 | `204`, no body      |
| `restore` | Non-deleted             | `200`, Admin detail |

Repeated DELETE acknowledges an existing deletion; it does not add
another management action for deleted content.

Other invalid operations return `409 INVALID_POST_STATE`, including
archiving `draft` content and editing, publishing, or archiving deleted
content.

Already-satisfied behavior depends on current state. It does not identify
a replay when intervening lifecycle changes have occurred.

## Representations

Single-resource responses return the representation directly.
Successful responses do not use a global `data` envelope.

| Representation            | Fields                                                                                                |
| ------------------------- | ----------------------------------------------------------------------------------------------------- |
| Public list item          | `slug`, `title`, `summary`, `published_at`, `updated_at`                                              |
| Public detail             | `slug`, `title`, `body`, `published_at`, `updated_at`                                                 |
| Admin list and trash item | `id`, `slug`, `title`, `status`, `revision`, `created_at`, `published_at`, `updated_at`, `deleted_at` |
| Admin detail              | Admin list fields plus `body`                                                                         |

Creation, editing, publication, archiving, and restoration return
Admin detail.

`revision` is a positive integer exposed only in Admin representations.

`body` is persisted Markdown source. `summary` is derived according
to the content domain and is not stored.

Nullable fields are included as `null`, not omitted:

- `slug` and `published_at`: null before first publication.
- `deleted_at`: null for non-deleted content.

Public content always has a non-null slug and publication timestamp.
All timestamps use the fixed UTC format `YYYY-MM-DDTHH:mm:ss.sssZ`
defined in [Database Foundation](database-foundation.md#timestamps).

## Pagination

### Admin and Trash

Admin and trash lists use page-number pagination. Return:

```json
{
  "items": [],
  "page": 1,
  "limit": 20,
  "totalItems": 0,
  "totalPages": 0
}
```

| Parameter | Rule                              |
| --------- | --------------------------------- |
| `page`    | Positive safe integer; default 1  |
| `limit`   | Integer from 1 to 100; default 20 |

Use `LIMIT limit OFFSET ((page - 1) * limit)`. Reject invalid parameters
or an offset outside the safe integer range with `400 VALIDATION_ERROR`;
do not automatically correct values. `cursor` and `nextCursor` are not
part of the Admin or trash pagination contract.

`totalItems` counts the same status and deletion scope as `items` before
pagination. `totalPages` is `ceil(totalItems / limit)`, or zero for an empty
scope. A valid page beyond the current last page returns an empty `items`
array with the requested `page` and current totals.

Both lists retain `updated_at DESC, id DESC` ordering. ID breaks ties.
Pagination does not guarantee a snapshot; changes between requests may
affect item positions and totals on subsequent pages.

### Public (Deferred)

The existing Public cursor design below is outside v0.2.0 and will be
reviewed when Public APIs and UI are planned. It returns:

```json
{
  "items": [],
  "nextCursor": null
}
```

| Parameter | Rule                                                                 |
| --------- | -------------------------------------------------------------------- |
| `limit`   | Integer from 1 to 100; default 20                                    |
| `cursor`  | Omit for the first page; subsequently pass the returned `nextCursor` |

`nextCursor` is an opaque string when another page is available,
otherwise `null`. Invalid limits or cursors return
`400 VALIDATION_ERROR`; values are not automatically corrected.

| List   | Ordering                     |
| ------ | ---------------------------- |
| Public | `published_at DESC, id DESC` |

ID breaks ordering ties. Cursors may encode ordering values but remain
opaque to clients. Pagination does not guarantee a snapshot;
changes between requests may affect subsequent pages.

### Admin Status Filter

`GET /api/admin/posts` accepts optional `status`: `draft`, `published`,
or `archived`. Omit it for the UI's `All` selection; a literal `All` or
other unsupported value returns `400 VALIDATION_ERROR`. Filtering preserves
the normal Admin ordering and pagination response. The
[Admin list](content-domain.md#deletion-restoration-and-admin-lists)
defines filter labels and page reset behavior; trash remains unfiltered.

## URL Encoding

Encode the persisted, unencoded slug once as a single path segment:

```ts
const url = `/api/posts/${encodeURIComponent(slug)}`;
```

Do not encode the entire path or store encoded slugs. Lookup uses the
decoded route parameter; do not decode it again if the router already
has. NFC normalization, allowed characters, length, and collision rules
are defined in the content domain.

## Errors

Application errors use:

```json
{
  "error": {
    "code": "VALIDATION_ERROR",
    "message": "Request validation failed.",
    "details": [
      {
        "path": ["title"],
        "message": "Title must contain a non-whitespace character."
      }
    ]
  }
}
```

Clients branch on `code`; `message` explains the failure.
Optional `details` supplies field-level validation information.

Define error codes once and derive the TypeScript type and Zod error
contract from the same list:

```ts
export const API_ERROR_CODES = [
  'VALIDATION_ERROR',
  'UNAUTHORIZED',
  'FORBIDDEN',
  'POST_NOT_FOUND',
  'INVALID_POST_STATE',
  'POST_VERSION_CONFLICT',
  'INTERNAL_ERROR',
] as const;

export type ApiErrorCode = (typeof API_ERROR_CODES)[number];
```

| Code                    | HTTP status | Meaning                                                                      |
| ----------------------- | ----------- | ---------------------------------------------------------------------------- |
| `VALIDATION_ERROR`      | `400`       | Invalid input, unknown body fields, or invalid pagination                    |
| `UNAUTHORIZED`          | `401`       | Missing or invalid authentication                                            |
| `FORBIDDEN`             | `403`       | Insufficient authorization, Version URL mutation, or rejected request origin |
| `POST_NOT_FOUND`        | `404`       | Missing content or content unavailable through the requested boundary        |
| `INVALID_POST_STATE`    | `409`       | Operation incompatible with the current state                                |
| `POST_VERSION_CONFLICT` | `409`       | Stale revision for a mutation requiring the current version                  |
| `INTERNAL_ERROR`        | `500`       | Unexpected server failure                                                    |

Normal slug collisions use suffix generation, not a separate error code.

Each validation detail has `path: (string | number)[]` and
`message: string`.

| Example path                  | Meaning                                                    |
| ----------------------------- | ---------------------------------------------------------- |
| `["title"]`                   | Field                                                      |
| `["metadata", "description"]` | Nested field                                               |
| `["items", 0, "title"]`       | Array item field                                           |
| `[]`                          | Request-level error, such as PATCH with no editable fields |

Unknown fields use their own paths, for example `["status"]` with
“This field is not allowed.”

Convert Zod issues into this representation. Do not return raw validation
objects, complete input values, database details, credentials, or stack
traces.

This contract covers application errors. Cloudflare Access responses
are outside it.

## Retries and Environments

The [authoring failure flow](content-domain.md#failures-and-deferred-decisions)
preserves input and distinguishes creation from publication failure.
Publication retries preserve the established slug and first publication
timestamp and follow the lifecycle and revision rules above.

### Automatic Retries

Existing-post mutations permit one automatic retry after the initial attempt.
Retry only network failures, timeouts, and HTTP `502`, `503`, or `504`,
after a randomized delay of approximately one second. Validation,
authentication, authorization, state conflicts, and ordinary `500`
responses do not trigger automatic retries.

Creation is not automatically retried: without creation deduplication,
resubmitting a request can create another post. If creation's outcome is
unknown, preserve input and offer inspection of the Admin post list.
The author checks for the created draft before deciding whether to submit
again. A missing response does not prove failure, and an immediate list
read may occur before an in-flight creation commits. Do not automatically
resubmit on reopening or restoring browser input. This manual flow does
not guarantee duplicate-free creation.

For existing-post mutations, retry only the failed stage. After the retry fails, preserve editor input and any known
post ID, explain the failed stage or unknown outcome, and offer manual
retry. An unknown outcome is not proof that the mutation failed.
Automatic and manual retries preserve the original payload
and expected revision for existing-post mutations. Never
report success solely because a request was sent. Unresolved existing-post
mutations follow the recovery flow below.

### Lost-Response Recovery

When an existing-post mutation's response is lost and its permitted retry
does not confirm the outcome, the Admin UI automatically retrieves the
current post through `GET /api/admin/posts/:id`. This includes a version
conflict on the retry after the earlier response was lost. A definite
version conflict without an earlier lost response follows the normal
conflict flow instead.

The server returns the existing Admin detail representation, including
revision and deletion state. The UI compares it with the preserved
request using these criteria:

| Mutation                             | Match criterion                                     |
| ------------------------------------ | --------------------------------------------------- |
| Save                                 | Submitted title/body fields match current data      |
| Publish, archive, delete, or restore | Current lifecycle/deletion state matches the target |

A match establishes the observed current state, not proof that the
original request succeeded or that no intervening changes occurred.
On a match, end the pending indicator and reflect the observed state
without a separate recovery, content-match, or request-success notification.
Normal success indicators remain reserved for confirmed mutation responses.
The editor remains locked during the pending request, automatic retry,
and automatic recovery read, as defined in
[Editor Actions and Navigation](content-domain.md#editor-actions-and-navigation).
If data differs or retrieval fails, preserve unsaved input and the
original request metadata, and explain the conflict or unconfirmed
outcome, its known cause or symptom, and the available next action.
Do not describe an unconfirmed outcome as a definite mutation failure.
Do not replace the expected revision and automatically resend
the mutation or repeat a completed creation/publication stage.

Recovery uses existing API data; it adds no mutation response type or
recovery endpoint.
Creation without a known post ID uses manual list inspection as described
above. v0.2.0 has no creation-request key, replay endpoint behavior, or
persistent creation-request metadata.

### Environment Restrictions

Admin mutations enforce the [request-origin policy](security.md#request-origin).
After authentication and authorization, missing, unusable, or different
origins return `403 FORBIDDEN` without changing data.

Version URLs share production D1. After authentication and authorization,
Admin mutation requests on those URLs return `403 FORBIDDEN`; direct API
requests are restricted as well as UI actions. Missing or invalid identity
still follows the authentication error contract. Write flows are validated
locally with local D1 state.

## Deferred Implementation Decisions

Internal choices may be selected during implementation if they preserve
agreed contracts. Public cursor encoding belongs to the deferred Public
scope; Admin pagination uses the page-number contract above.
Changes to client-visible contracts require discussion and documentation
before implementation.
