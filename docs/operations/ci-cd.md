# CI/CD operations

## Production D1 migrations

Apply and test migrations locally during development. When a same-repository `release/** → main` pull request is opened, updated, or reopened, the production D1 workflow checks whether its `drizzle` directory contains SQL migrations. Without SQL files, the apply job is skipped.

Configure a `production-migration` GitHub environment with required reviewers. Store `CLOUDFLARE_API_TOKEN` (D1 Edit) and `CLOUDFLARE_ACCOUNT_ID` as environment secrets. Require both `Inspect production D1 migrations` and `Apply production D1 migrations` checks for PRs into `main` so an inspection failure or an unapproved migration blocks merging. The workflow must exist on `main` before its `pull_request_target` event can run.

When SQL files exist, review them and confirm that the running Worker remains compatible with the resulting schema before approving the environment job. The job uses dependencies and `db:migrate:remote` from trusted `main`, copies only SQL files from the pinned release PR head, confirms the PR has not changed, then runs `pnpm db:migrate:remote`. Wrangler applies any migrations not yet recorded in production D1. A later PR update triggers a new run; approving an obsolete run fails its PR head check.

The workflow requests approval on each listed PR event while SQL files exist, even when all migrations were already applied. Wrangler then reports that there is nothing to apply. A Worker rollback in the Cloudflare dashboard does not undo D1 schema changes, so verify code and schema compatibility before testing a candidate Version URL or rolling back.
