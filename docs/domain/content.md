# Content Domain

## Overview

The Content domain represents the core business entity of the blog.

It defines how content is created, managed, published, archived, and presented throughout its lifecycle.

This document describes the business rules of the Content domain without referencing implementation details.

<br />

## Responsibilities

The Content domain is responsible for:

- Managing the lifecycle of blog content.
- Maintaining published and unpublished content.
- Defining the state transitions of content.
- Associating media assets with content.
- Serving as the primary source of published information.

The Content domain does not define authentication, storage implementation, or media lifecycle policies.

<br />

## Lifecycle

Every content item progresses through the following states.

```
Draft
  ├────────► Published ◄────────┐
  │              │              │
  │              ▼              │
  └────────►  Archived  ────────┘
```

Allowed transitions:

- Draft → Published
- Draft → Archived
- Published → Archived
- Archived → Published

The following transitions are not permitted:

- Published → Draft
- Archived → Draft

<br />

## Business Rules

The Content domain follows these rules.

- Every content item has exactly one lifecycle state.
- Only published content is publicly accessible.
- Draft content is visible only to administrators.
- Archived content is excluded from public access.
- Content may reference zero or more media assets.

Business rules remain independent of infrastructure and implementation details.

<br />

## Ownership

The Content domain owns its associated media references.

Media assets may exist independently in storage, but their association with content is managed by the Content domain.

Deletion behavior is documented separately in the Media domain.

<br />

## Relationships

The Content domain interacts with:

|  **Domain**   | **Relationship**                 |
| :-----------: | -------------------------------- |
|     Media     | References uploaded media assets |
| Administrator | Creates and manages content      |
|    Visitor    | Reads published content          |

Additional relationships may be introduced as the project evolves.

<br />

## Boundaries

The Content domain is responsible for business behavior.

The following concerns are intentionally outside its scope:

- Authentication
- Authorization
- Database schema
- Object storage
- Deployment
- Search indexing

These concerns are documented elsewhere.
