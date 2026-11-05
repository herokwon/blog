# Delivery Pipeline Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Deliver version 0.1.0 through protected release branches with dependency automation, version preparation, independent Cloudflare deployment, and recoverable GitHub publication.

**Architecture:** Keep CI responsible for pre-merge validation. Use a repository GitHub App for protected automation mutations and exact-head merges, and separate preview/production deployment jobs from CI execution. Share only the GitHub API and policy functions needed by the three automation workflows.

**Tech Stack:** GitHub Actions, GitHub REST API, native Codex GitHub review, repository-pinned Node.js and pnpm, TypeScript, Wrangler, Cloudflare Workers.

**Spec:** [ADR 0002](../../adr/0002-delivery-pipeline.md), approved by the owner. [ADR 0001](../../adr/0001-blog-architecture.md) and the repository `AGENTS.md` remain applicable.

**Work record:** [Issue #3](https://github.com/herokwon/blog/issues/3), [milestone 0.1.0](https://github.com/herokwon/blog/milestone/1). Recommended Project fields: priority `p0`, size `l`, estimate `16` hours; these are not assigned Project values.

## Global Constraints

- Target `release/0.1.0` and the existing open `0.1.0` milestone. Package version remains `0.0.1` until release preparation; tags use `vX.Y.Z`.
- Create the implementation issue before implementation. Commit the accepted ADR separately before code. Implement on `codex/delivery-pipeline` based on `release/0.1.0` and open the work PR against that release branch with the same milestone.
- Use English documents, issues, PRs, comments, errors, and commits. Keep documentation essential and tests focused on behavioral and security boundaries.
- Read Node/pnpm versions from `package.json`; use frozen installation and the existing setup composite. Keep the four CI jobs and their existing names.
- Privileged PR automation executes trusted repository automation code, never unmerged PR code. It must not install dependencies or run lifecycle scripts from a Dependabot head.
- App credentials are `vars.BLOG_BOT_CLIENT_ID` and `secrets.BLOG_BOT_PRIVATE_KEY`. Grant installation-token permissions per job; do not expose the private key to build or PR-content execution.
- Keep `worker-configuration.d.ts` ignored and regenerated through the current scripts. Do not add a declaration synchronization commit or a review-request workflow.
- Preview is `preview` / `blog-preview` / `https://blog-preview.herokwon.dev`; production is `production` / `blog` / `https://blog.herokwon.dev`.
- No direct work/fix branch integration into `main`, native auto-merge arming, automated approvals, permanent protection bypass, automatic rollback, D1/R2 provisioning, migrations, authentication, or Cron workload.
- Do not expose credentials in logs, issue text, PR bodies, comments, fixtures, or generated artifacts. Report missing remote prerequisites without fabricating values.

## Review Focus

- A stale head, target advancement, or check rerun must invalidate an earlier merge/deployment decision; Task 1 and each workflow's final mutation tests cover these transitions.
- Mixed groups, missing metadata, and `0.x` minors must not accidentally become eligible updates; Task 2 exercises per-dependency classification and verified intake reuse.
- The first release must work while `main` lacks application/workflow files; Tasks 2–4 define bootstrap behavior and Task 5 verifies the first actual preview execution.
- Missing bot review coverage must block automated merging rather than pass on another commit's review or another author's comment; Tasks 1–3 cover authenticated current-head review evidence.
- Deployment success, HTTP verification, and publication are separate outcomes; Task 4 tests post-upload HTTP failure, matching/mismatched tags, and publication-only recovery.

## File Responsibilities

| File                                          | Responsibility                                                                          |
| --------------------------------------------- | --------------------------------------------------------------------------------------- |
| `docs/adr/0002-delivery-pipeline.md`          | Accepted architectural decision; separate first commit.                                 |
| `.github/scripts/tsconfig.json`               | Strict Node automation type checking without including generated application output.    |
| `.github/scripts/delivery/policy.ts`          | Pure version, dependency, review, release-selection, and deployment predicates.         |
| `.github/scripts/delivery/github.ts`          | Authenticated REST requests, pagination, bounded polling, and state rechecks.           |
| `.github/scripts/delivery/dependabot.ts`      | Intake, routing, synchronization, milestone assignment, and conditional merging.        |
| `.github/scripts/delivery/release-version.ts` | Version preparation PR orchestration and release readiness verification.                |
| `.github/scripts/delivery/deployment.ts`      | Resolve merged targets, HTTP verification, publication, comments, and verified cleanup. |
| `.github/scripts/delivery/delivery.test.ts`   | Focused Node tests with fixtures and mocked API responses; no external credentials.     |
| `.github/dependabot.yml`                      | Scheduled GitHub Actions/npm updates and grouping.                                      |
| `.github/workflows/dependabot.yml`            | Trusted Dependabot PR intake and resumable automation.                                  |
| `.github/workflows/release-version-bump.yml`  | Prepare version PR and expose required `Release Readiness` check on release PRs.        |
| `.github/workflows/deployment.yml`            | Independent build/deploy, publication, comments, and manual recovery.                   |
| `.github/workflows/ci.yml`, `package.json`    | PR/manual-only CI and automation checks/tests integrated into existing commands.        |
| `wrangler.jsonc`                              | Environment-specific custom-domain routes.                                              |
| `AGENTS.md`                                   | Recurring operation/recovery commands and review invariants.                            |

Keep scripts as native Node TypeScript with erasable syntax and no new runtime dependencies. Privileged jobs select the repository-pinned Node runtime from trusted `package.json` using `actions/setup-node`; they do not run the install composite against PR content. Ordinary CI/build jobs continue to use the existing composite.

## Task 0: Record Acceptance and Track the Work

**Files:** ADR and this plan only.

- [x] Set ADR 0002 to `Accepted`, retaining the approved decision text.
- [x] Create one implementation issue using the Common template with planned changes and acceptance criteria from Tasks 1–5. Assign existing milestone `0.1.0` (number 1); reuse the matching milestone rather than creating another. Recommend priority `p0`, size `l`, and estimate `16` hours; distinguish recommendations from assigned Project fields.
- [x] Add the real issue link to the ADR and this plan. Create the work branch from `release/0.1.0`, preserving the current documentation edits.
- [x] Run `pnpm format`, inspect the diff, and commit only the ADR with `docs(adr): record release automation and delivery decisions` (`25d14c7`).
- [x] Save this plan in a separate documentation commit before code. Implementation starts after the owner's plan review and execution-method selection.

## Task 1: Establish Automation Policies and Verification

**Files:** Create `policy.ts`, `github.ts`, `delivery.test.ts`, and `.github/scripts/tsconfig.json`; modify `package.json`.

**Interfaces:**

- `ReleaseVersion = { version: string; branch: string; tag: string }`; `parseReleaseBranch(ref: string): ReleaseVersion` accepts only `release/X.Y.Z` with stable SemVer and no leading zeroes.
- `DependencyUpdate = { dependencyName: string; dependencyType: string; updateType: string | null; packageEcosystem: string; prevVersion: string; newVersion: string }`; `classifyUpdates(updates: DependencyUpdate[]): { eligible: boolean; reason: string }` evaluates every item.
- `ReviewEvidence = { headSha: string; completed: boolean; hasFindings: boolean; url: string }`; `readReviewEvidence(comments: unknown[], headSha: string): ReviewEvidence | null` accepts only the authenticated Codex connector's current-head completed code review summary.
- `GitHubClient` exposes `request<T>(method, path, body?): Promise<T>` and `paginate<T>(path): Promise<T[]>`. Request timeout is 30 seconds, with bounded retries for retryable failures and explicit handling of rate-limit responses.
- `waitForMergeReadiness({ repo, prNumber, deadline }): Promise<{ state: 'ready'; headSha: string } | { state: 'blocked' | 'timeout' | 'closed'; reason: string }>` refreshes PR state, latest matching CI jobs, and review evidence every 10 seconds for at most 30 minutes. It never reports an old successful attempt as ready after a later failed rerun.

- [ ] Write failing table-driven tests for strict versions, mixed dependency groups, `0.x` minor/major changes, invalid fallback versions, forged/stale/pending reviews, check reruns, and head/target advancement. Keep assertions at the externally observable policy level.
- [ ] Implement the pure predicates and API helper. Treat the Codex comment schema as an integration adapter: unknown schema fails closed. Do not add an API-based paid review or infer completion from missing findings alone.
- [ ] Add `check:automation` using `tsc --project .github/scripts/tsconfig.json`, and `test:automation` using `node --test .github/scripts/delivery/delivery.test.ts`. Include them in `pnpm check` and `pnpm test`, preserving existing generation, Svelte checking, Vitest, and Playwright behavior.
- [ ] Run the focused tests and type check, then `pnpm format`, `pnpm lint`, `pnpm check`, and `pnpm test`. Confirm no credentials or generated declarations become tracked. Commit the automation foundation.

## Task 2: Route, Synchronize, and Conditionally Merge Dependabot PRs

**Files:** Create `.github/dependabot.yml`, `.github/workflows/dependabot.yml`, and `dependabot.ts`; extend focused tests.

**Interfaces:** `inspectDependabotPullRequest(repo, prNumber)` returns a verified same-repository, non-draft Dependabot PR plus its current head/base; `runDependabotPullRequest(repo, prNumber)` returns a typed routed/manual/waiting/merged/closed result. CLI receives repository/PR identifiers through environment variables and writes only explicit step outputs through `GITHUB_OUTPUT`.

- [ ] Write tests for no/one/multiple active releases, a frozen release, initial default-branch bootstrap, grouped eligibility, conflict responses, retries after App synchronization, and the head changing immediately before merge.
- [ ] Configure GitHub Actions updates for Monday 02:00 and npm for Monday 03:00, both `Asia/Seoul`, with open PR limits 2 and 5. Omit `target-branch`. Group Actions minor/patch, production patch only, and development minor/patch excluding `drizzle-*`. Do not suppress major PRs. Keep security-update routing distinct from version-update grouping.
- [ ] Use `pull_request_target` for opened/synchronize/reopened/ready-for-review/retarget activity on `main` and `release/*`, plus `workflow_dispatch` with a PR number for resumption. Serialize each PR without cancelling mutations; constrain all entry points with fresh API provenance and same-repository checks. Limit orchestration jobs to 45 minutes, including the 30-minute readiness wait.
- [ ] Execute automation scripts from trusted default-branch code. Native Dependabot cannot start before its config reaches `main`; if automation is not installed there, report bootstrap pending instead of checking out untrusted PR code or silently bypassing validation.
- [ ] Fetch native Dependabot metadata before the App changes the PR head, using `updated-dependencies-json`. Record an App-authored intake receipt bound to the PR, original verified SHA, and normalized head history. On subsequent runs, authenticate the receipt and verify ancestry; do not call native metadata verification on an App-authored head or skip provenance checks globally.
- [ ] Route to the unique eligible release; create the next patch branch/milestone from `main` only when no release is active and production is complete. Defer during a frozen production transition. Assign the exact milestone, retarget, and update the branch through the API without force pushing. Require manual conflict resolution.
- [ ] Apply per-item eligibility, wait for current-head CI and no-findings review, recheck PR/base/head immediately before `gh pr merge --squash --match-head-commit` or equivalent REST merge with `sha`, and use the App for the actual merge. Do not enable `--auto`, approve, or delete the branch in this operation.
- [ ] Run focused tests and configured local checks. Inspect workflow permissions and confirm the private key/token is never available to PR code execution. Commit dependency automation.

## Task 3: Prepare Release Versions and Enforce Readiness

**Files:** Create `release-version-bump.yml` and `release-version.ts`; extend focused tests.

**Interfaces:** `prepareReleaseVersion(repo, releasePrNumber)` creates/reuses and conditionally merges the preparation PR; `verifyReleaseReadiness(repo, releasePrNumber)` validates current source/version/preview evidence and returns the verified release SHA or a blocking reason. Both reload the original PR before mutations.

- [ ] Write tests for invalid/fork/draft/non-release sources, already-correct versions, downgrades, empty initial `main`, existing App-owned preparation PRs, conflicts, missing reviews, stale preview results, and a changed original release head.
- [ ] Trigger on PR opened/reopened/synchronize/ready-for-review targeting `main`, plus manual resumption. Resolve strict `release/X.Y.Z` metadata. Use preparation jobs only for eligible release sources, but make required `Release Readiness` fail for unsupported non-draft source branches targeting `main` rather than returning a successful skip.
- [ ] Check out the verified protected release SHA, find/reuse the App-owned `automation/release/X.Y.Z` PR first, and merge the current release into it through the update-branch API when needed. Do not reset/force push existing branches or treat authentication/network errors as a missing branch.
- [ ] Prepare version changes using `pnpm version <version> --no-git-tag-version` and `pnpm format` before exposing mutation credentials. Allow only the package version and any actually affected lockfile change; stop on unrelated generated changes. Mint the App token for push/PR/milestone operations after trusted preparation.
- [ ] Wait for and merge the preparation PR under the shared current-head policy. Reload the release PR, then require package version agreement and a successful native preview Deployment/HTTP-verification result for that exact release head. Opening a preparation PR is not readiness. Use a bounded wait and explicit blocked result on missing evidence.
- [ ] Support the first release using trusted same-repository protected release code while `main` is empty. Review completion comes from the shared evidence adapter, without depending on a not-yet-existing `review.yml`.
- [ ] Run focused tests and configured checks. Confirm preparation does not create a Git tag or release, change ordinary implementation versions, or authorize direct work-to-main integration. Commit version automation.

## Task 4: Build and Deploy Independently, Then Publish and Report

**Files:** Create `deployment.yml` and `deployment.ts`; modify `ci.yml` and `wrangler.jsonc`; extend focused tests.

**Interfaces:**

- `DeploymentTarget = { prNumber: number; environment: 'preview' | 'production'; branch: string; sha: string; workerName: string; url: string; version: string | null }`.
- `resolveDeployment(repo, prNumber): Promise<DeploymentTarget | { skipped: true; reason: string }>` verifies a merged same-repository PR, actual merge SHA, allowed branch transition, latest target ref, and release freeze state.
- `verifyHttp(target, deadline): Promise<void>` retries every 10 seconds for up to five minutes, with a 10-second request timeout, requiring HTTPS root status 200, HTML content type, and the existing `Personal Blog` title. Update this expected title with future homepage changes rather than adding a health endpoint.
- `publishRelease(target)` creates or reuses the exact-SHA `vX.Y.Z` tag and generated-notes GitHub Release, rejecting an existing tag or release referencing a different commit.
- `upsertDeploymentComment(target, result)` updates only the authenticated automation author's comment with `<!-- deployment-result:preview -->` or `<!-- deployment-result:production -->`.

- [ ] Write tests for closed-unmerged PRs, valid bot merges, direct work-to-main rejection, exact merge SHA selection, stale retries, environment serialization, HTTP failure after upload, matching/mismatched tags, publication-only recovery, and comment ownership/idempotence.
- [ ] Trigger on merged `pull_request: closed` targeting `main` or `release/*`; resolve metadata before the environment job. Add manual dispatch with PR number and `deploy` or `publish` mode. Resolve all manual inputs from fresh API records; never allow an arbitrary ref/environment override.
- [ ] Remove CI's `main` push trigger; retain PR events, manual dispatch, four named jobs, shared setup, hidden build artifact transfer, and Test restoration after setup. Include PR base-branch changes so retargeted Dependabot PRs receive CI for their new target even when no synchronization commit was needed. Do not introduce `workflow_call`, `workflow_run`, cross-workflow artifact lookup, or CI polling for deployment.
- [ ] Configure the environment job to serialize deployments without cancelling an active run. Recheck the target branch immediately before deployment. Keep stale attempts visible as skipped and do not turn stale skips into successful deployment evidence. Do not rely on concurrency as a durable FIFO queue.
- [ ] Check out the resolved merge SHA, run the existing setup composite and `pnpm build`, then use `cloudflare/wrangler-action@v4` with installed Wrangler, `packageManager: pnpm`, environment-scoped `CLOUDFLARE_API_TOKEN` secret and `CLOUDFLARE_ACCOUNT_ID` variable, and `deploy --env <environment> --tag <sha>`. Reconfirm the action interface against the official source during implementation.
- [ ] Add environment-local `routes` with `custom_domain: true` for the agreed domains. Preserve workers.dev/preview-URL disabling and existing log/trace sampling. Generate types locally without adding generated files or remote bindings.
- [ ] Perform HTTP verification inside the native GitHub Environment deployment job. Do not hide deployment failure with `continue-on-error` or create duplicate Deployment API records. Always report a valid PR's result after failures; omit deployment credentials from comment jobs.
- [ ] Publish only after verified production success, using the immutable deployed SHA rather than mutable `main`. For `publish` recovery, require a trusted successful production deployment job and native Deployment record for that SHA, and ensure it is still the intended production commit; do not rebuild/redeploy. Authenticate evidence by workflow/job identity, run SHA, environment, and status.
- [ ] Render English success comments as `Preview deployed` / `Production deployed` with site, commit, logs, and production Release links. Failure comments show failed stage/reason/commit/logs. Use `Production deployed; release publication failed` for a successful Worker deployment with failed publication. Do not add avatars, repeated PR metadata, or dashboard tables.
- [ ] After complete production success, verify source branch has no changed head, unmerged work, or active dependent PRs before cleanup. Wake deferred Dependabot PRs using a narrowly scoped App token with Actions dispatch permission only where needed. Leave issue/milestone closure explicit and preserve incomplete work.
- [ ] Run focused tests, all configured checks, Workers build and preview packaging dry-run. Commit independent delivery.

## Task 5: Configure Remote Prerequisites and Verify the First Delivery

**Files:** Update `AGENTS.md`; keep remote settings in GitHub/Cloudflare rather than adding duplicate configuration prose or fabricated credential files.

- [ ] Verify account/zone ownership, both intended domains, the App installation, and available tokens without reading secrets into logs. Configure the App installation with Contents/Pull requests/Issues write; add Actions write only for dispatching deferred automation. Store the client ID/private key at repository scope and Cloudflare values in the two Environments. The owner supplies any unavailable credentials through secret settings, not chat text.
- [ ] Configure preview to allow release branches and production to allow `main`, with no required production reviewer. Keep credentials out of CI and dependency/version policy jobs.
- [ ] Apply branch rulesets for PRs, current-target CI, no force pushes, main deletion protection, zero required approvals, and required `Release Readiness` on `main`. Apply release-tag update/deletion protection with no permanent bypass. Preserve the chosen merge-commit release path and squash App PR path.
- [ ] Sequence initial rollout so checks exist before becoming required. Review and merge the implementation work PR into `release/0.1.0`; verify its first preview deployment and HTTP result. A release PR then prepares the package version and verifies the new preview before production integration. Native Dependabot starts only after its config and trusted automation reach `main`.
- [ ] Verify native Codex on actual App/Dependabot PRs. If personal-settings coverage omits them, request review manually and confirm automation stays blocked until current-head no-findings evidence exists. Record integration limitations rather than changing the accepted review policy.
- [ ] Verify production with exact SHA alignment across native Deployment, Worker metadata, Git tag, GitHub Release, and sticky PR comment. Exercise publication recovery without moving tags or unnecessarily redeploying. Do not deliberately break the live service to test failure paths; use mocked failure tests for those paths.
- [ ] Update `AGENTS.md` with actual automation commands, configuration names, recovery procedure, stale-run policy, and check/review requirements. Run `pnpm format`, `pnpm install --frozen-lockfile`, `pnpm lint`, `pnpm check`, `pnpm test`, `pnpm build`, and `pnpm exec wrangler deploy --dry-run --env preview` before reporting implementation complete.
- [ ] Run configured Codex PR review, assess findings, and satisfy required checks. Keep the issue open until its applicable release/deployment verification succeeds. Close the milestone only after main integration, verified production release, and all assigned work is complete. Preserve any blocked remote step as outstanding rather than claiming successful rollout.

## Completion Evidence

The work record must include the implementation issue/milestone, ADR commit, work and release PRs, actual local check results, current-head Codex results, preview/production run URLs, verified deployed SHA, Git tag/release, and cleanup outcome. Missing prerequisites or unexecuted remote checks remain explicitly pending.
