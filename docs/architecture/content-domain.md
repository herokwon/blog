# Content Domain

## Entity

Content represents a blog article and has the following persisted fields:

| Field          | Rule                                                              |
| -------------- | ----------------------------------------------------------------- |
| `id`           | UUIDv7 identifier                                                 |
| `title`        | Required title text                                               |
| `body`         | Required Markdown source text                                     |
| `status`       | `draft`, `published`, or `archived`                               |
| `slug`         | Nullable before first publish; immutable and unique after publish |
| `created_at`   | Set on creation; immutable afterward; UTC ISO 8601                |
| `published_at` | Nullable until first publish; immutable afterward; UTC ISO 8601   |
| `updated_at`   | Updated for content and lifecycle changes; UTC ISO 8601           |
| `deleted_at`   | Nullable soft-deletion timestamp; UTC ISO 8601                    |

## Status Lifecycle

Content may be created in either `draft` or `published` state and may later be archived:

```text
Create
├─> Draft ──────> Published ──────> Archived
└─> Published ─────────────────────> Archived
```

Allowed transitions:

- `Draft -> Published`
- `Published -> Archived`

Forbidden transitions:

- `Draft -> Archived`
- `Published -> Draft`
- `Archived -> Draft`

Deletion is independent of status. A deleted item retains its status, slug, and `published_at`. Restore clears `deleted_at` and returns the item to the status it had immediately before deletion. This allows deleted Draft, Published, and Archived items to be restored correctly.

## Timestamps

- `published_at` is set immediately before the first successful publish and is never changed afterward.
- `updated_at` changes when title/body changes or when publish, archive, delete, or restore changes the Content lifecycle.
- `deleted_at` is set by soft deletion and cleared by restore.
- All timestamps are stored and returned as UTC ISO 8601 values.

## Slug

Slug generation occurs immediately before the first publish. Draft title edits do not generate or reserve a final slug.

The normalizer:

- preserves Unicode letters and numbers.
- converts separators to `-`.
- preserves explicitly allowlisted symbols such as `+`.
- removes URL delimiters such as `/`, `?`, and `#`.
- collapses repeated separators and trims leading/trailing separators.
- rejects or handles an empty result with an explicit publish validation error.

The database enforces uniqueness. A collision receives a suffix such as `-2`. After first publish, the slug does not change when the title changes.

## Summary

Summary is a derived response value, not a database field. The Markdown pipeline extracts visible text, excludes code blocks and other non-display elements, and limits the result to approximately 300 characters. Public rendering and summary extraction must use the same parsing policy.
