# ADR 0002: Release Automation and Cloudflare Delivery

- Status: Accepted
- Date: 2026-11-05
- Related issue: https://github.com/herokwon/blog/issues/3
- Extends: [ADR 0001](0001-blog-architecture.md)

## Context

The application already has CI, but repository protection, dependency automation, version preparation, and remote delivery are not configured. The owner wants a small delivery pipeline for a single-author blog, with preview verification before production integration.

Keep the existing GitHub Actions baseline. Separate merge validation from deployment execution, preserve the release-branch workflow, and make deployment and publication failures visible and recoverable.

## Decision

### Repository protection and review

- Require pull requests and successful Lint, Type Check, Build, and Test checks for `release/*` and `main`. Require checks against the latest target-branch state. Keep the required approval count at zero for the single-owner repository; assess Codex findings before merging.
- Block force pushes to protected branches, protect `main` from deletion, and protect release tags from updates and deletion. Do not grant a permanent administrator or automation bypass. Delete release branches only after verifying delivery and checking for remaining work.
- Use native Codex automatic review on every push under the available personal settings. Do not introduce a review-request workflow initially. Verify automatic coverage on actual Dependabot and GitHub App PRs; request review manually when coverage is missing.
- Automatic merging requires successful CI and a completed Codex review with no findings for the current PR head. Missing, pending, stale, or unrecognized review evidence blocks automation. Accepted findings permit owner-controlled merging, not automatic merging.
- Use a repository GitHub App with narrowly scoped installation tokens for automated branch and PR mutations and the actual merge. Recheck the current head and use an exact-head squash merge rather than enabling native auto-merge. Do not auto-approve PRs or delete their branches during the merge operation.

### Dependency updates

- Keep native Dependabot updates targeting the default branch. Route regular and security update PRs to the unique active `release/X.Y.Z` branch before considering automatic merging. If no release is active, create the next patch release branch from `main` and reuse or create its version milestone. Multiple eligible release branches require owner selection.
- Synchronize routed PRs with the release branch without rewriting their history. Verify Dependabot provenance before automation modifies the head, and preserve that verified intake for subsequent runs. Conflicts require manual resolution; privileged automation must not execute unmerged PR code.
- Allow automatic merging for direct development patch/minor updates, direct production patch updates, and GitHub Actions patch/minor updates. Require manual handling for majors, `0.x` minor updates, indirect dependencies, and updates that cannot be safely classified. Every dependency in a group must qualify.
- Group production patches, development patches/minors, and GitHub Actions patches/minors separately. Keep `drizzle-*` updates outside the development group and keep major updates visible as individual PRs.
- Wait for current-head checks and review before the App performs the merge. Stop after a bounded wait without bypassing policy; a later run can resume after the missing requirement is satisfied. Assign the target-version milestone to automated PRs without creating a separate issue for each one.
- Keep `worker-configuration.d.ts` ignored. Generate it during dependency installation and before type checking. Wrangler updates need no generated-file synchronization commit; actual type incompatibilities remain CI failures.

### Release version preparation

- Use stable release branches named `release/X.Y.Z`, package versions `X.Y.Z`, and Git tags `vX.Y.Z`. Ordinary implementation work does not bump the package version.
- When a same-repository, non-draft release PR targets `main`, prepare or reuse an App-owned `automation/release/X.Y.Z` PR targeting the release branch. Update the package version and any affected lockfile without creating a tag. Synchronize the preparation branch without force pushing.
- Merge the preparation PR only after its current-head CI and Codex review satisfy automatic-merge policy. A required release-version check on the original PR verifies the actual release branch version; opening the preparation PR does not make the release ready.
- Require successful preview deployment and active-version/commit verification for the latest release head before production integration. Integrate `release/* -> main` through a reviewed merge-commit PR; fixes follow the same release path.
- Freeze a release after production integration and retain it for recovery. Queue dependency routing while production completion is pending. After successful deployment, publication, and verification, perform verified branch cleanup and resume dependency routing.

### Independent deployment

- Run deployment independently on merged PRs targeting a release branch or `main`, with a manual recovery entry point. Release-branch merges deploy preview; release PR merges into `main` deploy production. Do not exclude valid merges based on whether the author or actor is a bot.
- Keep CI on PR events and manual dispatch; remove its independent `main` push trigger. Deployment neither waits for CI runs nor calls CI as a reusable workflow. Merge protection is responsible for pre-merge validation.
- Resolve and check out the actual merged commit SHA. Install locked dependencies using the shared setup action, build inside the deployment job, and deploy that build. Use the same SHA for deployment metadata and subsequent release publication.
- Use separate GitHub Environments and Workers: `preview` / `blog-preview` at `https://blog-preview.herokwon.dev`, and `production` / `blog` at `https://blog.herokwon.dev`. Restrict preview to release branches and production to `main`; do not require an additional production approval initially.
- Scope Cloudflare credentials to the deployment environment. Use `cloudflare/wrangler-action` and the installed Wrangler version with `deploy --env preview` or `deploy --env production`. Standard deployment manages the Worker and configured triggers; do not add a separate version-upload, promotion, or trigger workflow.
- Keep `workers.dev` and version preview URLs disabled. Do not introduce remote D1/R2 resources, migrations, authentication, or a scheduled workload in this delivery scope.
- Serialize deployments by environment without cancelling an active deployment. Before deploying or retrying, reject a commit superseded on its target branch so an old run cannot overwrite a newer release.

### Verification, publication, and recovery

- Use the deployment job's GitHub Environment integration for native Deployment records and statuses. Do not create a duplicate Deployment record in a separate job.
- After deployment, require the Cloudflare API to confirm a version receiving 100% of traffic whose `workers/tag` annotation matches the actual merged commit. Build, deployment, or activation-proof failure fails the deployment job.
- Preserve Bot Fight Mode. Public HTTP responses are advisory and do not determine deployment success: both plain and fresh-browser probes were challenged in the first live rollout. Keep one short public HTTP request for diagnostics; remove browser verification and do not add a health endpoint or weaken zone protections.
- Only after activation-verified production deployment, create `vX.Y.Z` and its GitHub Release at the exact deployed SHA. Reuse an existing matching tag or release and finish missing publication steps; fail on a tag pointing to another commit rather than moving it.
- Keep Worker deployment success separate from publication success. If release publication fails, recover the missing tag/release operation without requiring another successful Worker deployment. Retry installation/build, deployment, and HTTP verification according to the failed stage; do not perform automatic rollback initially.
- Maintain one automation-owned PR comment per environment. Success shows the environment, site URL, commit, and run logs, plus the Release link for production. Failure shows the failed stage, a short reason, commit, and logs. Report publication failure as `Production deployed; release publication failed`.
- Preserve explicit issue and milestone closure rules from `AGENTS.md`. Pending or failed deployment, publication, or required verification does not count as completion.

## Alternatives Considered

- **Wait for a separate CI build or call reusable CI from deployment:** deploys a tested artifact, but adds coordination or couples the executions. The owner selected independent deployment builds and pre-merge CI enforcement.
- **Promote uploaded Worker versions:** supports version-based rollout within a Worker, but does not provide the chosen separate preview and production Workers with their fixed custom domains as simply as standard deployment.
- **Commit generated Worker declarations:** makes generated changes reviewable, but adds large diffs and synchronization work to dependency updates. Installation and type checking already regenerate them.
- **Native auto-merge, approval bots, or permanent ruleset bypasses:** reduce custom merge handling, but do not preserve the chosen current-head review checks and explicit App-controlled merge path.

## Consequences

- Deployment rebuilds code validated before merging; its output is not the same artifact exercised by CI E2E. Locked dependencies and pinned runtimes reduce variation. Activation proof confirms the running Worker version, not public URL availability or application health.
- The pipeline remains dependent on repository rulesets, App installation permissions, environment credentials, and native Codex review availability. Missing review evidence may require a manual request and another automation run.
- Activation-proof failure may occur after a new Worker version is already serving traffic. Inspect actual state before recovery; automatic rollback is deferred. Bot-protection challenges are reported without treating a successful activation as a deployment failure.
- Successful Worker delivery can coexist with failed GitHub publication. Retry and cleanup logic must preserve this distinction and existing immutable release references.
- Keep workflow mechanics and exact configuration in their implementation files, and recurring operating instructions in `AGENTS.md`. Commit this ADR before implementing the delivery changes.
