# ADR 0001: Organize project documentation by responsibility

- Date: 2026-09-30
- Status: Accepted

## Context

The existing CI/CD operating document needs a shared documentation structure
around it. Agreed architecture should guide implementation; separate
discussion specifications and plans would duplicate that design.

## Decision

Write documentation in English and organize it by responsibility:

| Location             | Responsibility                             |
| -------------------- | ------------------------------------------ |
| `docs/README.md`     | Documentation guide                        |
| `docs/adr/`          | Significant decisions and rationale        |
| `docs/architecture/` | Architecture, domain rules, and interfaces |
| `docs/operations/`   | Operating procedures, including CI/CD      |
| `docs/openapi.json`  | Future generated OpenAPI artifact          |

Reflect agreements immediately in subject documents, with explicit
implementation status where needed. Record significant decisions in ADRs
and link them to affected documents.

Maintain one authoritative location per rule or contract, linking from
other documents. Keep operations separate from architecture and do not add
`superpowers/` specifications or plans for the same design.

Create architecture documents and introduce OpenAPI generation as their
topics are agreed. This decision establishes locations and responsibilities,
not detailed designs or a generation mechanism.

## Consequences

A stable entry point and subject locations distinguish current design,
rationale, implementation progress, and procedures. Changes require updating
the relevant documents alongside decisions or implementation; ADR history
remains intact while subject documents track the current design.

OpenAPI automation must document its source and regeneration process.
The generated artifact must not become a separately maintained contract.
