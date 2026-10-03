# CI/CD operations

See [Deployment](../architecture/deployment.md) for release and hotfix
policies, environment boundaries, and known policy/implementation differences.

## Worker type generation and validation

`wrangler.jsonc` is the source of truth for Worker bindings and runtime compatibility. Run `pnpm gen` after changing bindings, compatibility settings, or Wrangler, and commit `worker-configuration.d.ts`. `pnpm types:check` checks the committed types without regenerating them. Both `pnpm check` and `pnpm build` run this check first; Dependabot synchronization continues to use `pnpm gen`.

The shared `.github/scripts/worker-types.ts` script parses JSONC with TypeScript, creates a temporary configuration beside `wrangler.jsonc`, and omits `main` for type generation and validation. This keeps relative configuration paths intact and makes generated Env/runtime types independent of `.svelte-kit/cloudflare/_worker.js`. The temporary file is removed after Wrangler exits, including on failure, and generated headers use the stable `pnpm gen` command. Deployment still uses the original configuration and entrypoint.

This flow intentionally generates Env/runtime types without entrypoint-derived `Cloudflare.GlobalProps.mainModule`. Revisit it if the project adds exported RPC or Durable Object classes that need entrypoint-derived types. Avoid running bare `wrangler types` for repository type synchronization because it uses the build-dependent entrypoint.

## Production D1 migrations and Worker deployment

Apply and test migrations locally during development. Merging a same-repository `release/v<major>.<minor>.<patch> → main` pull request authorizes production D1 migration and Worker deployment. The `deployment.yml` workflow uses the merged main commit and first confirms that a release Worker version is available. Its `Apply production D1 migrations` job runs `pnpm db:migrate:remote` when `drizzle/*.sql` files exist; otherwise the job succeeds without contacting D1. A failed migration prevents the Worker deployment. Wrangler applies only migrations not yet recorded in production D1.

Store `CLOUDFLARE_API_TOKEN` and `CLOUDFLARE_ACCOUNT_ID` as repository Actions secrets. The token needs permissions for D1 migration and Workers version upload, deployment, and trigger changes. No GitHub Environment or Required reviewers are used. Review release migration SQL and compatibility with the running Worker before merging. Worker rollback from the Cloudflare dashboard does not undo D1 schema changes.

Remove any branch protection requirement for the retired `Inspect production D1 migrations` or `Apply production D1 migrations` PR checks; migration now runs after merge and cannot be a pre-merge check.

Merged PRs into `release/v<major>.<minor>.<patch>`, including Dependabot PRs, upload a candidate Worker version tagged with the release branch merge commit SHA and annotated with its release branch name. The workflow subscribes broadly to `release/**` events, but target resolution requires the versioned branch format. When the release PR merges into `main`, the workflow selects a deployable version whose tag matches that PR's final head SHA and whose annotation matches the release branch. It then applies D1 migrations and deploys the selected version and triggers. It does not build a new release Worker version after merging to `main`.

Verify the final release candidate before merging the release PR. A missing exact candidate blocks production D1 migrations and Worker deployment rather than falling back to an older upload. Resolve or finish the final candidate upload, then rerun the production workflow for the original release PR event. The candidate source SHA and main merge SHA are separate identifiers; do not compare the candidate tag with the main merge SHA.

A merged `fix/** → main` PR with a `fix:` or `fix(scope):` title uploads and deploys a hotfix version. Hotfix PRs never run the D1 migration job. The workflow records a GitHub Deployment and comments on the merged PR with the result. The current workflow creates a GitHub Release after successful production Worker and trigger deployment for the merged `package.json` version if that release does not already exist; its inclusion of hotfixes differs from the [agreed Release policy](../architecture/deployment.md#versions-and-github-releases). Failed Worker deployment or migration requires manual investigation; reverting a Worker version does not revert D1.
