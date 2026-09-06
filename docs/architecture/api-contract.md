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

## Create Content

`POST /api/admin/contents` accepts only `title` and `body`.

```json
{
  "title": "Hello World",
  "body": "# Hello World"
}
```

The request does not accept `status`, `slug`, `published_at`, or `deleted_at`.
Content is always created as Draft.

```text
POST /api/admin/contents
        │
        ├── title
        └── body
              ↓
           Draft
              ↓
POST /api/admin/contents/:id/publish
              ↓
         Published
```

## Update Content

`PATCH /api/admin/contents/:id` accepts one or both of:

- `title`
- `body`

At least one field must be provided.

Lifecycle fields such as `status`, `slug`, `published_at`, and `deleted_at` cannot be modified through PATCH. Lifecycle changes must use their dedicated endpoints.

## Commands

- `POST /api/admin/contents` always creates Content in `draft` state.
- `publish` transitions Draft to Published and assignes slug and `published_at` on the Content's first publication.
- `archive` transitions Published to Archived.
- `restore` clears `deleted_at` and restores the status held before

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

## Success Responses

Single-resource responses return the resource representation directly.

There is no global `data` envelope for successful responses.

## Contracts and Errors

Zod schemas are the single source for path parameters, query parameters, request bodies, responses, and generated OpenAPI definitions.

Errors use:

```json
{
  "error": {
    "code": "VALIDATION_ERROR",
    "message": "Request validation failed.",
    "details": [
      {
        "path": ["title"],
        "message": "title is required."
      }
    ]
  }
}
```

Representative codes are `VALIDATION_ERROR`, `UNAUTHORIZED`, `FORBIDDEN`, `CONTENT_NOT_FOUND`, `INVALID_CONTENT_STATE`, `SLUG_CONFLICT`, and `INTERNAL_ERROR`.
