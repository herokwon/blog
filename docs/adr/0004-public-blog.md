# ADR 0004: Public blog pages and publication visibility

- Status: Accepted
- Date: 2026-11-28
- Related issue: [#51](https://github.com/herokwon/blog/issues/51)

## Context

The administrator can already publish, archive, delete, and restore Markdown
posts. Version 0.3.0 gives readers a home, post permalinks, and topic archives.

## Decision

Use server-rendered pages at `/`, `/posts/{id}`, `/categories/{id}`, and
`/tags/{name}`. Post IDs and category IDs survive changes to display names.
Post-owned tags use the existing normalized name as their public identifier.
Serve lists in pages of 20 ordered by first publication time and then post ID,
both descending. Link to the first page without a query parameter.

Require published status and a null deletion time in every public post query.
Return 404 for unavailable posts or topics and 503 for a failed data lookup.
Render the existing HTML allowlist on the server and retain the root layout's
`no-store` policy. Link the public and administrator details for published posts.
The public shortcut uses the existing session display state, and access to the
administrator destination continues to require server authorization.

## Consequences

The existing data model and publish workflow support these pages without a
migration. Public and administrator reads enforce distinct visibility rules.
Publishing or restoring a post through the existing lifecycle changes public
visibility on the next request while preserving its permalink and first
publication time.

## References

- [Pagination](https://design-system.service.gov.uk/components/pagination/)
- [SvelteKit link options](https://svelte.dev/docs/kit/link-options)
- Modern Web Guidance: HTML, accessibility, and sanitizing untrusted HTML
