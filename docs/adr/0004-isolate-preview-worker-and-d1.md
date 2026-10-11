# ADR 0004: Isolate the Preview Worker and D1

- Date: 2026-10-11
- Status: Accepted

## Context

Release candidate Version URLs currently use the Production Worker's D1
binding and are read-only. v0.2.1 needs authenticated remote testing of the
full Admin write lifecycle without accessing Production data. A Version URL
uses its uploaded version's resources; changing its DB binding also changes
the resources that version would use after promotion.

## Decision

Retain `blog` as the Production Worker and D1 name. Create `blog-preview` for
the Preview Worker and D1, retaining `DB` as the application binding in both.
Local development uses Preview-oriented configuration with persistent local
D1; automated tests use disposable isolated local D1. Neither uses remote D1.

Give Preview its own database and Access configuration, with writes through
a fixed alias Version URL. Prepare a pair from one build and promote the
corresponding Production candidate by exact source identity. This preserves
the existing no-rebuild promotion flow while isolating remote write tests.

Authoritative policies live in [Deployment](../architecture/deployment.md#v021-isolated-preview)
and [Security](../architecture/security.md#version-urls). Acceptance is a
design decision; provisioning and workflow changes are still `Planned`.

## Alternatives

- Bind both databases to one Worker and select by request host: preserves
  one Version ID but exposes both DB capabilities to Preview execution and
  makes Production isolation depend on correct application routing.
- Change a single candidate's DB binding during promotion: does not preserve
  the tested version's resource configuration or the existing promotion model.

## Consequences

Preview cannot access Production D1 through its bindings. Remote write tests
are possible, while Production candidate URLs remain read-only. Two Worker
identities require explicit configuration, migration targets, Access settings,
and reports. Preview and Production Version IDs differ; acceptance must link
them by source identity rather than by the mutable alias. Preview data/schema
is shared across its versions and is not rolled back with Worker selection.

## References

- [Cloudflare Version URLs](https://developers.cloudflare.com/workers/versions-and-deployments/version-urls/)
- [Wrangler environments](https://developers.cloudflare.com/workers/wrangler/environments/)
