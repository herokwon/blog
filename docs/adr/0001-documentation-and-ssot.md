# ADR-0001: Documentation and SSoT

## Status

Accepted

## Context

The project is beginning its domain, database, API, and security work from an early scaffold.
Without an explicit source of truth, implementation details can diverge across schema, routes, UI, and deployment configuration.

## Decision

Document required behavior before implementation. Use the following sources of truth:

- Architecture documents for current system rules and interfaces.
- ADRs for the rationale behind important architectural choices.
- Drizzle schema and migrations for database structure.
- Zod schemas for API request and response contracts.
- Persisted Markdown for Content body data.

Derived values such as summary, rendered output, and editor state are not independent sources of truth.

## Consequences

Design decisions are reviewable before code exists, and consumers share the same contract.
Documentation must be updated when an architectural rule changes.
