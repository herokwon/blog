# Architecture Overview

## Purpose

The Blog is a SvelteKit application deployed to Cloudflare Workers. Content is stored in Cloudflare D1 through Drizzle ORM and is exposed through separate Public and Admin API boundaries.

## Technology Stack

- SvelteKit 2 and Svelte 5
- Cloudflare adapter and Workers
- Cloudflare D1 with SQLite
- Drizzle ORM and Drizzle Kit
- Zod-based request/response contracts and OpenAPI generation
- Vitest for unit tests and Playwright for end-to-end tests
- Milkdown for Admin Markdown authoring

## Runtime Boundaries

```text
Public browser/API
        |
        ▼
Published Content

Admin browser/API
        |
        ▼
Cloudflare Access -> src/hooks.server.ts -> Admin routes
        |
        ▼
  Drizzle -> D1
```

Cloudflare Access protects only these paths on both Preview and Production URLs: `/admin`, `/admin/*`, `/api/admin`, and `/api/admin/*`. Public pages and Public APIs remain accessible without Admin authentication and enforce Content visibility rules in the application. The parent and descendant paths are explicit because Access wildcards do not cover their parent path.

## Environments

| Environment | Worker            | Database       | Purpose                                        |
| ----------- | ----------------- | -------------- | ---------------------------------------------- |
| local       | Local runtime     | Local D1 state | Local development, migration checks, and tests |
| production  | Production Worker | Production D1  | Public deployment                              |

The project uses a single Cloudflare Worker and a single Production D1 database. Local development uses Wrangler's local D1 state.

A Preview URL is the URL provided for a Worker version uploaded with `wrangler versions upload`. It is used to validate the version before it is deployed to Production and does not represent a separate Worker or D1 environment.

Preview versions use the same D1 binding as Production and must not perform operations that modify production data.

D1 migrations are validated locally and applied explicitly to Production D1 as part of the production deployment process. Worker versions do not version or isolate D1 storage state.

## Request Flow

1. A request reaches the SvelteKit Worker.
2. Admin paths pass through Cloudflare Access and the server hook checks the request identity and allowlist policy.
3. The route validates parameters and payloads using Zod schemas.
4. The application reads or writes D1 through Drizzle.
5. The route returns a documented response or the common API error shape.

## Source of Truth

- Persisted Content body: Markdown source text.
- API contract: Zod schemas.
- Database schema: Drizzle schema and generated migrations.
- Admin authentication boundary: Cloudflare Access plus `src/hooks.server.ts`.
- Architectural rationale: the ADRs in this directory.
