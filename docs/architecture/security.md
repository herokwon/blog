# Security Architecture

## Admin Authentication

Cloudflare Access is the Admin authentication boundary. GitHub is the identity provider, and an email allowlist determines which authenticated identities may use Admin features.

Protection applies only to the following application paths on both Preview and Production URLs:

```text
/admin
/admin/*

/api/admin
/api/admin/*
```

The parent and descendant paths are listed separately because an Access wildcard does not cover its parent path. The `*` wildcard is used instead of a recursive `**` pattern.

Other paths on the Worker Version and production URLs are not globally protected by this policy. Public pages and APIs remain accessible and enforce Published/non-deleted visibility at the application layer.

## Request Handling

```text
Request
  -> Cloudflare Access for protected paths
  -> src/hooks.server.ts
  -> route-level validation and authorization
  -> application service and D1
```

`src/hooks.server.ts` centralizes the application request boundary for requests that reach the Worker. Protected-path matching is centralized through `requiresAdminAccess()` so that the UI and API use the same effective path coverage.

The protected paths are:

- `/admin`
- `/api/admin`

The path predicate matches each protected path itself and any descendant path. It must not treat unrelated paths with the same prefix as protected.

Unauthenticated requests may be handled by the Cloudflare Access login flow before reaching `src/hooks.server.ts`. The hook handles the application-level identity and authorization checks for requests that reach the Worker.

Authentication state is request-scoped and must not be stored in mutable global state.

UI authentication failures follow the Cloudflare Access login flow. Admin API requests that reach the application and fail authentication or authorization checks return JSON `401` or `403` responses rather than an HTML redirect.

## Authorization Scope

The initial system has one Admin role represented by the email allowlist. There are no role or permission tables until a concrete multi-user requirement exists.

## API Security Errors

```json
{
  "error": {
    "code": "FORBIDDEN",
    "message": "Administrator access is required"
  }
}
```

Use `UNAUTHORIZED` when authentication is missing or invalid and `FORBIDDEN` when an authenticated identity is not allowed to access the Admin boundary.
