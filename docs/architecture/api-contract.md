# API Contract

## Resource Boundaries

Public endpoints use `slug` as the external identifier. Admin endpoints use the internal UUIDv7 `id`.

### Public

```text
GET /api/contents
GET /api/contents/:slug
```

Only Content with `status = published` and `deleted_at IS NULL` is visible.

### Admin

```text
GET /api/admin/contents
POST /api/admin/contents
GET /api/admin/contents/trash
GET /api/admin/contents/:id
PATCH /api/admin/contents/:id
DELETE /api/admin/contents/:id
POST /api/admin/contents/:id/archive
POST /api/admin/contents/:id/publish
POST /api/admin/contents/:id/restore
```

The normal Admin list returns all non-deleted statuses. The trash list returns all deleted Content. `DELETE` performs soft deletion.

## Commands

- `publish` assigns slug and `published_at` only on the Content's first publication, whether invoked during creation or through a successful transition from draft to published.
- `archive` transitions Published to Archived.
- `restore` clears `deleted_at` and restores the status held before deletion.

Invalid transitions return `409 Conflict` with error code `INVALID_CONTENT_STATE`.

## Cursor Pagination

All list endpoints use an opaque `cursor` and bounded `limit`.

```json
{
	"items": [],
	"nextCursor": "opaque-cursor-or-null"
}
```

Ordering is deterministic:

- Public: `published_at DESC, id DESC`.
- Admin and Trash: `updated_at DESC, id DESC`.

The ID is a tie-breaker. The cursor may encode the ordering values but must remain opaque to clients.

## Contracts and Errors

Zod schemas are the single source for path parameters, query parameters, request bodies, responses, and generated OpenAPI definitions.

Errors use:

```json
{
	"error": {
		"code": "CONTENT_NOT_FOUND",
		"message": "Content was not found.",
		"details": {}
	}
}
```

Representative codes are `VALIDATION_ERROR`, `UNAUTHORIZED`, `FORBIDDEN`, `CONTENT_NOT_FOUND`, `INVALID_CONTENT_STATE`, `SLUG_CONFLICT`, and `INTERNAL_ERROR`.
