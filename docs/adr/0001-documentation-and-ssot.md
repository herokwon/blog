# ADR-0001: Documentation and SSoT

## Status

Accepted

## Context

The project is beginning its domain, database, API, and security work from an early scaffold.
Without an explicit source of truth, implementation details can diverge across schema, routes, UI, and deployment configuration.

## Decision

Document required behavior before implementation. Establish the following sources of truth:

- Architecture documents define current system behavior, boundaries, and architectural rules.
- ADRs record the rationale, alternatives, and consequences of important architectural decisions.
- Drizzle schema and migrations define the persisted database structure and migration history.
- Zod schemas define the machine-readable API request and response contracts and are used for runtime validation and OpenAPI generation.
- Persisted Markdown defines the Content body source of truth.

Architecture documents describe the intended current behavior, while implementation artifacts such as the Drizzle schema, migrations, and Zod schemas are the authoritative machine-readable definitions for their respective concerns. Derived values such as summary, rendered output, and editor state are not independent sources of truth.

Derived values such as summary, rendered output, and editor state are not independent sources of truth.

## Consequences

Design decisions are reviewable before code exists, and consumers share the same contract.
Documentation must be updated when an architectural rule changes.
