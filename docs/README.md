# Documentation guide

Documentation under `docs/` records the agreed design, decision rationale,
and operating procedures used for planning and implementation. Write it
in English.

## Structure and Reading Order

| Location             | Responsibility                                                           |
| -------------------- | ------------------------------------------------------------------------ |
| `docs/README.md`     | Structure, reading order, and maintenance rules                          |
| `docs/adr/`          | Significant decisions, context, alternatives, and consequences           |
| `docs/architecture/` | Components, responsibilities, domain rules, interfaces, and interactions |
| `docs/operations/`   | Development, verification, release, deployment, and operating procedures |
| `docs/openapi.json`  | Future generated OpenAPI artifact; not yet present                       |

Start with the overview, then read the relevant domain or interface document.
Follow ADRs for rationale and operating documents for procedures.

- [Architecture overview](architecture/overview.md)
- [Content domain](architecture/content-domain.md)
- [API design](architecture/api-design.md)
- [Database foundation](architecture/database-foundation.md)
- [Deployment](architecture/deployment.md)
- [Security](architecture/security.md)
- [ADR 0001: Organize project documentation by responsibility](adr/0001-organize-project-documentation.md)
- [ADR 0002: Use a single Post entity](adr/0002-use-a-single-content-entity.md)
- [ADR 0003: Use explicit save and publication](adr/0003-use-explicit-save-and-publication.md)
- [CI/CD operations](operations/ci-cd.md)

Create additional documents and directories as their contents are agreed.

## Maintenance

Keep each rule or contract in one authoritative location and link to it
elsewhere. Architecture documents describe current agreed designs, ADRs
preserve rationale, and operating documents describe procedures.

Label implementation status as `Planned`, `Partially implemented`, or
`Implemented`; acceptance of a design does not mean it is implemented.

1. Discuss and agree on changes.
2. Update subject documents immediately; add an ADR for significant decisions.
3. Implement and verify against the agreed documentation.
4. Update implementation status and procedures as needed.

If implementation requires a design change, resolve and document it before
proceeding. Use issues and pull requests for tasks and progress; do not add
separate `superpowers/` specifications or plans for the same design.

When OpenAPI automation is introduced, document its authoritative inputs
and regeneration process. Update those inputs and regenerate the artifact
rather than maintaining another contract by hand.

## Architecture Decision Records

Use sequential filenames such as `0001-organize-project-documentation.md`.
Each ADR includes a title, date, status, context, decision, and consequences;
include alternatives when useful.

Record decisions with lasting effects on architecture, interfaces, data,
or operations. Routine implementation details do not require an ADR.

Statuses are `Proposed`, `Accepted`, `Rejected`, and `Superseded`.
When replacing an accepted decision, create a new ADR, mark the old one
`Superseded`, link both, and update the subject documents. Preserve the
original rationale.
