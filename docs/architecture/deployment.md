# Deployment

## Status and Scope

Worker upload, production promotion, version automation, and deployment
reporting are `Implemented` in repository workflows. Application-enforced
read-only behavior on Version URLs is `Planned`.

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

### Production Promotion

1. Select a deployable candidate tagged with the merged release PR's final
   head SHA and annotated for that release branch.
2. Apply pending D1 migrations from the merged main commit.
3. Deploy the selected Worker version.
4. Deploy Worker triggers separately.

Promotion does not rebuild the Worker. Selection requires an exact match
to the release PR's final head SHA and release-branch annotation, regardless
of upload order. The head SHA identifies the candidate source; it is distinct
from the main merge commit used for migrations and deployment reporting.
Verify the final candidate and its migration compatibility before promotion.

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

The workflow creates `v<package.json version>` GitHub Releases after
successful regular production promotion, skipping existing releases.
Release creation follows Worker and trigger deployment; its failure does
not undo the deployed Worker.

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
[Issue #7](https://github.com/herokwon/blog/issues/7).
