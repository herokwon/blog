# CI/CD operations

See [Deployment](../architecture/deployment.md) for release and hotfix
policies and environment boundaries.

## Worker type generation and validation

`wrangler.jsonc` is the source of truth for Worker bindings and runtime compatibility. Run `pnpm gen` after changing bindings, compatibility settings, or Wrangler, and commit `worker-configuration.d.ts`. `pnpm types:check` checks the committed types without regenerating them. Both `pnpm check` and `pnpm build` run this check first; Dependabot synchronization continues to use `pnpm gen`.

The shared `.github/scripts/worker-types.ts` script parses JSONC with TypeScript, creates a temporary configuration beside `wrangler.jsonc`, and omits `main` for type generation and validation. This keeps relative configuration paths intact and makes generated Env/runtime types independent of `.svelte-kit/cloudflare/_worker.js`. The temporary file is removed after Wrangler exits, including on failure, and generated headers use the stable `pnpm gen` command. Deployment still uses the original configuration and entrypoint.

This flow intentionally generates Env/runtime types without entrypoint-derived `Cloudflare.GlobalProps.mainModule`. Revisit it if the project adds exported RPC or Durable Object classes that need entrypoint-derived types. Avoid running bare `wrangler types` for repository type synchronization because it uses the build-dependent entrypoint.

## Production D1 migrations and Worker deployment

Apply and test migrations locally during development. Merging a same-repository `release/v<major>.<minor>.<patch> → main` pull request authorizes production D1 migration and Worker deployment. The `deployment.yml` workflow uses the merged main commit and first confirms that a release Worker version is available. Its `Apply production D1 migrations` job runs `pnpm db:migrate:remote` when `drizzle/*.sql` files exist; otherwise the job succeeds without contacting D1. A failed migration prevents the Worker deployment. Wrangler applies only migrations not yet recorded in production D1.

Store `CLOUDFLARE_API_TOKEN` and `CLOUDFLARE_ACCOUNT_ID` as repository Actions secrets. The token needs permissions for D1 migration and Workers version upload, deployment, and trigger changes. No GitHub Environment or Required reviewers are used. Review release migration SQL and compatibility with the running Worker before merging.

Remove any branch protection requirement for the retired `Inspect production D1 migrations` or `Apply production D1 migrations` PR checks; migration now runs after merge and cannot be a pre-merge check.

Merged PRs into `release/v<major>.<minor>.<patch>`, including Dependabot PRs, upload a candidate Worker version tagged with the release branch merge commit SHA and annotated with its release branch name. The workflow subscribes broadly to `release/**` events, but target resolution requires the versioned branch format. When the release PR merges into `main`, the workflow selects a deployable version whose tag matches that PR's final head SHA and whose annotation matches the release branch. It then applies D1 migrations and deploys the selected version and triggers. It does not build a new release Worker version after merging to `main`.

Verify the final release candidate before merging the release PR. A missing exact candidate blocks production D1 migrations and Worker deployment rather than falling back to an older upload. Resolve or finish the final candidate upload, then rerun the production workflow for the original release PR event. The candidate source SHA and main merge SHA are separate identifiers; do not compare the candidate tag with the main merge SHA.

Hotfix deployment follows the [delivery procedure](#hotfix-delivery-and-synchronization) below. GitHub Release creation runs only after successful regular promotion, including Worker and trigger deployment, and skips an existing release for the merged `package.json` version.

## Deployment identification and results

The target package version and source SHA are captured before candidate selection or building. GitHub Deployment payloads and PR comments record them together with the target merge SHA, available Worker Version IDs, originating PR, and Actions run link. The Deployment status includes the run's `log_url`. A single report job prepares both outputs; failure to record the Deployment does not prevent the PR comment when report preparation succeeded.

Wrangler uploads write structured NDJSON through `WRANGLER_OUTPUT_FILE_PATH`. The workflow reads the `version-upload` record's `version_id` and optional `preview_url`; it does not parse human-readable command logs. Promotion uses the Version ID returned by exact candidate selection. Production deployment specifies that ID at 100% traffic.

PR comments use the heading `⚡ Cloudflare Workers deployment`. The Version ID appears once, labeled with its confirmed stages: selected, uploaded, and/or deployed. Equal merge/source SHAs share one row with both meanings; different SHAs remain separate. Candidate selection, migration, upload, Worker deployment, and triggers results are shown individually. The machine-readable payload retains separate fields for each identity and stage.

Candidate upload success confirms upload only. Failed or skipped deployment does not claim a deployed Version ID; inspect the actual production state before retrying or recovering because failed commands may partially change it. Worker deployment success followed by triggers or later-step failure retains the deployed ID and reports partial success with an overall failed GitHub Deployment status.

## Hotfix delivery and synchronization

1. Update local main from the remote and create a `fix/**` branch from that latest main. Keep the change compatible with the production D1 schema; use regular promotion for schema changes. Hotfixes do not automatically bump the package version, run D1 migrations, or create GitHub Releases.
2. Open a same-repository PR targeting main with a `fix:` or `fix(scope):` title. Merge after CI passes and manual review approves it; this triggers Worker upload and production deployment. A preceding deployment failure is not required.
3. Check the deployment result and actual production Worker Version ID. Verify the affected behavior and relevant production paths, and record the results on the PR. Workflow success alone does not confirm incident resolution. If deployment fails or the incident remains unresolved, follow the recovery procedure below before synchronizing.
4. Open a synchronization PR from main into the active `release/v…` branch. Review its complete diff, resolve conflicts while preserving the verified fix and intended release work, and pass CI. Merge with a **merge commit** so the main history is included in the release branch; select this method even though squash merge is also enabled in the repository.
5. Confirm the synchronization merge triggers a successful candidate upload. Verify the new candidate's Version URL, source SHA tag, release-branch annotation, and inclusion of the hotfix. Candidate checks use shared production D1 and must remain read-only; validate writes locally.
6. Before regular promotion, verify the candidate matching the release PR's final head SHA, including after any later release-branch change. The final candidate must contain the hotfix and satisfy the exact-candidate gate.

PR creation, review, operational verification, synchronization, and release-resumption decisions are manual responsibilities. No automatic synchronization or rollback workflow is added.

## Failure recovery and release resumption

1. Pause synchronization and regular promotion when deployment fails or an incident remains unresolved. Inspect the Actions results, production Worker version and triggers, and applied D1 migrations. Successful earlier steps may remain despite an overall failure.
2. For a transient deployment failure, investigate the cause and confirm that the intended code and current schema are safe before rerunning the original deployment. Verify production after the rerun.
3. When immediate recovery is needed, choose a previously working Worker version that is compatible with the **current** production D1 schema and restore it through the Cloudflare dashboard. Worker recovery does not reverse D1 migrations. Verify the actual restored version, affected behavior, and relevant production paths.
4. Reconcile Git with the intended recovered behavior. If main still contains problematic changes, open a follow-up fix or revert PR from the latest main using the same `fix/** → main`, title, CI, and review conventions. Verify its deployment before resuming. A dashboard restoration alone leaves Git reconciliation outstanding and later deployments may reintroduce the problem.
5. Resume synchronization only after the incident is resolved, production state is confirmed, and intended Git code is reconciled and verified. Follow the synchronization procedure above, including a new candidate upload and verification, before regular promotion resumes.

Record recovery on the originating PR or a linked incident Issue. Include:

- Recovery time, operator, reason, and originating PR/Actions run.
- Actual source and restored target Worker Version IDs and their known source SHAs/tags; identify unavailable mappings explicitly.
- Applied D1 migration state and the current-schema compatibility assessment.
- Recovery action, production verification results, and whether the incident is resolved.
- Follow-up fix/revert PR or outstanding Git reconciliation work, and the synchronization PR/new candidate verification when completed.

Dashboard recovery does not automatically update GitHub Deployment records. Keep the manual recovery record linked to the original attempt so its automated report is not mistaken for the current production state.
