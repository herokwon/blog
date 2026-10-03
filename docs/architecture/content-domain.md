# Content Domain

## Status and Entity

This domain is `Planned`. The database currently contains an example
`task` table; post persistence and lifecycle operations are not implemented.

The `Post` model represents a blog article. All states use one entity with no
separate working copy.

[ADR 0002](../adr/0002-use-a-single-content-entity.md) records the model
decision; [ADR 0003](../adr/0003-use-explicit-save-and-publication.md)
records the explicit save and publication decision.

| Field          | Rule                                                                         |
| -------------- | ---------------------------------------------------------------------------- |
| `id`           | Immutable UUIDv7                                                             |
| `title`        | At least one non-whitespace character                                        |
| `body`         | Markdown source with raw length greater than zero, including whitespace      |
| `status`       | `draft`, `published`, or `archived`                                          |
| `slug`         | NULL until first publication; then unique and immutable                      |
| `created_at`   | Set on creation; immutable                                                   |
| `published_at` | NULL until first successful publication; then immutable                      |
| `updated_at`   | Latest title/body or publication, archiving, deletion, or restoration change |
| `deleted_at`   | Set on soft deletion; cleared on restoration                                 |

All timestamps use the fixed UTC format defined in
[Database Foundation](database-foundation.md#timestamps).
A NULL `published_at` means never published, not currently hidden.
Summary is derived, not persisted.
The [database foundation](database-foundation.md) defines storage constraints
and timestamp handling; identical saves leave `updated_at` unchanged.

## Identification and Authoring

Admin operations use `id`, including retrieval, editing, publication,
archiving, deletion, and restoration. Public articles use `slug`.

| Page           | Route                    | Purpose                                             |
| -------------- | ------------------------ | --------------------------------------------------- |
| Admin list     | `/admin/posts`           | List non-deleted content in all statuses            |
| Admin creation | `/admin/posts/new`       | Compose content and explicitly save a draft         |
| Admin editing  | `/admin/posts/[id]/edit` | Edit existing non-deleted content by ID             |
| Admin trash    | `/admin/posts/trash`     | List deleted content in all statuses and restore it |
| Public article | `/posts/[slug]`          | Read publicly visible content by slug               |

All Admin pages require the authentication and authorization defined in
[Security](security.md). These page routes are `Planned`, not implemented.

Public lookup and deleted-content management follow the visibility and
restoration rules below. The model is `Post`; page routes, API resource paths, and the database table
use `posts`, as defined in
[API Design](api-design.md) and [Database Foundation](database-foundation.md).

Posts in `draft` status need no slug. Later title changes affect neither ID nor public URL.

Milkdown is the planned editor, with Crepe usage deferred to implementation.
Post changes require explicit saves; autosave is outside the design.
Saving published content updates its public content immediately; editing
archived content keeps it private.

## Validation

Creation, editing, and publication use the same rules for every status:

- Title needs a non-whitespace character; spaces, tabs, and line breaks
  alone are invalid.
- Body cannot be empty, but whitespace-only content is valid.
  Preserve whitespace in stored Markdown.

Invalid input changes neither persisted content nor lifecycle state.
Deletion and restoration do not change title/body or revalidate them.

## Creation and Lifecycle

Always create a draft with `slug = NULL` and `published_at = NULL`.
Immediate publication still uses two distinct operations:

1. Validate and create the draft.
2. Validate persisted content for publication.
3. Generate a unique slug.
4. Set `published` status and the first publication timestamp.

The first successful publication establishes status, slug, and
`published_at` together. Failure leaves no partially published state.
Successful creation must not be reported as successful publication.

For non-deleted content:

```text
Create -> draft -> published <-> archived
```

| Transition               | Meaning                            |
| ------------------------ | ---------------------------------- |
| `draft` → `published`    | First publication                  |
| `published` → `archived` | Withdraw publicly without deleting |
| `archived` → `published` | Republication                      |

Transitions from `draft` to `archived` and returns to `draft` are forbidden.
Archiving retains content without setting `deleted_at`. Both archiving and
republication preserve the slug and first publication timestamp.

Already-satisfied commands succeed without changing data or timestamps;
[API command rules](api-design.md#lifecycle-commands) define their responses.
These acknowledgments introduce no new state transitions.

## Deletion, Restoration, and Admin Lists

Soft deletion is independent of status: all three statuses can be deleted
and restored. Deletion sets `deleted_at` while preserving status, slug,
publication timestamp, title, and body. Restoration clears `deleted_at`
and retains the status held before deletion.

| Preserved status | Restoration result                                                  | Publicly visible |
| ---------------- | ------------------------------------------------------------------- | ---------------- |
| `draft`          | `draft`; no slug or publication timestamp assigned                  | No               |
| `published`      | `published`; existing slug and first publication timestamp retained | Yes              |
| `archived`       | `archived`                                                          | No               |

Only restoration can change deleted content. Editing, publication,
archiving, and manual permanent deletion are unavailable. Repeated DELETE
only acknowledges an existing deletion without changing data.

| Admin page          | Included content                       | Management             |
| ------------------- | -------------------------------------- | ---------------------- |
| Normal content list | `deleted_at IS NULL`, all statuses     | Normal content actions |
| Trash list          | `deleted_at IS NOT NULL`, all statuses | Restore only           |

See [Identification and Authoring](#identification-and-authoring) for page
routes and Admin access requirements. Restored content
returns to the normal list with its preserved status.

A retention period followed by permanent deletion may be added later.
Duration, cleanup behavior, and slug reuse after permanent deletion
remain undecided.

## Public Visibility

All public outputs require:

```text
status = published AND deleted_at IS NULL
```

Posts in `draft` or `archived` status and deleted content expose no article content through
Public pages or APIs. Unavailable article requests return `404`.
The same condition applies to future lists, search, feeds, and sitemaps.

## Slug

### Generation and Normalization

Generate from the title only on first successful publication; draft
creation and editing do not reserve slugs.

Apply in order:

1. Normalize the source title to Unicode NFC.
2. Lowercase English uppercase letters.
3. Replace whitespace (spaces, tabs, line breaks) and underscores with hyphens.
4. Preserve Unicode letters and numbers, `-`, and `+`.
5. Remove all other characters, including `/`, `?`, `#`, other punctuation,
   and emoji; do not replace removed characters with separators.
6. Collapse consecutive hyphens and trim leading/trailing hyphens.

NFC applies only to slug generation, not persisted title or body.
Combining marks that remain outside the allowed categories are removed.
An empty result is a publication validation error; content stays `draft`.

| Title                 | Normalized slug before length/collision handling |
| --------------------- | ------------------------------------------------ |
| `Hello World`         | `hello-world`                                    |
| `Svelte_Kit 시작하기` | `svelte-kit-시작하기`                            |
| `  Hello -- World  `  | `hello-world`                                    |
| `API/설계`            | `api설계`                                        |
| `C++ 시작하기`        | `c++-시작하기`                                   |

### Length, Uniqueness, and Stability

The final unencoded slug is limited to 100 Unicode code points,
including a collision suffix. Truncate the normalized title portion as
needed, trimming trailing hyphens, and resolve collisions with `-2`,
`-3`, and so on. Reserve the entire suffix length: `-2` leaves up to
98 code points; `-100` leaves 96.

Database uniqueness includes archived and soft-deleted content, which
continue to reserve their slugs.

An established slug survives title edits, archiving, republication,
deletion, and restoration. Future rule changes do not rewrite it.

### URL Encoding

Store normalized, unencoded slugs. Encode once as a single path segment:

```ts
const href = `/posts/${encodeURIComponent(slug)}`;
```

Do not encode the entire path or store encoded values. Lookup uses the
unencoded slug; do not decode route parameters again if the router already
has. The 100-code-point limit applies before encoding.

## Summary

Derive approximately 300 characters of visible text from Markdown,
excluding code blocks and non-display content. Rendering and summary
extraction use the same parsing policy. Summary is a response value,
not a database field.

## Failures and Deferred Decisions

Distinguish creation failure from publication failure:

- Preserve editor input when creation fails.
- If creation succeeds but publication fails, retain the draft and retry
  publication using the same ID.
- A timeout or unknown outcome does not prove creation failed.
  Retrying the same logical creation request returns its existing result
  without duplicates.
- Publication retries preserve established slugs and publication timestamps.

After repeated failures, show a stage- and situation-specific UI error.
Never report publication success before confirmation.

[API design](api-design.md#deferred-implementation-decisions) defines errors,
retries, and deferred contracts. Discuss and document retry counts,
creation-request identification, and deduplication validity before API/Admin
implementation. Internal deduplication mechanisms may be selected during
implementation within the agreed contract.

Validate write flows locally using local D1 state. Version URLs share
production D1 and follow the read-only policy in
[Architecture Overview](overview.md).
