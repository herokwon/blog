# Database Foundation

## Status and Sources

D1 integration and migration tooling are `Implemented`.
The `posts` schema and initial migration are `Implemented` and validated on local D1.
Post repository reads are `Implemented`, tested through Drizzle with a disposable
migrated SQLite-backed D1 binding and the Task 5 isolated local D1 HTTP fixture.
Post mutations and UUIDv7 generation are `Implemented` in
`src/lib/server/posts/mutate.ts`; the Admin HTTP API persists through these
repositories. The production Worker fixture verifies UUIDv7 execution, D1
uniqueness-error classification and concurrent mutations without remote writes.

| Concern              | Current source                                                                   |
| -------------------- | -------------------------------------------------------------------------------- |
| Database binding     | `DB` in [wrangler.jsonc](../../wrangler.jsonc)                                   |
| Connection           | [getDb](../../src/lib/server/db/index.ts), using `drizzle-orm/d1`                |
| Schema               | [schema.ts](../../src/lib/server/db/schema.ts): `posts`                          |
| Initial migration    | [0000_create_posts.sql](../../drizzle/0000_create_posts.sql)                     |
| Migration generation | [drizzle.config.ts](../../drizzle.config.ts): SQLite dialect, `./drizzle` output |
| Migration scripts    | [package.json](../../package.json)                                               |

Post creation uses `uuid`
`14.0.2`'s `v7()` with its default cryptographic randomness. The library's
default Worker-compatible export uses `crypto.getRandomValues()`; no custom
UUID generator or creation retry is introduced. Draft creation tests verify
UUIDv7 representations, distinct IDs, raw content, and database timestamps.
See the [UUID library](https://github.com/uuidjs/uuid) for the RFC9562 API.

[Content Domain](content-domain.md) defines behavior and validation.
[API Design](api-design.md) defines query ordering, errors, and retries.
[ADR 0002](../adr/0002-use-a-single-content-entity.md) records the rationale
for the single entity and independent soft deletion.

## Storage and Constraints

Use Drizzle ORM with Cloudflare D1 and the SQLite dialect.
Table and column names use `snake_case`; future foreign keys use
`<entity>_id`.

The `Post` model is stored in the `posts` table:

| Column         | Storage and constraint                                                           |
| -------------- | -------------------------------------------------------------------------------- |
| `id`           | `TEXT NOT NULL PRIMARY KEY`; UUIDv7                                              |
| `title`        | `TEXT NOT NULL CHECK (title <> '')`                                              |
| `body`         | `TEXT NOT NULL CHECK (body <> '')`; Markdown source                              |
| `status`       | `TEXT NOT NULL DEFAULT 'draft'`; CHECK allowing `draft`, `published`, `archived` |
| `slug`         | Nullable `TEXT`; unique across all content                                       |
| `created_at`   | `TEXT NOT NULL`; insertion default below                                         |
| `published_at` | Nullable `TEXT`; first successful publication                                    |
| `updated_at`   | `TEXT NOT NULL`; insertion default below                                         |
| `deleted_at`   | Nullable `TEXT`; soft-deletion timestamp                                         |
| `revision`     | `INTEGER NOT NULL DEFAULT 1`; CHECK requiring a positive integer                 |

Summary is derived and not stored.

The application explicitly sets `status = 'draft'` on creation with `slug`,
`published_at`, and `deleted_at` NULL. The API rejects client assignments
to server-managed fields. The DB status default applies only when omitted;
the application enforces `draft` creation and separate publication.

Application validation checks title for a non-whitespace character and
body for non-zero raw length, preserving Markdown whitespace.
Whitespace-only body is valid. DB checks additionally prevent NULL and
empty values; the title CHECK does not replace full whitespace validation.

The application handles UUIDv7 generation, slug NFC/format/length/suffix
rules, permitted transitions, and immutability of `id`, `created_at`,
established slug, and first publication timestamp.

Database constraints enforce status values, identity, slug uniqueness,
and the following publication-history combinations:

```sql
CHECK (status IN ('draft', 'published', 'archived'))

CHECK (
  (status = 'draft'
    AND slug IS NULL
    AND published_at IS NULL)
  OR
  (status IN ('published', 'archived')
    AND slug IS NOT NULL
    AND published_at IS NOT NULL)
)
```

These checks apply regardless of `deleted_at` and validate the resulting
row, not its transition history. Deletion preserves status and publication
history; restoration clears the deletion marker.

## Creation Persistence

v0.2.0 creates a Post without a dedicated creation-request table, request
hash, or replay window. A creation insert is atomic; subsequent publication
is a separate mutation. An unknown creation outcome is resolved by manual
Admin list inspection under the [API retry contract](api-design.md#automatic-retries).
Revision preconditions protect existing-post mutations, not duplicate
creation requests. Database atomicity remains required independently of
revision checks.

## Timestamps

Store all timestamps as UTC ISO 8601 `TEXT`, consistently formatted as
`YYYY-MM-DDTHH:mm:ss.sssZ`. API timestamp strings use the same format.

Use this insertion default for `created_at` and `updated_at`:

```sql
(strftime('%Y-%m-%dT%H:%M:%fZ', 'now'))
```

The application explicitly sets `updated_at` in the UPDATE performing
an actual title/body or lifecycle change; no update trigger is used.
Insertion defaults do not refresh it.

Identical title/body saves and already-satisfied commands succeed without
rewriting data or timestamps. First publication sets `published_at`;
deletion sets `deleted_at`; restoration clears it.

## Index Requirements

| Query       | Filter or constraint                        | Ordering                     |
| ----------- | ------------------------------------------- | ---------------------------- |
| Slug lookup | Unique non-NULL slug across all content     | —                            |
| Public list | `status = published AND deleted_at IS NULL` | `published_at DESC, id DESC` |
| Admin list  | `deleted_at IS NULL`                        | `updated_at DESC, id DESC`   |
| Trash list  | `deleted_at IS NOT NULL`                    | `updated_at DESC, id DESC`   |

Posts in `archived` status and soft-deleted content reserve their slugs.
Multiple drafts may have NULL slugs. Validate exact composite or partial
indexes against actual queries and D1 query plans during implementation.

The initial migration provides `posts_slug_unique` across all rows and three
Admin indexes: `posts_admin_updated_idx` on `(updated_at DESC, id DESC)` for
non-deleted rows, `posts_admin_status_updated_idx` on
`(status, updated_at DESC, id DESC)` for non-deleted rows, and
`posts_trash_updated_idx` on `(updated_at DESC, id DESC)` for deleted rows.
Local D1 `EXPLAIN QUERY PLAN` confirmed index-backed ordering for normal,
status-filtered, and trash queries without a temporary sorting tree. Recheck
the final repository queries in Task 3. On 2026-10-07, the explicit list-field
projections and normal/status/trash predicates were checked again on local D1;
all three use their intended indexes without temporary sorting. Public-list indexing is deferred with
Public implementation.

## Mutation Consistency

All existing-post mutations use `revision` as an optimistic concurrency
precondition. Each changing UPDATE must match the submitted revision,
permitted status, and `deleted_at` conditions, incrementing revision and
setting `updated_at` in the same statement. Prior reads cannot authorize
a later mutation. The [API precondition contract](api-design.md#revision-preconditions)
defines stale-version errors and no-op exceptions; no-op operations must
not rewrite data, timestamps, or revision.

First publication atomically establishes `published` status, slug, and
`published_at`; failure leaves no partially published state.
Database uniqueness is authoritative, including competing publications.

When an UPDATE changes no rows, distinguish an identical save or
already-satisfied command, missing content, invalid state, and revision
conflict according to the API contract.

The implemented repository uses conditional `UPDATE ... RETURNING` statements.
Save updates additionally require a submitted field to differ; matching no-op
saves retain all metadata but still require the current revision. Commands check
the current state for already-satisfied outcomes, then guard changing writes
with ID, submitted revision, permitted status, and deletion state. Prior reads
determine command outcomes and publication input; changing writes remain
authorized by the conditional UPDATE.

First publication sets status, slug, publication time, revision, and update time
in one statement. Slug generation applies NFC, English ASCII lowercasing, and
the agreed character rules. Candidates retain at most 100 Unicode code points,
including the complete numeric suffix. Only a `posts.slug` unique constraint
failure triggers the next candidate; other database errors propagate. No
preflight availability read can reserve a slug. Existing publication identity
is omitted from later updates, including republication.

Task 4 tests run against the migrated SQLite-backed D1 binding and cover all
lifecycle/deletion combinations, stale and no-op rules, competing saves and
publications, delete/restore races, reserved archived/deleted slugs, and atomic
publication failure. This establishes SQL invariants; actual local D1 HTTP
concurrency and runtime error handling remain Task 5 verification.

## Migrations and Environments

The Drizzle schema and generated SQL migrations define database structure.

1. Update the schema for an agreed change.
2. Generate SQL with an explicit descriptive name, such as
   `pnpm db:generate --name=create_posts`. Always name migrations after their
   schema change; preserve names and contents after production application.
3. Review SQL, compatibility with the running Worker, existing data against
   new constraints, and any required data transformation.
4. Apply locally with `pnpm db:migrate:local`.
5. Validate schema, data transformation, and application behavior.
6. Apply validated migrations through production release promotion.

Discuss and document data deletion or value changes affecting policy
before implementation. Initial creation of an empty table requires
constraint and application-flow validation, with no existing data to
transform.

Maintain the same ordered migration history locally and in production.
Generate migrations for real changes, not an empty tooling initialization.

### Initial migration regeneration before production

Release preparation replaced `0000_wealthy_kinsey_walden.sql` with
`0000_create_posts.sql` and removed the starter `task` table. This is a fresh
database baseline, not an upgrade for a database that applied the old file.
Wrangler tracks complete migration filenames, so applying the renamed baseline
to that database would attempt to create `posts` again.

Before production promotion, verify that production contains neither `posts`
nor the old migration record. If either exists, stop promotion and preserve the
applied history with a forward migration instead of resetting production.

For disposable local Wrangler state that applied the old migration, stop local
servers, preserve any needed data, and remove only `.wrangler/state/v3/d1` before
running `pnpm db:migrate:local` again. This deletes local D1 data and history;
never use it for a database whose data must be retained. The automated test
fixtures use isolated fresh databases and do not require this reset.

Wrangler reads flat `drizzle/*.sql` files. Release promotion uses
`pnpm db:migrate:remote` before Worker deployment; authorization,
sequencing, and failure handling are defined in
[CI/CD operations](../operations/ci-cd.md).

| Environment | Storage                              |
| ----------- | ------------------------------------ |
| Local       | Wrangler local D1 state              |
| Production  | Single configured remote D1 database |

Validate writes and migrations locally. Candidate Version URLs share
production D1 and follow the [overview's read-only policy](overview.md).
Worker versions carry neither D1 data nor migration state, and Worker
rollback does not reverse migrations.

## Deferred Decisions

| Item                   | Decision process                                                   |
| ---------------------- | ------------------------------------------------------------------ |
| Repository query plans | Recheck the initial Admin indexes against final repository queries |

Internal choices may be made during implementation if they preserve
agreed behavior; document the resulting design where relevant.
Changes to external behavior, errors, retries, or policy require prior
discussion and documentation.

Deletion retention, cleanup, and slug reuse after permanent deletion
remain outside the current storage design.
