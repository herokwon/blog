# ADR 0002: Use a single Post entity

- Date: 2026-10-03
- Status: Accepted

## Context

A single author manages draft, published, archived, and deleted articles.
The system needs to distinguish public withdrawal from deletion while
preserving article identity and publication history.

## Decision

Use one `Post` entity stored in `posts` across all lifecycle states, with no separate
public and working copies.

Represent the publishing lifecycle with `draft`, `published`, and
`archived`. Represent soft deletion independently through `deleted_at`.

Archiving retains an article privately without deleting it. Soft deletion
preserves its status and publication history; restoration clears
`deleted_at` and retains the previous status.

Public visibility requires `status = 'published' AND deleted_at IS NULL`.

[Content Domain](../architecture/content-domain.md) defines lifecycle,
visibility, identity, and restoration rules.
[Database Foundation](../architecture/database-foundation.md) defines
storage constraints.

## Alternatives

Comparison alternatives, not a record of earlier evaluation:

- Separate entities for drafts and published articles would require
  synchronization and additional identity management.
- Representing deletion as another lifecycle status would combine
  publication state with deletion and require preserving the previous
  status separately for restoration.

## Consequences

- An article retains its identity across publication, archiving,
  deletion, and restoration.
- Soft deletion requires future decisions about retention and permanent
  cleanup; those policies are outside this decision.
- This accepted design does not imply that post persistence is
  implemented.
