# CI/CD operations

## Production D1 migrations and Worker deployment

Apply and test migrations locally during development. Merging a same-repository `release/** → main` pull request authorizes production D1 migration and Worker deployment. The `deployment.yml` workflow uses the merged main commit and first confirms that a release Worker version is available. Its `Apply production D1 migrations` job runs `pnpm db:migrate:remote` when `drizzle/*.sql` files exist; otherwise the job succeeds without contacting D1. A failed migration prevents the Worker deployment. Wrangler applies only migrations not yet recorded in production D1.

Store `CLOUDFLARE_API_TOKEN` and `CLOUDFLARE_ACCOUNT_ID` as repository Actions secrets. The token needs permissions for D1 migration and Workers version upload, deployment, and trigger changes. No GitHub Environment or Required reviewers are used. Review release migration SQL and compatibility with the running Worker before merging. Worker rollback from the Cloudflare dashboard does not undo D1 schema changes.

Remove any branch protection requirement for the retired `Inspect production D1 migrations` or `Apply production D1 migrations` PR checks; migration now runs after merge and cannot be a pre-merge check.

Merged PRs into `release/**`, including Dependabot PRs, upload a candidate Worker version tagged with the release branch merge commit SHA and annotated with its release branch name. When the release PR merges into `main`, the workflow selects the newest deployable version annotated for that release branch, applies D1 migrations, then deploys the selected version and triggers. It does not build a new release Worker version after merging to `main`.

A merged `fix/** → main` PR with a `fix:` or `fix(scope):` title uploads and deploys a hotfix version. Hotfix PRs never run the D1 migration job. The workflow records a GitHub Deployment and comments on the merged PR with the result. A successful production Worker deployment creates a GitHub Release for the merged `package.json` version if that release does not already exist. Failed Worker deployment or migration requires manual investigation; reverting a Worker version does not revert D1.
