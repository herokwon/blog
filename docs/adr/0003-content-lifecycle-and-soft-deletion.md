# ADR-0003: Content Lifecycle and Soft Deletion

## Status

Accepted

## Context

The blog needs draft, publication, archival, and recovery without losing publication history or allowing ambiguous state changes.

## Decision

Use three statuses:

```text
Create
├─> Draft ──────> Published ──────> Archived
└─> Published ─────────────────────> Archived
```

A Content can be created either as `Draft` or directly as `Published`.

`Draft → Archived`, `Published → Draft`, and `Archived → Draft` are forbidden. Deletion is independent of status and uses `deleted_at` for soft deletion. Delete preserves status, slug, and `published_at`; restore clears `deleted_at` and returns the Content to its pre-deletion status.

Persist `created_at`, `published_at`, `updated_at`, and `deleted_at` as UTC ISO 8601 values. `created_at` and `published_at` are immutable timestamps set once at creation and publication. `updated_at` changes for content and lifecycle changes.

## Alternatives Considered

- Allowing Draft to transition directly to Archived would give an unpublished item a state intended for published history.
- Permanent deletion would prevent recovery and lose lifecycle information.
- Resetting deleted items to Draft would lose their prior state and publication history.

## Consequences

The lifecycle is explicit and recoverable. UI and API commands must reject invalid transitions, and list queries must consistently distinguish normal and trash data using `deleted_at`.
