# Project Instructions

## Purpose and Architecture

Build and operate a single-author personal blog while learning Svelte. Use the accepted architecture in [ADR 0001](docs/adr/0001-blog-architecture.md) and delivery policy in [ADR 0002](docs/adr/0002-delivery-pipeline.md). Keep domain features separate from delivery infrastructure.

- Use the existing SvelteKit 3 / Svelte 5 TypeScript application and Cloudflare Workers adapter.
- Author application and configuration code in TypeScript. Keep strict TypeScript/Svelte checks; compiled JavaScript imported by generated Workers declarations is not an authored source-check target.
- Follow native `#lib` imports and the CLI project structure. Keep database and credential access in server-only modules.
- Reuse existing capabilities and choose the smallest clear implementation. Avoid abstractions without a current need.
- Store future post bodies as Markdown. Keep the browser-only editor out of public rendering bundles.
- Public content and attachments must follow publication visibility; author operations require application-side authorization.
- Administrator requests are guarded in `src/hooks.server.ts` using the native `cloudflare:workers` environment. Set `ACCESS_ISSUER`, the environment-specific `ACCESS_AUD`, and `AUTHOR_EMAIL` as Worker secrets; absent or invalid configuration denies administrator access. Keep the author email and tokens out of committed files and logs. Copy `.dev.vars.example` to ignored `.dev.vars` for local configuration; no development authentication bypass is supported.
- E2E uses `pnpm test:preview` to start a local JWKS issuer and the existing Workers build with fixture-only runtime values. It still verifies signed JWTs; HTTP issuers are accepted only when both issuer and request host are loopback. The fixture is outside the deployed application. CI restores Build output before local migration/preview and does not rebuild.
- New domain models, remote D1/R2 resources, authentication, editor features, and changes outside the accepted delivery scope require their own scoped work.

## Runtime and Package Management

- Use pnpm for commands and nested package scripts. Do not introduce npm/yarn lockfiles or npm-run script calls.
- Read the exact pnpm version from `packageManager` and Node version from `devEngines.runtime` in `package.json`.
- Keep runtime declarations and `pnpm-lock.yaml` synchronized. Do not add a separate Node version file.
- Keep the package version independent of target-version milestones. Release automation prepares it through a version PR after target-version work; do not bump it during ordinary implementation work.
- Use `pnpm install --frozen-lockfile` to verify reproducible installation.
- Dependency installation generates SvelteKit and Cloudflare types through `prepare`. Generated output stays ignored.
- When Wrangler configuration changes, run `pnpm gen` to regenerate the declaration file; never invent binding types or remote resource IDs. Keep the generated file ignored by Git; Prettier also respects the root `.gitignore`.
- Commit dependency build approvals only for packages actually needed by the project.

## Development Commands

- Install: `pnpm install`.
- Install the test browser once: `pnpm exec playwright install chromium`. CI adds `--with-deps`.
- Develop: `pnpm dev`.
- Format: `pnpm format`.
- Lint, including format checks: `pnpm lint`. ESLint warnings fail.
- Type-check: `pnpm check`.
- Check delivery automation alone: `pnpm check:automation`.
- Test delivery automation alone: `pnpm test:automation`.
- Apply pending local D1 migrations: `pnpm db:migrate:local`.
- Watch tests: `pnpm test:unit`.
- Run unit/component tests once with coverage: `pnpm test:unit --run --coverage`.
- Build for Workers: `pnpm build`.
- Preview the actual Workers build on port 4173: `pnpm preview`.
- Run E2E: `pnpm test:e2e`. Locally this builds and previews; CI must restore Build output first.
- Run the complete test suite: `pnpm test`.
- Check preview packaging without publishing: `pnpm exec wrangler deploy --dry-run --env preview`.

## Formatting, Lint, and Tests

- Treat tool configuration files as the source of exact options; do not duplicate their full contents in documentation.
- After completing changes and before creating a commit, run `pnpm format`, review the resulting diff, and run the applicable validation. Use the existing formatter command rather than adding a separate commit-hook framework.
- Preserve side-effect import positions and use the configured import order without extra group separators.
- Keep ESLint's type-aware recommended rules and Prettier compatibility. Scope justified exceptions narrowly.
- Use the fewest meaningful tests covering required behavior, critical failures, and regression risks. Do not add tests that only mirror configuration or manufacture unused production code for a test.
- Vitest separates Node and Chromium component execution. Playwright tests use `*.e2e.ts` or `*.e2e.js`.
- Coverage is diagnostic, with no minimum percentage gate. Vitest results appear in the Actions job summary; do not upload Vitest reports.
- CI retries Playwright once and stores HTML/failure evidence only after failure.
- Run the relevant checks and the complete configured test suite before reporting completion. Report unrun or failed checks explicitly.

## Database and Observability

- Drizzle Kit generates SQL locally without Cloudflare credentials. Use `pnpm db:generate --name=<descriptive-name>`.
- Always supply a descriptive English kebab-case migration name. Let Drizzle manage the sequence prefix.
- Commit SQL and Drizzle snapshots/metadata together. Never rename or edit an already applied migration; add a new migration.
- Wrangler is the sole future migration application/history tool. Align its migration directory with Drizzle output.
- Remote migration application belongs to CD after validation. Do not use schema push or mix migration history tools.
- Every D1 binding sets `migrations_dir` to `drizzle` and keeps Wrangler's default `d1_migrations` history. Use `pnpm exec wrangler d1 migrations apply DB --local` for local development; the default bindings use local emulation of preview resources. Add `--env preview` or `--env production` to select an explicit environment.
- CD runs `pnpm exec wrangler d1 migrations apply DB --remote --env <environment>` after build and target validation, then rechecks the target before deployment. Wrangler applies only files missing from its history; do not add a custom SQL/history comparator. Migration failure blocks deployment. Publication-only recovery skips migrations and deployment.
- Keep preview and production data/bindings separate when they are introduced. The preview Worker is named `blog-preview`.
- Persist invocation logs at 100% in both environments; persist traces at 100% in preview and 5% in production.
- Keep workers.dev and version preview URLs disabled. Preview uses `blog-preview.herokwon.dev`; production uses `blog.herokwon.dev`, each configured in its Wrangler environment.
- Log useful structured operational context; exclude credentials, session tokens, and draft bodies.

## CI and Review

- Keep Lint, Type Check, Build, and Test as separate jobs.
- Lint includes Prettier and ESLint. Test includes Vitest and Playwright, depends on Build, and restores that run's output after setup.
- Use the shared `pnpm/setup@v3` composite for cached frozen installation and package.json runtime selection.
- CI previews the existing Workers build without rebuilding. Include hidden build output in artifact transfer.
- Use PR-integrated Codex code review. Assess findings and address valid issues; a pending review is not a completed review.
- Keep the three issue templates and default PR template in English, preserving their emoji headings and `<br />` spacing.
- Link work issues through Development metadata; include explicit issue references in the work record. Do not require a duplicate Related Issues body section.
- Disable repository issue auto-closing. Issue closure is an explicit action based on verified outcomes.
- Run CI on PR changes (including base-branch changes) and manual dispatch. Deployment builds the merged commit independently; CI artifacts are shared only within the CI run.

## Delivery Automation

- Keep Superpowers plans, execution ledgers, logs, and review artifacts under ignored `.superpowers/`. Commit architectural decisions in `docs/adr/`; do not commit execution scratch files.
- Use stable `release/X.Y.Z` branches, `X.Y.Z` package versions, and immutable `vX.Y.Z` release tags. Integrate release PRs into `main` using a merge commit; implementation and bot PRs use the release branch.
- `.github/workflows/dependabot.yml` routes native default-branch PRs to the unique active release. Majors, `0.x` minors, mixed unsafe groups, unclassifiable updates, conflicts, and missing current-head Codex evidence require owner intervention. Persist minimal intake in exact-SHA `Dependabot Intake` checks authenticated by App ID, slug, and PR number; neutral provenance checks do not replace CI/review. Migrate authenticated legacy comments at their recorded SHA and read checks back before deleting unchanged comments.
- Synchronize Dependabot heads only through the App workflow. Human merges or extra commits cannot inherit intake; request a fresh native Dependabot update/recreation or handle the PR manually with required checks/review. Never copy a stale receipt to a new SHA. Trusted routing automation loads from `main`; release-only changes do not complete live rollout.
- `.github/workflows/release-version-bump.yml` prepares App-owned version PRs. `Release Readiness` requires the actual target version and activation-verified preview for the latest release head. Configure release branch protection before opening the first release PR.
- Native Codex personal settings may omit bot/App PRs. The existing release workflow requests `@codex review` once per App-owned version preparation PR head using an authenticated App marker, including after synchronization. Reuse current-head completed or in-progress reviews; keep the 30-minute wait and manual resumption. Other missing reviews require a manual request. Missing review is not successful review; owner-accepted findings do not enable automatic merging.
- Store `BLOG_BOT_CLIENT_ID` as a repository variable and `BLOG_BOT_PRIVATE_KEY` as an Actions secret. App jobs request only their required permissions: Contents/Pull requests/Issues write for PR mutations; Checks write only for Dependabot intake; Actions and Deployments read for evidence; Workflows write for dependency changes to workflow files; Actions write only for dispatching deferred work. Keep numeric App ID separate from bot user ID. No permanent ruleset bypass is permitted.
- Store `CLOUDFLARE_API_TOKEN` as an environment secret and `CLOUDFLARE_ACCOUNT_ID` as an environment variable in both `preview` and `production`. Restrict preview to `release/*` and production to `main`. No extra production reviewer is required initially. Never put secret values in files or chat.
- `.github/workflows/deployment.yml` starts on protected `main`/`release/*` pushes, skips branch creation, and verifies an exact matching merged PR before deploying. This preserves native Environment branch/SHA provenance; PR-closed runs use PR refs and cannot satisfy the selected branch restrictions. Valid bot merges follow the same path. Use standard environment-specific Wrangler deployment and native GitHub Environment records; do not add CI polling, duplicate Deployment records, or a separate trigger/version promotion workflow.
- Deployment requires the Cloudflare API to confirm one active version receiving 100% traffic with `workers/tag` equal to the deployed Git SHA. Use the existing environment token/account ID; keep API failures blocking. This proves Worker activation, not public URL availability or application health. Keep Bot Fight Mode enabled; public HTTP probes, browser verification, and challenge solving are outside this pipeline. Inspect actual state before recovery; automatic rollback is disabled.
- For recovery, use Actions **Run workflow** on the PR's target branch. Before workflows reach `main`, rerun the original event-driven run from its Actions page; the manual-dispatch UI is unavailable during bootstrap. Deployment accepts `pr-number` and `mode`: `deploy` repeats delivery, while `publish` recovers production Tag/Release creation from trusted successful deployment evidence without redeploying. Superseded commits are rejected. Resume Dependabot/version workflows with their `pr-number`; Dependabot manual resumption requires a verified intake from a native PR event.
- Keep one automation-owned deployment comment per PR/environment. Separate deployment failure from successful production delivery with publication failure. Preserve existing matching tags/releases and reject mismatched tags instead of moving them.
- Serialize Worker deployment by environment without cancelling active work; concurrency is not a durable FIFO queue. Recheck target refs before remote deployment and publication. Frozen production transitions defer dependency routing; successful completion resumes eligible PRs.
- Delete remote source branches only after successful applicable delivery and checks for changed heads, unmerged work, and open dependent PRs. Use the exact merged head as deletion evidence even after squash, and a Git deletion lease to abort if the remote head changes; never force-update branch commits. Agent-side cleanup must still preserve local work and fast-forward the base. Keep issue/milestone closure explicit.
- Initial rollout order is work PR into release, verified preview, release version preparation/readiness, then release PR into main and verified production publication. Native Dependabot and its trusted default-branch automation start only after reaching main. Do not report rollout complete without actual remote evidence.

## Project Metadata and Version Milestones

- Priority options: `p0`, `p1`, `p2`.
- Priority is the relative execution order for this project: `p0 > p1 > p2` (highest to lowest). Assess it independently of size, difficulty, or estimated hours; foundational prerequisite work can be `p0`.
- Size options: `xs`, `s`, `m`, `l`, `xl`.
- Estimate: a numeric number of hours for implementation plus verification.
- Use actual project options when available. Distinguish assigned field values from recommendations.
- Use target-version repository milestones for every issue and PR, including release PRs.
- Derive the target version from the agreed plan and `release/*` branch; clarify missing or conflicting versions.
- Check open and closed milestones before creating one. Reuse a matching milestone, reopening it for additional work when needed.
- Assign the milestone during creation, or immediately after when an API cannot set it atomically. Check existing assignments when continuing work.
- Update issue/PR milestones when the target version changes.
- After creating or updating an issue or PR, report its URL and the assigned milestone name and URL. After issue creation, also report priority/size recommendations and numeric hours.
- Close a milestone only after its release PR has merged into main, required release/deployment verification has succeeded, and all assigned work is complete. Otherwise keep it open.

## Work, Release, and Cleanup

1. Establish a plan before creating an issue. Include planned changes and verifiable acceptance criteria for each implementation element.
2. Create the issue and ensure its target-version milestone is assigned before implementation.
3. Work on a work branch based on the target `release/*`; open a work PR targeting that branch and assign the same milestone.
4. Run automated checks and Codex review, assess findings, and address valid findings.
5. Merge only after required checks and review requirements are satisfied.
6. Close the issue explicitly only after release-branch integration and applicable release-stage release, deployment, and verification succeed. Do not wait for main when those conditions are satisfied; keep the issue open for pending, failed, or unverified requirements.
7. Integrate `release/* -> main` through a reviewed PR summarizing included work and actual verification. The preview environment is associated with release branches and production with main.
8. After confirming merge, check the head has no unmerged or active dependent work, delete local/remote head branches, and fast-forward the local base. Preserve local changes and report blockers without forcing synchronization.

For `release/X.Y.Z -> main` PRs, use `release: ` followed by the source branch version enclosed in backticks (for example, release: `0.1.0`). Omit the `v` prefix from the PR title; retain `vX.Y.Z` for release tags. Other PRs keep their existing title conventions.

Use Conventional Commits 1.0.0 for commits and PR titles. Keep commits coherent and independently understandable. Use English for documentation, issues, PRs, and commits. Avoid automatic issue-closing keywords in commit messages and PR descriptions.

Record significant architecture decisions in concise `docs/adr/NNNN-short-title.md` documents with context, decision, and consequences. Commit an ADR before implementing its decision. Maintain essential documentation and update existing files rather than duplicating them.

## Code Review Rules

- Verify that local setup and CI require no remote credentials or fabricated D1/R2 resource IDs.
- Verify Build output is restored after dependency setup and that CI E2E does not perform a second build.
- Verify migrations retain a single application history and that publication/authorization boundaries are preserved as features are added.
- Verify privileged PR jobs execute only trusted automation and validated version-only preparation branches; do not install or execute Dependabot head code with mutation credentials.
- Verify automatic merging checks current-head CI and authenticated Codex review, and performs the actual merge with the App and an exact SHA.
- Verify active Worker version, native Deployment, Tag, Release, and PR comments identify the same actual merged commit and that partial failures remain recoverable.
