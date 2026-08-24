# Database Foundation

## Storage

Drizzle ORM targets Cloudflare D1 using SQLite dialect. Table and column names are `snake_case`. Foreign keys use the `<entity>_id` convention. Primary keys use UUIDv7 values stored as text.

## Content Table

| Column         | Type/rule                                                                                         |
| -------------- | ------------------------------------------------------------------------------------------------- |
| `id`           | `TEXT` primary key (UUIDv7)                                                                       |
| `title`        | `TEXT` NOT NULL                                                                                   |
| `body`         | `TEXT` NOT NULL — Markdown                                                                        |
| `status`       | `TEXT` NOT NULL — `draft`, `published`, `archived`                                                |
| `slug`         | `TEXT` NULL — unique index                                                                        |
| `created_at`   | `TEXT` NOT NULL — UTC ISO 8601 timestamp<br>Defaults to `(strftime('%Y-%m-%dT%H:%M:%fZ', 'now'))` |
| `published_at` | `TEXT` NULL — UTC ISO 8601 timestamp                                                              |
| `updated_at`   | `TEXT` NOT NULL — UTC ISO 8601 timestamp<br>Defaults to `(strftime('%Y-%m-%dT%H:%M:%fZ', 'now'))` |
| `deleted_at`   | `TEXT` NULL — UTC ISO 8601 timestamp                                                              |

## Indexing

Indexes must support:

- unique slug lookup;
- Public filtering by published status and non-deleted state, ordered by `published_at DESC, id DESC`;
- Admin filtering by non-deleted state, ordered by `updated_at DESC, id DESC`;
- Trash filtering by deleted state, ordered by `updated_at DESC, id DESC`;

The exact composite index definitions should be validated against D1 query plans during implementation.

## Migrations

The workflow is:

1. Update the Drizzle schema.
2. Generate a migration with Drizzle Kit.
3. Review the generated SQL.
4. Apply the migration to the local D1 database.
5. Run schema and application checks locally.
6. Apply the validated migration to Production D1 explicitly.

The same ordered migration history is maintained across the local D1 database and Production D1. Local development is used to validate migrations and application behavior before changes are applied to Production D1.

Worker versions do not include D1 data or migration state. Production D1 migrations are therefore managed independently from Worker version uploads and deployments.

## Environment Resources

| Environment | D1 resource             |
| ----------- | ----------------------- |
| local       | Wrangler local D1 state |
| production  | Dedicated Production D1 |

A Worker version uploaded with `wrangler versions upload` is treated as a deployment candidate for final validation. This is referred to as a Preview version in the development workflow, but it does not represent a separate Worker or D1 environment.
