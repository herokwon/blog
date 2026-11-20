# ADR 0001: Initial blog architecture and repository bootstrap

- Status: Accepted
- Date: 2026-11-16
- Related issue: [#1](https://github.com/herokwon/blog/issues/1)

## Context

Build a personal blog operated by one administrator. Prioritize sustainable
writing and publishing with little operational overhead, while learning Svelte.
Deliver the project incrementally rather than implementing the complete blog at
once. The domain is already managed in Cloudflare.

## Decision

Use a single TypeScript SvelteKit application on Cloudflare Workers. Keep public
pages and the `/admin` area in the same application, with server-side access to
Cloudflare resources through bindings:

- D1 and Drizzle for relational data, Markdown content, and publication metadata.
- Private R2 for images and attachments, without public bucket endpoints.
- Access for administrator authentication through GitHub only, restricted to one
  exact email address. Validate the Access identity on the server; do not trust
  an unverified email header.

Use pnpm with a committed lockfile, ESLint, Prettier, Vitest unit and component
tests, and Playwright. Start from the SvelteKit minimal template with the official
Cloudflare Workers adapter. Use stable dependencies without experimental opt-ins.

Create Cloudflare resources through the dashboard or CLI initially. Keep runtime
bindings, environment configuration, deployment workflows, and concise setup
instructions in version control. Infrastructure-as-code tooling is deferred.

Use GitHub Actions for verification and deployment. Maintain one fixed staging
environment for the active `release/*` branch and a production environment for
`main`, with separate D1, R2, and Access application configurations. Use local
emulation for development. Do not add per-PR preview deployments or a second
deployment pipeline through Workers Builds.

### Future product constraints

These decisions guide later versions; they are not features of version 0.0.1:

- Use Milkdown Crepe in the administrator editor and store Markdown. Render
  public content on the server with matching supported syntax and safe output.
- Store `draft`, `published`, and `archived` in the database and show Korean
  labels. New posts can start as draft or published. Subsequently allow only
  draft to published, published to archived, and archived to published.
- Saving preserves status; saving a published post immediately updates public
  content. Cancel returns to the parent list without saving. Public queries
  expose only published posts.
- Serve files through `/media/{postId}/{fileId}` and store R2 objects under
  `posts/{postId}/{fileId}`. Verify the post-file relationship in D1; a URL prefix
  alone does not authorize access. Initially, each file belongs to one post.
- Only published-post files are public. Draft, archived, and unattached uploads
  are administrator-only, with protected administrator preview routes. Initially
  do not cache dynamic post or media responses. Previously downloaded content
  cannot be recalled.
- Defer the editor, uploads, media routes, product schema, deletion, search,
  backup automation, multiple authors, user registration, and revision workflows.

### Bootstrap and version boundaries

Version 0.0.1 is an explicitly approved exception to PR-only changes. Initialize
`main` with exactly two commits and push them together:

1. This architecture decision, committed before generating the application.
2. The unchanged CLI-generated project, selected add-ons, and pnpm lockfile.

Generate the baseline using Svelte CLI 1.4.0, template `minimal`, TypeScript,
Prettier, ESLint, Vitest (`unit,component`), Playwright (demo enabled), Drizzle
(`d1`), and the SvelteKit adapter (`cloudflare`, Workers target). Preserve
generated demos and placeholders. Do not provision live Cloudflare resources or
include credentials. Verify that the generated package version is 0.0.1.

After the initial push, require PRs for updates to `main` and `release/*` and
restrict force pushes and branch deletion. Create `release/0.1.0` from the
baseline for subsequent work. Work PRs squash into `release/*`; release PRs use
merge commits into `main` with the owner's approval. Never squash the two
bootstrap commits together.

Version 0.1.0 adds development configuration, resource and environment setup,
CI/CD, a minimal protected administrator confirmation route, server identity
validation, and bounded resource connectivity checks. It can add necessary
server code and tests; it is not limited to configuration files. It does not
implement blog product features. Record actual verification results and blockers.

Check Codex reviews from `chatgpt-codex-connector[bot]`. If automatic review does
not run, request it with `@codex review`. Address valid findings and confirm
review of the latest changes. Missing review is pending, not a pass. Distinguish
Codex review evidence from GitHub's native approving-review count so repository
rules remain usable by a solo owner. Do not close issues or milestones without
the required release verification and explicit owner authorization.

## Alternatives considered

- A static, file-authored blog would simplify hosting, but does not provide the
  requested web editor and administrator-controlled publishing workflow.
- A separate backend or external database, storage, and authentication services
  would improve provider flexibility but add deployment and operations overhead
  without a current requirement.
- Terraform could reproduce infrastructure declaratively but adds tooling and
  state management before it is needed.

## Consequences

The application and its infrastructure stay small and integrated. Cloudflare
bindings and Access introduce provider dependence, mitigated by portable Markdown,
SQL exports, and object files. Private media requires server-side ownership and
publication checks and initially trades caching performance for straightforward
access revocation. D1 and R2 operations are not one cross-service transaction;
future deletion and cleanup workflows must account for partial failure.

## References

- https://svelte.dev/docs/cli/sv-create
- https://github.com/sveltejs/cli/blob/main/packages/sv/CHANGELOG.md
- https://svelte.dev/docs/cli/sveltekit-adapter
- https://developers.cloudflare.com/workers/framework-guides/web-apps/sveltekit/
- https://orm.drizzle.team/docs/connect-cloudflare-d1
- https://developers.cloudflare.com/r2/api/workers/workers-api-usage/
- https://developers.cloudflare.com/r2/buckets/public-buckets/
- https://developers.cloudflare.com/cloudflare-one/integrations/identity-providers/github/
- https://developers.cloudflare.com/cloudflare-one/access-controls/policies/
- https://milkdown.dev/docs/guide/using-crepe
- Modern Web Guidance `forms` guide (retrieved in full during design): semantic
  controls, server-side validation, accessible submission feedback, and preserving
  input on errors are verification criteria for later administrator forms.
