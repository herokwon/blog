# Deployment

## Status and Scope

Worker upload, production promotion, version automation, and deployment
reporting are `Implemented` in repository workflows. Application-enforced
read-only behavior on candidate Version URLs is implemented in the current
request-origin guard. v0.2.1 Preview isolation and paired candidate upload
are `Planned`; existing configuration still defines only the Production Worker.

This document records deployment boundaries and release policies.
[CI/CD operations](../operations/ci-cd.md) covers commands, credentials,
authorization, and procedures. Repository configuration alone does not
confirm verified production resources or security policies.

## Runtime and Environments

[wrangler.jsonc](../../wrangler.jsonc) defines one Worker named `blog`,
a SvelteKit Worker entrypoint, Workers Static Assets, and a `DB` binding
to one remote D1 database.

| Context               | Purpose                                          | Storage                 |
| --------------------- | ------------------------------------------------ | ----------------------- |
| Local                 | Development, write testing, migration validation | Wrangler local D1 state |
| Candidate Version URL | Validate an uploaded version before promotion    | Shared production D1    |
| Production            | Serve the deployed application                   | Production D1           |

Version URLs, formerly called Preview URLs, expose versions uploaded
with `wrangler versions upload`. They create neither separate Workers
nor database environments. The workflow labels this context `preview`.

Candidates are read-only: the application must reject mutations, including
direct API requests. Validate writes and migrations locally, following
[Architecture Overview](overview.md) and [API Design](api-design.md).

### v0.2.1 Isolated Preview

Status: `Planned`. Replace the single shared candidate test environment with
a separate Preview Worker and Preview D1. Both Workers run the same application
and expose one `DB` binding, but each binding targets only its own remote D1.
Preview has no Production D1 binding. Keep the existing Production Worker and
D1 named `blog`; name the new Preview Worker and D1 `blog-preview`. Both expose
the same `DB` binding name. Production retains its existing database ID and
domain. Use explicit environment-specific bindings, variables,
and Access configuration; do not rely on inheriting non-inheritable settings.

| Context                          | Storage           | Authorized Admin writes                |
| -------------------------------- | ----------------- | -------------------------------------- |
| Local                            | Isolated local D1 | Explicitly enabled local origin        |
| Preview default Worker URL       | Preview D1        | Matching trusted default Worker origin |
| Preview individual Version URL   | Preview D1        | None                                   |
| Production candidate Version URL | Production D1     | None                                   |
| Production domain                | Production D1     | Matching Production origin             |

Use `https://blog-preview.<account-subdomain>.workers.dev` as the primary
Preview test entry point. Explicitly enable Preview `workers_dev: true` and
`preview_urls: true`. Resolve the exact HTTPS origin from the Worker name and
actual account subdomain before enabling writes. No alias or new custom domain
is required. Each successful candidate flow deploys the uploaded Preview Version
ID at 100% traffic and applies Preview triggers.
Protect Admin pages/APIs with Preview-specific Access configuration, leaving
home/public paths accessible. Preview permits the entire management lifecycle
through its default Worker URL, including creation, update, publish, archive, delete,
and restore. Individual Version URLs remain read-only for reinspection.

Keep Preview data across uploads. Apply only unrecorded migrations from the
same migration directory used by Production. Never reset, reseed, or copy
Production data automatically. Different Preview versions share the latest
Preview database state; switching versions does not roll back migrations.
Review compatibility with previously uploaded versions before schema changes.

See [ADR 0004](../adr/0004-isolate-preview-worker-and-d1.md) for rationale.

Local development uses Preview-oriented configuration with a persistent local
D1, never the remote Preview or Production database. Use explicit local mode
and the same ordered migrations. Automated tests retain fresh isolated local
databases and deny remote requests. Local state, Preview data, and Production
data are independent; a Version URL is an entry point to a Worker version,
not another storage environment.

The [environment separation implementation sequence](../operations/v0.2.1-environments.md)
maps these boundaries to repository files and verification gates.

Worker versions contain neither D1 data nor migration state.

## Deployment Paths

Deployment follows merged, same-repository PRs rather than arbitrary pushes.

| Merged PR                                            | Action                             |
| ---------------------------------------------------- | ---------------------------------- |
| PR into `release/v<major>.<minor>.<patch>`           | Build and upload a candidate       |
| Release branch into `main`                           | Promote an existing candidate      |
| `fix/**` into `main`, titled `fix:` or `fix(scope):` | Build, upload, and deploy a hotfix |

### Candidate

Candidates are tagged with the release-branch merge commit SHA and
annotated with the release branch name. Upload exposes a Version URL
without applying production migrations or deploying production triggers.

### v0.2.1 Paired Candidates

Status: `Planned`. A merged PR into the active versioned release branch runs
the following candidate flow, including dependency PRs:

1. Build the release merge SHA once using the normal verified build.
2. Apply pending Preview D1 migrations with an explicit Preview target.
   Failure stops both candidate uploads; Production D1 is never migrated here.
3. Upload that build output to the Preview Worker, deploy its returned Version
   ID at 100% traffic, and apply Preview triggers. Do not select by upload order.
4. Upload the same build output to the Production Worker as an undeployed
   candidate. Do not rebuild between uploads or deploy Production triggers.
5. Report the source SHA, release annotation, each Worker identity/Version ID,
   the immutable Preview Version URL, and the current default Worker URL.

Both uploads, Preview deployment, and Preview trigger application must succeed
to report candidate preparation success. These
operations are not atomic: a later failure can leave a changed Preview deployment or
an already-uploaded version. Report confirmed partial outcomes; do not
silently fall back to another SHA. A retry must retain the intended source
identity and recheck the deployed Preview Version ID before acceptance.

Preview and Production Version IDs are different. Validate the Preview
version for the final release head, and promote its corresponding Production
candidate using the existing exact source-SHA/release-annotation selection.
The main merge does not rebuild. Production migrations and triggers keep
their existing release gates. Hotfix deployment remains Production-only;
subsequent release synchronization prepares a new pair.

The default Worker URL is a mutable entry point, not acceptance evidence. Record the
tested Preview Version ID, corresponding Production Version ID, source SHA,
and Preview migration state. If the Preview deployment changes during testing, verify the
final-head Preview candidate again before release. An old Version URL still
uses the current shared Preview data/schema.

### Production Promotion

1. Independently validate the release tag and select the exact candidate.
2. Apply pending D1 migrations from the merged main commit.
3. Deploy the selected Worker version.
4. Deploy Worker triggers separately using a generated configuration that
   excludes `assets` from the checked-out `wrangler.jsonc`.

Promotion does not rebuild the Worker. Selection requires an exact match
to the release PR's final head SHA and release-branch annotation, regardless
of upload order. The head SHA identifies the candidate source; it is distinct
from the main merge commit used for migrations and deployment reporting.
Verify the final candidate and its migration compatibility before promotion.

Both preflight gates must succeed before D1 migrations or Worker deployment.
A missing release tag is allowed; an existing tag, including an annotated
tag, must resolve to the expected main merge commit. A mismatch or lookup
failure blocks promotion.

If the exact candidate is missing, selection fails before D1 migrations or
Worker deployment; an older candidate is never substituted. Resolve a failed
candidate upload or wait for it to finish, then rerun promotion. Failed
migrations also prevent Worker deployment.
Worker or trigger deployment failure marks the deployment job as failed.
The sequence is not atomic; earlier successful changes may remain after
a later failure.

### Hotfix

Start `fix/**` branches from the latest main and merge after CI and manual
review. A preceding deployment failure is not required. Automation checks
the same-repository merge, branch, and title conditions listed above;
CI and review remain merge prerequisites.

Hotfixes do not automatically increase the package version or apply D1
migrations. They must remain compatible with the production schema;
schema changes use regular release promotion.

### Hotfix Synchronization

Continue development on one active release branch. After verifying the
hotfix in production, synchronize `main → the active release/v… branch`
through a manually reviewed PR merged with a merge commit. Upload and
verify a new candidate containing the hotfix before regular promotion.

[Hotfix delivery and synchronization](../operations/ci-cd.md#hotfix-delivery-and-synchronization)
defines the review and verification procedure. Synchronization and release
resumption remain operator decisions; no automatic synchronization workflow
is planned.

## Versions and GitHub Releases

Release branches use `release/v<major>.<minor>.<patch>`.
Their version is synchronized into `package.json` through a separate
version-bump PR into the release branch when its release PR targets main.

A dedicated GitHub App authors these changes and enables auto-merge after
required checks pass, separating automation attribution and permissions
from ordinary user identities.

After successful regular Worker and trigger deployment, the workflow
revalidates the tag and creates or reuses `v<package.json version>`:

- A missing tag is created at the resolved main merge SHA.
- A matching tag is reused to create a missing Release or skip an existing one.
- A mismatched tag or lookup failure stops publication; tags are never moved
  automatically.

A different release merge requires a new package version. Publication failure
does not undo Worker deployment. [Release tag validation and retries](../operations/ci-cd.md#release-tag-validation-and-retries)
covers API behavior, conflicts, and recovery.

Hotfix deployments do not create GitHub Releases.

## Reporting and Recovery

The workflow records each resolved attempt through GitHub Deployment and
the originating PR. Deployment success confirms completed steps, not
incident resolution.

[Deployment identification and results](../operations/ci-cd.md#deployment-identification-and-results)
defines the recorded fields, Version ID capture, exact-ID deployment,
comment layout, independent PR reporting, and interpretation of failed or
partial results.

Deployment failures or unresolved incidents pause synchronization and
promotion until production and intended Git code are reconciled and
verified. Recovery requires investigation and may use a deployment rerun
or dashboard restoration, followed by a fix/revert PR when Git changes
are required.
Worker restoration must be compatible with the current D1 schema and does
not reverse migrations. No rollback workflow is planned.

[Failure recovery and release resumption](../operations/ci-cd.md#failure-recovery-and-release-resumption)
defines recovery actions, verification gates, and records, including the
manual record needed after dashboard restoration.

## Sources

- [Worker configuration](../../wrangler.jsonc)
- [Deployment workflow](../../.github/workflows/deployment.yml)
- [Release version workflow](../../.github/workflows/release-version-bump.yml)
- [Database foundation](database-foundation.md)

Release promotion and hotfix hardening are tracked in
[Issue #7](https://github.com/herokwon/blog/issues/7). Trigger configuration
and release tag validation fixes are tracked in
[Issue #13](https://github.com/herokwon/blog/issues/13).
