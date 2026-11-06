# ADR 0003: Dependabot Intake in App-Owned Checks

- Status: Accepted
- Date: 2026-11-07
- Related issue: https://github.com/herokwon/blog/issues/19
- Extends: [ADR 0002](0002-delivery-pipeline.md)

## Context

Dependabot routing persists authenticated metadata in hidden PR comments. Manual base merges change the head without updating that receipt, causing misleading fresh-intake failures. The owner selected App-only synchronization and Check Runs instead of receipt comments.

## Decision

- Persist minimal versioned intake data in a completed neutral `Dependabot Intake` check for the exact commit. Validate the numeric GitHub App ID and slug, repository-scoped response, PR number, check head, and receipt head before using it. This check records provenance, not CI or merge readiness.
- Give only the Dependabot App job Checks write permission. Keep bot user ID distinct from App ID. Keep fresh intake restricted to a single verified Dependabot commit from a current native event.
- Migrate authenticated legacy comments at their recorded SHA, including old heads, and read the matching check back before deleting the unchanged legacy comment. Never upgrade a stale receipt to trust a human-modified head.
- Only App-authenticated synchronization merges may carry receipts forward. A changed head without such evidence requires owner recovery; do not infer trusted provenance from PR authorship, successful CI, or a commit message. Keep conflicts and extra edits outside automatic merging.
- Preserve retryability when check writes, read-back, or comment deletion fail. Missing provenance blocks automation and gives instructions to obtain a fresh native Dependabot update or handle the PR manually under existing review requirements.

## Consequences

PR conversations no longer store new intake receipts. Checks add App permission and API calls, and are not a permanent archive: missing records require fresh intake. Legacy migration is compatibility code until existing PRs have migrated. Trusted Dependabot automation loads from main, so release-only integration does not complete live migration. No ruleset bypass or automatic adoption of manual merge heads is introduced.
