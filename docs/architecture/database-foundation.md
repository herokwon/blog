# Database Foundation

## Status and Sources

D1 integration and migration tooling are `Implemented`.
The `posts` table and post persistence are `Planned`.

| Concern              | Current source                                                                    |
| -------------------- | --------------------------------------------------------------------------------- |
| Database binding     | `DB` in [wrangler.jsonc](../../wrangler.jsonc)                                    |
| Connection           | [getDb](../../src/lib/server/db/index.ts), using `drizzle-orm/d1`                 |
| Schema               | [schema.ts](../../src/lib/server/db/schema.ts), currently an example `task` table |
| Migration generation | [drizzle.config.ts](../../drizzle.config.ts): SQLite dialect, `./drizzle` output  |
| Migration scripts    | [package.json](../../package.json)                                                |

The example uses `crypto.randomUUID()`, not the planned UUIDv7 identifier.

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

## Mutation Consistency

First publication atomically establishes `published` status, slug, and
`published_at`; failure leaves no partially published state.
Database uniqueness is authoritative, including competing publications.

Check status and `deleted_at` conditions at mutation time; prior reads
alone do not establish validity. If no change occurs, distinguish identical
saves or already-satisfied success, missing content, and invalid state
according to the API contract.

Retries of the same logical creation request return its existing creation
result without creating another entity.

## Migrations and Environments

The Drizzle schema and generated SQL migrations define database structure.

1. Update the schema for an agreed change.
2. Generate SQL with `pnpm db:generate`.
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

| Item                                                              | Decision process                                                             |
| ----------------------------------------------------------------- | ---------------------------------------------------------------------------- |
| UUIDv7 generation                                                 | Select and verify during implementation                                      |
| Exact indexes                                                     | Validate against actual queries and D1 query plans                           |
| Publication concurrency                                           | Verify against agreed atomicity, state, and uniqueness requirements          |
| Creation-request identification and deduplication validity period | Discuss and document before implementation; these affect the client contract |
| Deduplication storage                                             | Select after the request contract is agreed                                  |

Internal choices may be made during implementation if they preserve
agreed behavior; document the resulting design where relevant.
Changes to external behavior, errors, retries, or policy require prior
discussion and documentation.

Deletion retention, cleanup, and slug reuse after permanent deletion
remain outside the current storage design.
