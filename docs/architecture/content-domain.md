# Content Domain

## Status and Entity

The v0.2.0 Admin domain is implemented and locally verified. Post persistence, lifecycle operations, and
protected Admin list/trash/detail pages and new/edit authoring are implemented.
Task 11 [acceptance evidence](../operations/v0.2.0-acceptance.md) separates local
verification from incomplete physical-device and deployed checks. The example `task`
table remains alongside the post schema.

The `Post` model represents a blog article. All states use one entity with no
separate working copy.

[ADR 0002](../adr/0002-use-a-single-content-entity.md) records the model
decision; [ADR 0003](../adr/0003-use-explicit-save-and-publication.md)
records the explicit save and publication decision.

| Field          | Rule                                                                                        |
| -------------- | ------------------------------------------------------------------------------------------- |
| `id`           | Immutable UUIDv7                                                                            |
| `title`        | At least one non-whitespace character                                                       |
| `body`         | Markdown source with raw length greater than zero, including whitespace                     |
| `status`       | `draft`, `published`, or `archived`                                                         |
| `slug`         | NULL until first publication; then unique and immutable                                     |
| `created_at`   | Set on creation; immutable                                                                  |
| `published_at` | NULL until first successful publication; then immutable                                     |
| `updated_at`   | Latest title/body or publication, archiving, deletion, or restoration change                |
| `deleted_at`   | Set on soft deletion; cleared on restoration                                                |
| `revision`     | Positive integer; starts at 1 and increases with each persisted content or lifecycle change |

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
| Admin detail   | `/admin/posts/[id]`      | Read persisted content and inspect its status by ID |
| Admin editing  | `/admin/posts/[id]/edit` | Edit existing non-deleted content by ID             |
| Admin trash    | `/admin/posts/trash`     | List deleted content in all statuses and restore it |
| Public article | `/posts/[slug]`          | Read publicly visible content by slug               |

All Admin pages require the authentication and authorization defined in
[Security](security.md). List, trash, detail, creation, and editing routes are
implemented.

Admin targets desktop and mobile use, including listing, detail reading,
creation, editing, publication, archiving, trash, deletion, and restoration.
Mobile uses the same data and action contracts; responsive layout and
touch interaction must preserve the full management flow. Editor usability
and navigation confirmations require mobile verification before completion.

Public lookup and deleted-content management follow the visibility and
restoration rules below. The model is `Post`; page routes, API resource paths, and the database table
use `posts`, as defined in
[API Design](api-design.md) and [Database Foundation](database-foundation.md).

Posts in `draft` status need no slug. Later title changes affect neither ID nor public URL.

### Admin Layout

The agreed mockup establishes the v0.2.0 Admin layout, not a finalized
visual theme. List, trash, and detail use this layout; authoring layouts
now use the same shell. The organization applies to all Admin pages.

- Desktop content has a maximum width of 1024px. Mobile adapts the same
  management flow rather than removing actions.
- Main-page headings or editor navigation/action bars precede the content
  area. Status filters belong to the list content area below that separation.
- The normal list groups the writing action and trash icon at the right of
  its heading, with writing before trash. The trash heading provides a
  return action labeled `게시글 목록`.
- Desktop lists use tables; mobile lists use cards. Both present title,
  status, creation and publication timestamps, plus the updated timestamp
  for normal posts or deleted timestamp for trash. Row/card actions use an
  overflow menu. Timestamp headings omit `시각`; titles have no underline.
  Item-count labels and a separate pagination top divider are omitted.
- Detail places the title before status and timestamp metadata. Navigation
  is on the left of the top action row, with applicable management actions
  on the right.
- Existing-post editing and new-post authoring use a top navigation/action
  bar, then a title input and formatted body editor. Existing editing has
  save and cancel; creation orders publish, save, and cancel. Editor pages
  omit a standalone status badge. Return buttons are labeled `목록`.

Action availability, navigation, pagination, and mutation behavior follow
their contracts elsewhere in this document; the layout does not override
them. Final colors, typography sizes, borders, and exact spacing remain
adjustable during implementation. Preserve the agreed organization and
clear separation between top controls and content; numerical gaps in the
mockup are provisional rather than fixed acceptance criteria.

### Admin Detail

The Admin detail page displays persisted title and rendered Markdown body
in a reading view, with status, relevant timestamps, and an edit action for
non-deleted content. It supports drafts, published posts, and archived
posts without relying on a slug. Use the existing Admin detail API and
the authentication and rendering policy in [Security](security.md).
Deleted-content management retains the restoration-only rules below.

Public APIs and pages remain outside v0.2.0; successful authoring flows
use this protected detail page rather than a Public article route.

Use Milkdown/Crepe capabilities first for both authoring and the Admin
reading view. Evaluate a read-only presentation with authoring controls
removed before introducing a separate Markdown renderer. Add external tools
only when a demonstrated requirement cannot be met reasonably with the
existing capabilities; record the gap and selected tool in the relevant
design document. This preference does not relax rendering safety or source
preservation. Future Public rendering is outside v0.2.0 and does not require
the same editor runtime merely because Admin uses it.

The editor uses Milkdown Crepe, configured for the authoring features below.
v0.2.0 provides formatted editing only, without a Markdown source-editing
toggle. Persisted body remains Markdown source.

#### Editor Integration

Initialize and destroy Crepe on the client. Use its Markdown, read-only,
listener, and plugin APIs for explicit saves and pending-request locking.
Use `TopBar` for fixed formatting controls; disable `ImageBlock`, `Latex`,
and `AI`, and remove insertion actions outside the supported feature set.
Preflight and paste/drop/transaction checks are required in addition to
feature flags. [Security's feasibility review](security.md#markdown-and-editor-feasibility-review)
records the tested APIs, normalization behavior, and feature-flag limitations.

Retain loaded Markdown when the body has not been edited; initial
serialization differences must not mark it dirty or rewrite it. Schedule
recovery serialization from document-change notifications: a Markdown-change
callback already serializes the document inside the library.

Supported authoring features are headings, paragraphs, bold, italic,
strikethrough, ordered and unordered lists, task lists, blockquotes,
horizontal rules, links, inline code, code blocks with a language identifier,
and tables. Images, videos, and embeds are outside v0.2.0.
Code blocks offer language selection and syntax highlighting; unspecified
or unsupported languages display as plain text. Highlighting preserves
the code source. Code execution and automatic formatting are excluded.

Before loading persisted Markdown into the editable document, check for
constructs outside the supported authoring set. If any are present,
preserve the original source, block body editing and saving, and explain
which unsupported constructs caused the block. Do not drop, convert, or
rewrite them through the editor. v0.2.0 does not provide read-only editor
blocks for editing the rest of such a document.

Admin list and detail reads and permitted lifecycle actions remain
available under their existing validation, rendering, authorization, and
revision contracts. An unsupported code-block language alone does not
trigger this block; it uses the plain-text fallback above.

Post changes require explicit server saves; server autosave is outside the design.
Saving published content updates its public content immediately; editing
archived content keeps it private. Archived content becomes public only
through a separate republication command.

### Editor Actions and Navigation

The existing-post editor offers save and cancel; publication and
republication are available through persisted-content management views.
These actions publish persisted content and do not implicitly save editor
input. Leaving dirty editor input follows the confirmation rule below.
The new-post page retains its separate creation-followed-by-publication flow.

When leaving a page with unsaved changes, ask whether to leave without
saving using a confirmation dialog. Canceling keeps the editor and input;
confirming permits navigation without saving or publishing. This applies
to new and existing posts regardless of status.

After confirmed mutation outcomes, use the following navigation:

| Outcome                                        | Destination or behavior                                             |
| ---------------------------------------------- | ------------------------------------------------------------------- |
| New draft saved                                | `/admin/posts/[id]/edit`                                            |
| New post created and published                 | `/admin/posts/[id]`                                                 |
| New post created but publication failed        | Its edit page, with publication failure and retry guidance          |
| Existing post saved, in any non-deleted status | `/admin/posts/[id]`                                                 |
| Existing post published or republished         | `/admin/posts/[id]`                                                 |
| Creation outcome remains unknown               | Keep the creation page and input; offer manual post-list inspection |

During saving and new-post creation/publication, disable title/body input,
formatting controls, and duplicate mutation actions. Keep the editor locked
through the permitted automatic retry and automatic outcome-recovery read.
On confirmed success, follow the navigation above. On failure or an
unconfirmed outcome, preserve input and unlock the editor for the next
user action. Preserving edits entered during the pending request is outside
v0.2.0 because editing is disabled during that interval.

Retain any confirmed post ID and state, so subsequent actions use the
existing post. The
[lost-response recovery contract](api-design.md#lost-response-recovery)
governs outcomes established only by a recovery read.

### Browser Input Recovery

v0.2.0 retains a browser-local recovery copy of unsaved title and Markdown
body only for new-post authoring, updating it as input changes. This supports
recovery after revisiting
the authoring page, including after refresh or browser closure, when the
browser still has the copy. Updating this copy does not save or publish
content on the server.

Use localStorage with one recovery copy for new-post authoring per browser
and site. Existing-post editing has no persistent input recovery; reopening
an existing post loads its saved server content, so unsaved edits can be lost.
Do not introduce IndexedDB for input recovery. v0.2.0 does not support
independent recovery copies for simultaneous authoring of multiple new
posts. The last recorded input can replace an earlier new-post copy. Do not introduce
tab-specific recovery lists, tab-duplication detection, or authoring-session
ownership coordination.

Debounce recovery writes and bound the wait during continuous input rather
than synchronously serializing and writing the full body on every keystroke.
Only write changed input. Select the recording intervals after checking
Markdown serialization and localStorage write costs with representative
long posts and mobile devices. Recovery is best effort: abrupt termination
can lose input not yet durably recorded.

Task 10 records after `500` ms without input and at least every `2000` ms
during continuous input; it serializes only after document-change signals.
Local Chromium measurements of a changed approximately 93 KB Markdown document
at 1024/350 px content widths took 2.6/2.1 ms for real Crepe serialization,
0.3/0.7 ms for JSON encoding, and 0.7/0.9 ms for a recovery write. Actual
1280/390 px authoring pages recorded the long input within about 1.0/1.1 seconds,
including debounce and browser test interaction. These are desktop-host
responsive Chromium measurements, not physical mobile-device benchmarks.

If localStorage cannot be accessed or a recovery write fails, keep authoring
and explicit server saving available. Show one concise notice that browser
input recovery is unavailable; do not repeat alerts for each failed write
or introduce fallback storage or a separate recovery workflow.

Retain each recovery copy for seven days (168 hours) from its last input
edit. New edits restart that copy's retention period; merely visiting the
page or choosing recovery does not extend it. Remove expired copies and
do not offer them for recovery. Explicit Admin logout removes all Admin
input recovery copies held in that browser for this site. Closing a tab
or browser is not explicit logout and retains unexpired copies.

An input recovery copy does not establish whether a creation request
succeeded. Do not persist creation-request keys or payload snapshots, and
do not automatically submit recovered input. If creation was uncertain,
the author checks the post list before submitting again.

When a recovery copy exists, show `미저장 작성 내용이 있습니다` and offer
`복구` and `버리기`. Do not apply it automatically. Recovery loads its title
and body as unsaved editor input; discard removes the recovery copy without
changing server content. Retain the existing unsaved-navigation confirmation.

After confirmed new-post creation success, clear the recovery copy corresponding
to the submitted input. Failed saves or unconfirmed outcomes must not clear
unsaved input or its recovery copy. Request-outcome recovery continues to
follow the API lost-response contract. A confirmed creation followed by a
failed publish is an existing saved draft and does not retain a new-post
input recovery copy. Existing-post mutation revision preconditions remain
required independently of browser input recovery.

### Concurrent Changes

The [API revision precondition](api-design.md#revision-preconditions) protects
existing-post mutations. Its no-op rules and
[atomic enforcement](database-foundation.md#mutation-consistency) apply to
the UI flows below.

On an editor save conflict, retain title/body input, unlock the editor, and
explain that the post changed in another view. Offer `최신 글 확인` to open
the persisted Admin detail page in a new tab without replacing the original
editor input. Offer `최신 내용 불러오기` in the original editing tab; confirm
discarding current input before fetching the latest title, body, and revision
together. A failed fetch leaves input and the base revision unchanged.
The author can copy any input to keep before reloading, then manually apply
it to the latest content. Do not provide automatic merging, force overwrite,
or a revision-only refresh followed by automatic resubmission.

On lifecycle-action conflicts, refresh the current post state and available
actions, preserving any unsaved input, and let the author select an action
again. Do not automatically repeat the conflicting action.

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
The new-post page offers both explicit draft saving and publication.
The publication button performs creation followed by publication:

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

Before deletion, show a confirmation dialog; for published posts, explain
that deletion also removes public visibility. Before restoring a published
post, explicitly confirm that restoration makes it public again. Restore
drafts and archived posts without a confirmation dialog and update the list
after the outcome is confirmed. Canceling a dialog sends no mutation.

| Admin page          | Included content                       | Management             |
| ------------------- | -------------------------------------- | ---------------------- |
| Normal content list | `deleted_at IS NULL`, all statuses     | Normal content actions |
| Trash list          | `deleted_at IS NOT NULL`, all statuses | Restore only           |

See [Identification and Authoring](#identification-and-authoring) for page
routes and Admin access requirements. Restored content
returns to the normal list with its preserved status.

The normal Admin list offers `All`, `draft`, `published`, and `archived`
filters. `All` includes every non-deleted status; changing the filter
resets the page number to 1 and loads the first page. The optional
`status` query is defined in [API Design](api-design.md#admin-status-filter).
Search and tag filters are outside v0.2.0.

Normal and trash lists use numbered page buttons with previous and next
controls. Both initially request 20 items per page, using the page and
total counts defined in [API Design](api-design.md#admin-and-trash).
An empty scope shows an empty state and hides pagination. The API may
return totals without displaying an item-count label in the UI.

Show page numbers in fixed groups of five: 1–5, 6–10, and so on. The
current page selects its group; do not center a sliding range around it.
The final group shows only existing pages, aligned from the left of the
number area, without adding earlier pages to fill five positions. Do not
display ellipses or extra first/last page buttons. Previous and next move
one page at a time, changing the visible group when crossing its boundary;
disable them on the first and last page respectively. For twelve pages,
pages 1–5 display 1–5, pages 6–10 display 6–10, and pages 11–12 display
only 11 and 12. Apply the same behavior to normal and trash lists.

After deletion or restoration succeeds, reload the originating list with
its current filter, page, and limit. If the requested page exceeds the
returned `totalPages` and the scope is not empty, navigate to and fetch the
new last page. If the entire scope is empty, reset the UI page to 1, show
the empty state, and hide pagination. Otherwise retain the current page
and display the refreshed items. This fallback changes UI navigation;
the API continues to return the requested page without silently clamping it.

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

The [navigation table](#editor-actions-and-navigation) distinguishes creation
from publication outcomes. Retain a confirmed draft ID and retry only
publication after a publication failure; never recreate that draft.
[API Design](api-design.md#retries-and-environments) defines retry eligibility,
manual list inspection, and lost-response reconciliation. Report success
only on confirmed responses; otherwise explain the failed stage or unknown
outcome, requesting attention only when needed.
[Database Foundation](database-foundation.md#creation-persistence)
defines creation persistence without a request-record table. Resolve
remaining client-visible contracts before API/Admin implementation.

Validate write flows locally using local D1 state. Version URLs share
production D1 and follow the read-only policy in
[Architecture Overview](overview.md).
