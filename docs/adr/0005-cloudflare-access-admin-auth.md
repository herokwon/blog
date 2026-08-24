# ADR-0005: Cloudflare Access Admin Authentication

## Status

Accepted

## Context

Admin pages and mutation APIs require a consistent authentication boundary. The project is deployed on Cloudflare Workers and should use the same policy in local-connected and Production workflows without introducing an application-managed password system.

## Decision

Use Cloudflare Access with GitHub as the identity provider and an email allowlist for Admin access. Protect only the following paths on both Preview and Production URLs:

- `/admin`
- `/admin/*`
- `/api/admin`
- `/api/admin/*`

The parent and descendant paths are separate because an Access wildcard does not cover its parent path. Keep public APIs outside this Access path policy.

After Access authentication, `src/hooks.server.ts` provides the common application request boundary and passes request-scoped identity information to Admin routes. Unauthenticated requests may be handled by the Access login flow before reaching the Worker. Requests that reach the application and fail its checks return JSON `401` or `403` responses for Admin APIs; UI failures follow the Access login flow.

## Alternatives Considered

- Application-managed sessions and passwords would duplicate identity, password and recovery responsibilities.
- Protecting the entire Preview or Production URL would unnecessarily restrict public content.
- Per-route authentication logic would make it easier for a new Admin route to omit the required policy.

## Consequences

Admin access is centralized at the edge and application boundary, with a small initial authorization model. Preview and Production must both configure Access path policies and the correct email allowlist. Local development must use an Access-compatible workflow when exercising protected routes.
