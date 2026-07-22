# ADR-0001: Protect the Administrative Boundary with Cloudflare Access

## Status

Accepted

<br />

## Context

The project provides an administrative interface under the `/admin` path.

Administrative functionality requires authentication, but implementing and maintaining an application-managed authentication system would introduce additional operational complexity.

The project aims to minimize operational overhead and allow the application to focus on business functionality rather than identity management.

Several approaches were considered, including implementing authentication within the application and delegating authentication to an external identity-aware access layer.

<br />

## Decision

The administrative boundary (`/admin/**`) is protected by Cloudflare Access.

Cloudflare Access authentications administrators using GitHub as the identity provider before requests reach the application.

The application does not implement its own authentication mechanism and instead trusts requests that have successfully passed Cloudflare Access.

<br />

## Consequences

### Positive

- Reduces operational complexity by delegating authentication to Cloudflare Access.
- Eliminates the need to implement and maintain OAuth, session management, and multi-factor authentication within the application.
- Prevents unauthenticated requests from reaching the administrative application.
- Allows the application to focus on business logic rather than identity management.
- Integrates naturally with the Cloudflare platform used by the project.

### Negative

- Administrative access depends on Cloudflare Access availability.
- The project becomes more tightly coupled to the Cloudflare platform.
- Migrating to another edge platform would require revisiting this decision.

<br />

## Alternatives Considered

### Application-managed Authentication

Implement authentication directly within the application using OAuth and session management.

Rejected because it increases implementation effort, operational complexity, and long-term maintenance responsibilities.

### Reverse Proxy Authentication

Protect the administrative interface using an external reverse proxy or gateway.

Rejected because Cloudflare Access already provides an integrated solution that aligns with the project's hosting platform.

<br />

## References

- `docs/admin-security.md`
- [Secure with Cloudflare Access · Cloudflare for Platform docs](https://developers.cloudflare.com/cloudflare-for-platforms/cloudflare-for-saas/security/secure-with-access)
