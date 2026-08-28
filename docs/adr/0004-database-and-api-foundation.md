# ADR-0004: Database and API Foundation

## Status

Accepted

## Context

The project needs a stable persistence and API foundation that fits Cloudflare Workers and D1 while keeping Public and Admin concerns separate.

## Decision

Use Drizzle ORM with Cloudflare D1 and SQLite. Use UUIDv7 text primary keys, `snake_case` database names, and `<entity>_id` foreign keys. Generate migrations with Drizzle Kit and apply them with Wrangler.

Use separate API boundaries:

- Public routes use `/api/contents` and slug identifiers.
- Admin routes use `/api/admin/contents` and UUID identifiers.

Use Zod as the API contract source for runtime validation and OpenAPI generation. Use opaque cursor pagination with deterministic timestamp-plus-ID ordering. Use the common structured error response defined in the API architecture document.

Use separate local, production D1 resources.

## Alternatives Considered

- Using a different ORM or a hand-written SQL layer would create a second schema abstraction for the selected TypeScript stack.
- Sharing one API path for Public and Admin would make visibility and authorization depend on request context.
- Using page/offset pagination is less stable as rows are inserted or deleted while clients paginate.
- Maintaining a separate Preview D1 would add another persistent database and migration target without providing sufficient value, since local development already validates migrations and application behavior. Worker versions uploaded with `wrangler versions upload` are validated against the same Production D1 binding before deployment.

## Consequences

Schema, migration, and API contracts are explicit and testable. Deployment must manage D1 migrations independently from Worker version uploads, with bindings configured separately for local development and production.
