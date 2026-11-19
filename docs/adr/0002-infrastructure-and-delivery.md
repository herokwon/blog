# ADR 0002: Infrastructure, identity, and delivery for 0.1.0

- Status: Accepted
- Date: 2026-11-17
- Related issues: #4, #5, #6

## Context

ADR 0001 defers live resources and delivery automation to 0.1.0. This decision
defines how the project provisions, protects, validates, and deploys those resources.

## Decision

Keep the existing preview/production D1 and private R2 names. Use
blog-preview.herokwon.dev and blog.herokwon.dev as Custom Domains; disable
workers.dev and version URLs. Protect the complete preview host and production
/admin paths with Access. Validate signed Access JWTs at the server against the
environment's administrator application audience and exact administrator email.
Never bypass authentication for local development.

Use environment-scoped Cloudflare deployment credentials.
CI needs no remote credentials. Separate read-only CI/security checks from
privileged metadata automation. Use jose for JWT signature/claim verification
with Cloudflare JWKS rather than implementing cryptography manually.

Run quality, combined tests, and audit jobs in parallel, with an explicit final
CI gate. Coverage is informational. Audit all dependencies; unexcepted
high/critical findings and audit service failures fail. Daily 09:17 KST audits
inspect main and the sole release branch. Keep reports for 14 days.

Use hosted Renovate on /^release\/.+$/, keeping only one active release branch.
Create an issue for each bot PR (an explicit issue-first exception for Renovate),
and assign the PR and issue to the target milestone. Use an installation token
from a separate repository automation App for version bump PR creation. The
agent, not a merge workflow, checks current CI/Codex review and squash-merges
bump PRs. Release branch names determine package versions; never downgrade.

Trigger deployments from pushes to release/* or main so GitHub Environment
protection checks the branch ref. Deploy only when the push SHA matches a merged
PR's merge SHA on that same target branch.
Required PR checks and up-to-date branches gate merging; post-merge push CI is
informational to deployment. The deploy job builds, migrates, publishes, and
verifies the Worker under one Environment. Check the published version ID and
merge SHA tag against the active Worker deployment using Wrangler. Cloudflare
Bot Fight Mode can challenge automated requests, so the owner checks site and
administrator login behavior separately in a browser. After deployment, a
separate job reports the result on the merged PR so reviewers can find it without
opening Actions. PR reporting and production release publication run independently.
Serialize each environment without interrupting active work. Skip an older
commit when a descendant has already been deployed. Production success publishes
v<version> and GitHub Release for the deployed SHA. Publication errors require
manual recovery and must not rewrite a successful Deployment result.

## Consequences

Cloudflare Access and GitHub settings require an explicit setup sequence and
live credentials. Default-branch-only workflows start after their first main
integration. No fabricated identifiers or permissive auth fallback are allowed.
Worker rollback does not undo migrations or R2 changes. Require backwards-
compatible migrations; document manual recovery. No automatic rollback, backup
automation, IaC, product schema, or write/delete probes are added. Main merges
and issue/milestone closure still require owner authorization.

## References

- https://developers.cloudflare.com/cloudflare-one/access-controls/applications/http-apps/authorization-cookie/validating-json/
- https://developers.cloudflare.com/workers/configuration/routing/custom-domains/
- https://docs.github.com/en/actions/reference/workflows-and-actions/events-that-trigger-workflows
- https://docs.renovatebot.com/configuration-options/#basebranchpatterns
- https://pnpm.io/cli/audit
