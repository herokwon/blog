# ADR 0005: Post-owned Tags and Classification Editing

- Status: Accepted
- Date: 2026-11-10
- Related issue: https://github.com/herokwon/blog/issues/68
- Amends: [ADR 0004](0004-author-administration.md)

## Context

Shared tag records and cross-post suggestions imply a global taxonomy that the single author does not need. Persistent category forms and inline category creation also complicate post authoring. The owner approved a simpler category page and direct tag editing in a working prototype.

## Decision

- Manage categories exclusively on their dedicated page using native prompts for creation and renaming, an action menu, alerts for referenced deletion, and confirmation for unused deletion. Posts only select existing categories. Preserve server validation and all-state usage protection.
- Store tags directly as ordered post-owned rows: `post_tags(post_id, name, position)`, unique by post and name. Identical names in different posts have independent identity. Keep the limits of 20 tags per post and 40 Unicode characters per name, with case-sensitive duplicate comparison.
- Migrate every existing association and name, including internal spaces, into the new table. Initialize positions using the previous alphabetical read order. Unattached shared names are discarded. Applied migrations remain immutable.
- Keep `PostInput.tags` as an array of names. Save post and tag changes together in the existing atomic D1 batch, with every child mutation guarded by the new successful parent revision. No autosave or tag-only writes are introduced.
- A wrapping tag area opens input on activation, commits on Space, Enter or blur, and hides inactive inputs. Preserve IME composition, explicit chip editing/deletion, keyboard focus, dirty-state detection, failure retention and conflict export. New whitespace-delimited input splits into tags; unchanged legacy names remain intact.

## Consequences

Tag reads no longer require a shared-table join or global autocomplete. Schema and existing SQL fixtures must migrate together, and the migration must preserve attached data before removing old tables. Tags cannot be globally renamed; future global taxonomy would need a new decision. Category prompt operations and interactive tag editing require JavaScript, while supported native post saving and server authorization remain intact. This changes no publication, media, credential or production-delivery boundary.
