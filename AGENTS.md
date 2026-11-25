# Repository Guidelines

- Title `release/*` → `main` pull requests using `` release: `<version>` ``, where `<version>` is the target release version. Example: `` release: `0.1.0` ``.
- A version bump PR from the configured GitHub App may omit a tracking issue when its head is the same repository's `codex/bump-<version>` branch and its base is the matching `release/<version>` branch. Require the target milestone, CI, and review.
- Link related issues for work PRs using GitHub Development. The metadata check verifies the target milestone.
- Same-repository Renovate dependency PRs targeting a release branch are exempt from milestone checks and automatic tracking issues. Include merged Renovate PRs when preparing the release summary.
- Link directly related issues in an ADR when they provide context for the decision or track follow-up work.
- Before committing, run `pnpm run format`, review the resulting changes, and ensure `pnpm run lint` passes.
