# Architecture Overview

## Purpose and Status

The Blog is a personal publishing application for one author to record
learning, project experience, and occasional personal notes. The author
manages content through Admin; readers use the Public interface.

Both share one SvelteKit application on Cloudflare Workers, with relational
data stored in Cloudflare D1 through Drizzle ORM.

The application foundation, D1 integration, testing, and CI/CD are
`Implemented`. Post persistence, publishing, Public and Admin interfaces,
and Admin authentication are `Planned`. The current schema contains an
example `task` table, not the content schema. Repository configuration alone
does not confirm verified production resources or security policies.

## v0.2.0 Delivery Scope

v0.2.0 targets Admin authentication, Admin APIs and UI, post persistence,
and the full management lifecycle: creation, explicit saving, editing,
publication, archiving, soft deletion, trash listing, and restoration.
Admin also includes a persisted-content detail page for reading saved posts
and receiving successful save/publication navigation; see
[Content Domain](content-domain.md#admin-detail).
Public APIs and UI are deferred to a later version. Publication state,
slug generation, and publication timestamps are included in this scope;
validation through Public interfaces follows when those interfaces exist.
Tags, series, and media uploads remain outside this release.

All content features in this scope remain `Planned` until implemented
and verified.

## Technology Stack

| Area                 | Technology                                         | Status      |
| -------------------- | -------------------------------------------------- | ----------- |
| Application          | SvelteKit 2, Svelte 5, TypeScript                  | Implemented |
| Runtime              | Cloudflare Workers and Cloudflare adapter          | Implemented |
| Static assets        | Workers Static Assets                              | Implemented |
| Database integration | Cloudflare D1 and Drizzle ORM                      | Implemented |
| Schema tooling       | Drizzle Kit and Wrangler migrations                | Implemented |
| Styling              | Tailwind CSS and Typography                        | Implemented |
| Testing              | Vitest and Playwright                              | Implemented |
| Admin protection     | Cloudflare Access and server identity verification | Planned     |
| API contracts        | Zod request/response schemas                       | Planned     |
| API documentation    | OpenAPI generation from contracts                  | Planned     |
| Admin authoring      | Milkdown                                           | Planned     |

Milkdown Crepe provides formatted Admin editing with the authoring features
defined in Content Domain. OpenAPI automation is future
work, with no generated `docs/openapi.json` yet.

## Runtime Boundaries

The planned content architecture is:

```text
Public pages / API -> Public routes -> Public visibility rules -> Drizzle -> D1

Admin pages / API -> Cloudflare Access (deployed) or local test identity
                 -> Server authentication and authorization
                 -> Admin routes -> Post rules and storage -> Drizzle -> D1
```

Public access requires no Admin authentication. Post rules govern saving,
publication, withdrawal, and visibility. Browsers never access D1 directly;
server storage uses its binding through Drizzle.

Public visibility requires `status = published AND deleted_at IS NULL`,
excluding draft, archived, and deleted content. See the
[content domain](content-domain.md) for lifecycle and visibility rules.

Cloudflare Access will protect `/admin`, `/admin/*`, `/api/admin`, and
`/api/admin/*` on production and Version URL hostnames. Both parent and
descendant paths are explicit because Access wildcards do not cover the
parent path. Public paths remain accessible without Admin authentication.

Identity verification is planned in the unimplemented `src/hooks.server.ts`.
See [Security](security.md) for JWT verification, authorization, and
the local-only test identity policy.

## Environments

| Environment | Runtime                   | Database                | Purpose                                               |
| ----------- | ------------------------- | ----------------------- | ----------------------------------------------------- |
| Local       | Local development runtime | Wrangler local D1 state | Development, write-flow testing, migration validation |
| Production  | Deployed Worker version   | Configured remote D1    | Public service                                        |

The configuration defines one Worker and one remote D1 database. CI/CD
uploads release candidates before deployment; their Version URLs expose
uploaded versions without creating separate Workers or databases. See
[Deployment](deployment.md#runtime-and-environments) for terminology and
candidate environment details.

Candidate versions share production's remote D1 binding. Worker versions
do not isolate or version database state.

The planned Version URL policy permits read-only validation. The application
must block mutations; the shared binding does not enforce this. Save,
publish, withdrawal, and migration behavior are validated locally.

Production migrations run before Worker deployment in the release promotion
workflow. See [CI/CD operations](../operations/ci-cd.md) for procedures.

## Planned Request Flow

1. A dynamic request reaches the SvelteKit Worker.
2. Admin requests use Access JWT verification and the email allowlist on
   production and Version URLs, or an explicitly enabled local test identity
   with local D1.
3. After authentication and authorization, Admin mutation requests enforce
   the Version URL read-only policy and server-side request-origin checks.
4. Zod validates parameters and payloads; Post rules determine visibility
   and permitted actions.
5. Server storage reads or writes D1 through Drizzle.
6. The route returns a rendered page or a Zod-contract API response.

Admin saves and publication are explicit. Saving published content updates
the public article without autosave or a separate working copy.

## Sources and Related Documents

| Subject            | Authoritative source                                                         |
| ------------------ | ---------------------------------------------------------------------------- |
| Post body          | Persisted Markdown source, Planned                                           |
| API contract       | Zod schemas, Planned; OpenAPI is generated from them                         |
| Database structure | [Drizzle schema](../../src/lib/server/db/schema.ts) and generated migrations |
| Runtime bindings   | [wrangler.jsonc](../../wrangler.jsonc)                                       |
| CI/CD procedures   | [CI/CD operations](../operations/ci-cd.md)                                   |
| Decision rationale | [ADRs](../adr/)                                                              |

Subject documents record the agreed design with explicit implementation
status. Follow the [documentation guide](../README.md) when changing decisions.

- [Content domain](content-domain.md): entity, validation, lifecycle,
  deletion, restoration, and slug rules.
- [API design](api-design.md): endpoints, contracts, responses, errors,
  and retry behavior.
- [Database foundation](database-foundation.md): storage, constraints,
  timestamps, indexes, mutation consistency, and migrations.
- [Deployment](deployment.md): environments, candidate promotion,
  hotfix policy, releases, reporting, and recovery.
- [Security](security.md): authentication, authorization, request-origin
  checks, rendering safety, and Admin response caching.

Tags, series, R2 media, search, RSS, and SEO are follow-up areas whose detailed
designs are outside this overview.

## References

- [Cloudflare Version URLs](https://developers.cloudflare.com/workers/versions-and-deployments/version-urls/)
- [Cloudflare Access application paths](https://developers.cloudflare.com/cloudflare-one/access-controls/policies/app-paths/)
