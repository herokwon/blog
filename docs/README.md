# Architecture Documentation Guide

## Overview

This directory contains the architecture documentation for the project.

The goal of this documentation is to provide enough architectural context to understand, maintain, and evolve the system without introducing unnecessary documentation overhead.

Documentation should support implementation—not replace it.

<br />

## Documentation Principles

The architecture documentation follows these principles.

### Keep Documentation Minimal

Documentation should contain only information that helps developers understand the architecture or make design decisions.

Avoid documenting implementation details that are already expressed clearly in code.

### Code is the Source of Truth

Implementation details belong in the source code.

Documentation exists to explain architectural intent, system boundaries, and design decisions.

When documentation conflicts with code, the code takes precedence until the documentation is updated.

### Record Decisions with ADRs

Every significant architectural decision must be documented as an Architecture Decision Record (ADR).

Architecture documents describe **what** the system is.

ADRs explain **why** the system was designed that way.

### Evolve Documentation with the System

Documentation is expected to evolve together with the project.

Architecture documentation should be updated whenever architectural changes are introduced.

Small, incremental updates are preferred over large documentation rewrites.

<br />

## Documentation Structure

```
docs/
├── README.md
├── architecture.md
├── domain/
│ ├── content.md
│ └── media.md
├── admin-security.md
├── operations/
│ └── migrations-and-recovery.md
└── adr/
```

<br />

## Document Responsibilities

### architecture.md

Describes the overall system architecture.

Typical contents include:

- System overview
- High-level architecture
- Major components
- Data flow
- External services

### domain/

Defines the project's core business domains.

Each document explains the business concepts, responsibilities, and lifecycle of a specific domain.

Current domains:

- Content
- Media

### admin-security.md

Documents administrator authentication and security policies.

Examples include:

- Cloudflare Access
- Authentication boundary
- Authorization strategy
- Administrative access

### operations/

Documents operational precedures that support the system.

Examples include:

- Data migrations
- Recovery procedures
- Release process
- Backup strategy

### adr/

Stores Architecture Decision Records.

Each ADR documents:

- Context
- Decision
- Consequences
- Alternatives Considered

Every ADR is immutable after acceptance except for editorial corrections.

<br />

## Documentation Boundaries

The following information belongs in documentation:

- Architecture
- System boundaries
- Domain rules
- Security policies
- Operational procedures
- Design decisions

The following information should remain in code:

- Business logic
- Database schema
- ORM models
- API implementation
- Framework configuration
- Tests

Avoid duplicating implementation details in documentation.

<br />

## Writing Guidelines

When adding or updating documentation:

- Keep documents concise.
- Prefer diagrams only when they improve understanding.
- Link to related documents instead of duplicating content.
- Update documentation in the same change whenever practical.
- Create an ADR for every significant architectural decision.

Documentation should be easy to maintain and inexpensive to keep up to date.

<br />

## Future Expansion

This documentation structure is intentionally minimal.

Additional documents should be introduced only when they provide clear value to the project.

The documentation should grow with the architecture—not ahead of it.
