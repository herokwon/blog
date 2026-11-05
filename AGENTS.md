# Project Instructions

## Purpose and Architecture

Build and operate a single-author personal blog while learning Svelte. Use the accepted architecture in [ADR 0001](docs/adr/0001-blog-architecture.md). Keep the initial environment separate from future domain features and remote deployment work.

- Use the existing SvelteKit 3 / Svelte 5 TypeScript application and Cloudflare Workers adapter.
- Author application and configuration code in TypeScript. Keep strict TypeScript/Svelte checks; compiled JavaScript imported by generated Workers declarations is not an authored source-check target.
- Follow native `#lib` imports and the CLI project structure. Keep database and credential access in server-only modules.
- Reuse existing capabilities and choose the smallest clear implementation. Avoid abstractions without a current need.
- Store future post bodies as Markdown. Keep the browser-only editor out of public rendering bundles.
- Public content and attachments must follow publication visibility; author operations require application-side authorization.
- New domain models, remote D1/R2 resources, authentication, editor features, domains, and deployment require their own scoped work.

## Runtime and Package Management

- Use pnpm for commands and nested package scripts. Do not introduce npm/yarn lockfiles or npm-run script calls.
- Read the exact pnpm version from `packageManager` and Node version from `devEngines.runtime` in `package.json`.
- Keep runtime declarations and `pnpm-lock.yaml` synchronized. Do not add a separate Node version file.
- Keep the package version independent of target-version milestones. Version updates belong to future release automation after the target-version work is complete; do not bump it during ordinary implementation work.
- Use `pnpm install --frozen-lockfile` to verify reproducible installation.
- Dependency installation generates SvelteKit and Cloudflare types through `prepare`. Generated output stays ignored.
- When Wrangler configuration changes, run `pnpm gen` to regenerate and format the declaration file; never invent binding types or remote resource IDs.
- Commit dependency build approvals only for packages actually needed by the project.

## Development Commands

- Install: `pnpm install`.
- Install the test browser once: `pnpm exec playwright install chromium`. CI adds `--with-deps`.
- Develop: `pnpm dev`.
- Format: `pnpm format`.
- Lint, including format checks: `pnpm lint`. ESLint warnings fail.
- Type-check: `pnpm check`.
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
- Keep preview and production data/bindings separate when they are introduced. The preview Worker is named `blog-preview`.
- Persist invocation logs at 100% in both environments; persist traces at 100% in preview and 5% in production.
- Keep workers.dev and preview URLs disabled; public routes and domains require separate deployment work.
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

Use Conventional Commits 1.0.0 for commits and PR titles. Keep commits coherent and independently understandable. Use English for documentation, issues, PRs, and commits. Avoid automatic issue-closing keywords in commit messages and PR descriptions.

Record significant architecture decisions in concise `docs/adr/NNNN-short-title.md` documents with context, decision, and consequences. Commit an ADR before implementing its decision. Maintain essential documentation and update existing files rather than duplicating them.

## Code Review Rules

- Verify that local setup and CI require no remote credentials or fabricated D1/R2 resource IDs.
- Verify Build output is restored after dependency setup and that CI E2E does not perform a second build.
- Verify migrations retain a single application history and that publication/authorization boundaries are preserved as features are added.
