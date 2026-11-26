# ADR 0003: Administrator post management for 0.2.0

- Status: Accepted
- Date: 2026-11-24
- Related issue: [#32](https://github.com/herokwon/blog/issues/32)

## Context

[ADR 0001](0001-initial-blog-architecture.md) established a single administrator,
Markdown storage, and a publication lifecycle. The current `/admin` route
confirms authentication. Version 0.2.0 adds writing and post management in the
protected administrator area. Visitor-facing post pages, media uploads, and
permanent deletion are deferred.

## Decision

### Post lifecycle and classification

Require a title and one category for every post. Allow an empty body only for
drafts. New posts may start as `draft` or `published`. Existing posts may move
from `draft` to `published`, from `published` to `archived`, or from `archived`
to `published`. Saving preserves the current status. Status changes from the
detail page use the stored content and the submitted version.

Store soft deletion in nullable `deleted_at`, independently of publication
status. Deleted posts appear in the administrator trash and are excluded from
ordinary list, detail, and edit queries. Restoring clears `deleted_at` and
preserves publication status, content, classification, and first publication
time. Both operations update the modification time and version.

Allow the administrator to create and rename categories and delete unused ones.
The required `posts.category_id` foreign key protects categories referenced by
any post, including posts in the trash. Store optional tags in `tags` with a
composite primary key on `(post_id, name)`. Trim surrounding whitespace, normalize
to NFC, and convert ASCII letters to lowercase before validation. Allow only
precomposed Hangul syllables, ASCII lowercase letters, and ASCII digits. Reject
duplicates within a post and allow the same tag on different posts.

Limit category names to 30 Unicode code points after trimming and new tag sets
to ten tags. Existing posts above the tag limit can keep or remove their saved
tags. Category counts include all publication states and exclude the trash.

### Storage and consistency

Use D1 and Drizzle. Generate UUIDv7 post IDs with `uuid` on the server and store
them as `TEXT`. Order the administrator list by `updated_at` descending, then
`id` descending. Store Markdown source in `body` and use `version` for optimistic
concurrency. Keep a new post's ID stable across submission retries.

Store UTC Unix epoch milliseconds as `INTEGER` and map them through Drizzle's
`timestamp_ms` mode. Give `created_at` and `updated_at` the SQL default
`CAST(unixepoch('subsec') * 1000 AS INTEGER)` and require both columns. Set
`published_at` on first publication and preserve it after archiving or
republication. Use one timestamp for creation, modification, and publication
when a post starts as published.

Save posts and tags in one D1 batch. During updates, guard tag writes and the
post update with the same version and deletion conditions so a stale submission
cannot modify either record set. Deliver the schema as an additive migration
under [ADR 0002](0002-infrastructure-and-delivery.md).

### Administrator interface and rendering

After authentication, return a `302` redirect from `GET /admin` to
`/admin/posts`. Place the list, creation, detail, and edit pages under that path.
Provide separate pages at `/admin/categories` and `/admin/trash`. Use SvelteKit
server loads and form actions under the existing Access and `no-store` protection.
Cancel returns to the post list without saving, or to the same post's detail
page when editing was opened from there. Use Milkdown Crepe for editing,
with a plain Markdown field if the editor cannot initialize.

Render the saved Markdown on the server for the administrator detail page. Disable
raw HTML and sanitize the output with an allowlist. Cover the Markdown syntax
enabled in the editor with rendering tests. Keep the Markdown source as the
stored representation so rendering rules can evolve independently of the database.

## Alternatives considered

- Crepe in read-only mode would preserve the editor's appearance by mounting a
  browser editor view. That approach would still require a content policy.
- A shared tag catalog would add a tag lifecycle and management screen. Post-owned
  tags satisfy the current requirement for per-post uniqueness.

## Consequences

The administrator creates a category before saving the first post. Trash entries
remain restorable and retain their category references. The renderer and editor
need shared syntax coverage. Verify the domain and storage against local D1
before connecting screens, then verify the authenticated workflow in Preview.

## References

- [RFC 9562 UUIDv7](https://www.rfc-editor.org/rfc/rfc9562.html#section-5.7)
- [D1 batch transactions](https://developers.cloudflare.com/d1/worker-api/d1-database/#batch)
- [SvelteKit form actions](https://svelte.dev/docs/kit/form-actions)
- [Milkdown Crepe editor guide](https://github.com/Milkdown/website/blob/main/docs/guide/interacting-with-editor.md)
- [Markdown rendering security](https://github.com/remarkjs/remark-rehype#security)
