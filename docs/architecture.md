# Architecture

## Overview

This document provides a high-level overview of the system architecture.

Its purpose is to describe how the major components interact, define the architectural boundaries of the system, and establish a common understanding of the overall design.

Implementation details are intentionally omitted and documented elsewhere when necessary.

<br />

## Goals

The architecture is designed with the following goals:

- Keep the system simple and maintainable.
- Leverage Cloudflare's edge-native platform.
- Separate content management from content delivery.
- Minimize operational complexity.
- Support incremental evolution through documented architectural decisions.

<br />

## Technology Stack

|    **Area**     |     **Technology**     |
| :-------------: | :--------------------: |
|    Frontend     | Svelte 5 + SvelteKit 2 |
|    Language     |       TypeScript       |
|     Runtime     |   Cloudflare Workers   |
|    Database     |     Cloudflare D1      |
|       ORM       |      Drizzle ORM       |
|    Migration    |      Drizzle Kit       |
| Object Storage  |     Cloudflare R2      |
|     Testing     |  Vitest + Playwright   |
| Package Manager |          pnpm          |

<br />

## System Context

The project consists of two primary actors.

### Administrator

Administrators manage blog content through the administrative interface.

Administrative routes are protected by Cloudflare Access using GitHub authentication.

### Visitor

Visitors access published content through the public website.

Visitors have read-only access to published resources.

<br />

## High-Level Architecture

<div align="center">

```
GitHub
│
▼
Cloudflare Access
│
▼
SvelteKit Application
│
┌───────┴───────┐
▼               ▼
Cloudflare D1    Cloudflare R2
```

</div>

The application is deployed entirely on Cloudflare Workers.

Structured data is stored in Cloudflare D1, while uploaded media assets are stored in Cloudflare R2.

<br />

## Core Components

### Web Application

Provides both the public blog and the administrative interface.

### Content Management

Allows administrators to create, publish, archive, and manage content.

### Media Management

Stores and manages uploaded assets using Cloudflare R2.

### Persistence Layer

Stores structured application data using Cloudflare D1 through Drizzle ORM.

<br />

## Content Lifecycle

Content progresses through the following lifecycle.

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

## Media Lifecycle

Media assets are owned by content.

When content is permanently deleted, all associated media objects are immediately removed from Cloudflare R2.

No orphaned media should remain in storage.

<br />

## Security Overview

Administrative functionality is protected by Cloudflare Access.

Authentication is delegated to GitHub through Cloudflare Access.

Authorization policies are documented in `admin-security.md`.

<br />

## Architecture Decisions

Detailed architectural decisions are documented as Architecture Decision Records (ADRs).

This document intentionally avoids explaining the rationale behind decisions.

Refer to the `adr/` directory for decision history and reasoning.

<br />

## Related Documents

- `README.md`
- `domain/content.md`
- `domain/media.md`
- `admin-security.md`
- `operations/migrations-and-recovery.md`
- `adr/`
