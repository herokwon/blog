# ADR 0003: Use explicit save and publication

- Date: 2026-10-03
- Status: Accepted

## Context

The author needs direct control over when content is saved and published.
Under [ADR 0002](0002-use-a-single-content-entity.md), published articles
have no separate working copy; save behavior must make its public effect clear.

## Decision

Require explicit saves without autosave.

Always create content in `draft` status. Even immediate publication uses
a separate publication command with the created ID.

Publication operates on persisted content and does not save unsaved
editor changes. First publication establishes `published` status, the
slug, and the first publication timestamp atomically.

Saving published content updates its public content immediately.
Saving archived content keeps it private.

Distinguish creation failure from publication failure. Preserve editor
input after creation failure and retain the existing draft ID for
publication retries when creation succeeded. Do not report publication
success before confirmation.

[Content Domain](../architecture/content-domain.md) defines validation,
save behavior, and publication rules.
[API Design](../architecture/api-design.md) defines commands, errors,
and retry contracts.

## Alternatives

Comparison alternatives, not a record of earlier evaluation:

- Autosave would persist changes without an explicit save action.
- Separate public and working copies would allow private revisions of
  published articles but require synchronization and promotion rules.
- A combined creation-and-publication request would couple draft
  persistence and publication rather than expose their separate outcomes.

## Consequences

- The system avoids synchronizing separate public and working copies.
- Changes to a published article cannot be saved as a private revision.
- Immediate publication can leave a successfully created draft when
  publication fails; the UI must communicate that outcome.
- Retries must respect the API's duplicate-creation and already-satisfied
  command rules.
- Version history and a dedicated preview page remain outside this decision.
  Acceptance does not imply that the flow is implemented.
