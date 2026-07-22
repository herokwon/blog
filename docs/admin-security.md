# Admin Security

## Overview

This document defines the security model for the administrative area of the application.

Its purpose is to establish the security boundary, authentication model, and administrative access policy without describing implementation details.

<br />

## Security Boundary

The administrative interface is exposed under the `/admin` path.

All routes within this boundary require successful administrator authentication before access is granted.

Public routes remain accessible without authentication.

<br />

## Authentication

Administrator authentication is delegated to Cloudflare Access.

Cloudflare Access authenticates administrators using GitHub as the identity provider.

The application trusts requests that have already passed Cloudflare Access.

Authentication logic is not implemented within the application itself.

<br />

## Authorization

Only authenticated administrators are permitted to access administrative functionality.

Visitors are not authorized to access any route within the administrative boundary.

The current authorization model distinguishes only two roles:

- Administrator
- Visitor

More granular authorization may be introduced in the future if required.

<br />

## Trust Boundary

Authentication is enforced before requests reach the application.

The application assumes that every request to the administrative boundary has already been authenticated by Cloudflare Access.

This establishes a clear trust boundary between the edge security layer and the application.

<br />

## Security Principles

The administrative security model follows these principles.

- Authentication is handled outside the application.
- Administrative functionality is isolated from public functionality.
- Security responsibilities are separated from business logic.
- Security policies remain independent of application implementation details.

<br />

## Future Evolution

The current security model is intentionally simple.

Future architectural decisions may introduce additional capabilities such as:

- Multiple administrator roles
- Fine-grained authorization
- Audit logging
- Administrative activity history

Any significant changes to the security model should be documented through an Architecture Decision Record (ADR).
