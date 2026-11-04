# ADR 0001: Personal Blog Architecture and Development Baseline

- Status: Accepted
- Date: 2026-11-05
- Related issue: https://github.com/herokwon/blog/issues/1

## Context

The owner wants to publish project experiences, study notes, essays, and daily-life writing while learning Svelte through a real project. React experience is available, but Svelte was deliberately selected as the learning focus. The initial repository is empty.

The first implementation establishes a working development environment and CI, rather than building the blog's content features. Keep the application and its operational surface small.

## Decision

### Application and content direction

- Use a single TypeScript SvelteKit application on Cloudflare Workers for public pages and the author-only administration area.
- Follow SvelteKit 3 conventions, including the native `#lib` package import path.
- Render public content on the server so publication does not require rebuilding the application.
- Build the authoring interface incrementally with Milkdown Crepe, loaded only in the browser on editing routes. Persist Markdown rather than executable MDX.
- Use one representative flat category and multiple tags per post. Post URLs are independent of categories.
- New posts start as drafts and are explicitly published. Saving an already published post immediately updates public content; no separate published snapshot is planned initially.
- Readers do not need accounts. Comments and other reader participation are outside the initial scope.
- Plan D1 for content and metadata, and private R2 storage for attachments. Serve published attachments publicly through authorization-aware application routes.
- Plan Cloudflare Access authentication with GitHub as the identity provider and an exact allowed email. Verify author authorization at the application boundary.

### Development and delivery baseline

- Generate a minimal TypeScript project with the Svelte CLI and its Drizzle, Vitest, Playwright, ESLint, Prettier, and Cloudflare Workers adapter add-ons.
- Use pnpm throughout. Pin pnpm with `packageManager` and Node.js with `devEngines.runtime` in `package.json`; do not add a separate Node version file.
- Use typed ESLint rules, Prettier with Svelte/import-order support, Node unit tests, Chromium component tests, and Chromium Playwright E2E tests.
- Generate descriptive named SQL locally with Drizzle Kit without database credentials. Wrangler will be the single migration application/history tool. Commit SQL and Drizzle metadata together.
- Keep Lint, Type Check, Build, and Test as separate CI jobs. Lint runs formatting plus ESLint; Test runs Vitest plus E2E after restoring Build output. CI E2E starts preview without a second build.
- Show Vitest results in the GitHub Actions job summary without uploading Vitest reports. Upload Playwright HTML and failure evidence only when tests fail.
- Reuse `pnpm/setup@v3` in a composite action for runtime/package-manager installation, cache, and frozen dependency installation.
- Use PR-integrated Codex code review and link issues through Development metadata. Disable repository issue auto-closing so closure follows verified release-stage results.
- Integrate work through `work branch -> release/* -> main`. Release branches are for staging verification; main represents production integration.
- Configure persisted invocation logs at 100% in both environments; trace sampling is 100% for staging and 5% for production.

### Initial implementation boundary

Do not create domain tables, remote D1 databases or R2 buckets, authentication/authoring features, domains, or deployment pipelines in the bootstrap task. Prepare the local build and tool configuration without fabricated resource IDs or remote credentials.

## Alternatives Considered

- **React/Next.js:** reuses existing experience and editor integration, but does not meet the owner's preference to learn Svelte in this project.
- **Managed CMS:** reduces implementation work, but the owner prefers building a small authoring experience incrementally.
- **Separate frontend and API services:** provide independent deployment, but add unnecessary complexity for a single-author blog.
- **Separate draft and published snapshots:** protect the public version while editing, but the owner selected save-immediately behavior for published posts.
- **Drizzle remote management configuration:** supports direct management with API credentials, but couples local generation to credentials and bypasses the chosen reviewed-SQL delivery path.
- **Separate format/E2E CI jobs:** allow more parallel execution, but duplicate the responsibility already grouped in the approved package scripts.

## Consequences

- Svelte and Cloudflare-specific behavior are part of the learning and maintenance cost.
- The custom authoring interface needs future persistence, media handling, and authorization work.
- D1's SQLite constraints must be considered when domain migrations are designed.
- The Test job waits for Build, trading some parallelism for one build and a small workflow.
- Required CI checks and actual PR review results remain the merge criteria.
- Future remote configuration and deployment require their own concrete design and verified acceptance criteria.
- Recurring development commands and collaboration rules belong in `AGENTS.md`; exact tool options belong in their configuration files.
