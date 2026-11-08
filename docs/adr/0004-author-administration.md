# ADR 0004: Author Administration and Publication Boundaries

- Status: Accepted
- Date: 2026-11-07
- Related issue: https://github.com/herokwon/blog/issues/29
- Extends: [ADR 0001](0001-blog-architecture.md)

## Context

The application has a delivery baseline but no content domain or administrator workflow. Version 0.2.0 introduces single-author administration and minimal public reading. The owner approved explicit saving, immutable published addresses, a separate archive and recoverable trash. Keep the existing application and delivery architecture, and integrate each objective through a separate issue and PR.

## Decision

### Posts and classification

- Generate post IDs as UUIDv7 on the server. Persist Markdown, not executable MDX.
- Use exactly three states: `draft`, `published`, `archived`. New content can create a draft or publish directly. Only published posts can archive; only archived posts can republish. Published posts cannot revert to drafts.
- New forms offer Create draft / Publish; drafts Save / Publish; published posts Save / Archive; archived posts Save / Republish. A published save immediately updates public content. Saving, publishing and republishing validate and persist the current input atomically.
- Model trash separately with nullable `deleted_at`. Trashing published content atomically archives it. Restore clears the deletion marker without making content public. Drafts remain drafts; posts with publication history remain archived. Trashed posts are read-only. No permanent deletion or automatic expiry in 0.2.0.
- Store UTC ISO 8601 strings with millisecond precision. Both `created_at` and `updated_at` use `DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ', 'now'))`; later post mutations explicitly refresh `updated_at`. Set nullable `published_at` on first publication and preserve it through archive, republication and restore. Preserve `created_at`.
- Require a directly entered slug only at first publication. Allow at most 120 characters matching `^[a-z0-9]+(?:-[a-z0-9]+)*$`; do not generate or normalize it automatically. Lock it after first publication and retain global uniqueness reservations across drafts, archive and trash.
- Use debounced availability feedback without treating it as a reservation. Exclude the current post, ignore stale responses, and enforce server validation and database uniqueness when writing.
- Publishing requires a nonblank title and body and one existing flat category. Drafts may be incomplete. Allow titles up to 200 characters and Markdown up to 1 MiB.
- Provide category creation, renaming and deletion, with trimmed unique names up to 20 characters. Block deletion while any draft, published, archived or trashed post references the category. Renaming is reflected wherever displayed.
- Support optional tags with inline creation, selection and association removal: names up to 40 characters, at most 20 per post, without duplicate associations. A standalone tag management screen is outside this release.
- Detect stale writes, retain submitted content after failures, and avoid partial post, tag or image-reference updates.

### Authoring and public access

- Use named SvelteKit form actions for administrator mutations. Separate endpoints handle slug availability and image transfer. Keep authorization, database and credential access server-only.
- Protect administrator paths with separate preview/production Cloudflare Access applications using GitHub and one exact allowed author email. The application validates JWT signature, issuer, audience, expiry and email; missing configuration or invalid identity fails closed. Validate mutation origins. An identity header alone is insufficient.
- Load Milkdown Crepe only in browser editor routes. Persist Markdown using stable media identifiers. Support CommonMark/GFM content and sanitize server-rendered HTML and URL protocols; exclude unsupported editor math/diagram features and executable raw HTML. Public bundles do not contain the editor.
- Use `window.confirm()` for confirmation-required archive, trash, category deletion and discarding edits during in-app navigation. Cancel preserves state and input. Archive/trash do not implicitly save pending edits. For reload/tab closure, register `beforeunload` only while dirty and use the browser-controlled warning; avoid duplicate prompts.
- Provide basic responsive administrator lists/editing/category management and public list/detail pages. Paginate 20 posts, ordering administrator lists by `updated_at` and public lists by first `published_at`, with descending ID as the tie-breaker.
- Public post routes expose only `published` posts without `deleted_at`. Unknown or nonpublic post/media identifiers return 404. Public search and category/tag navigation are deferred.

### Images, storage and delivery

- Use independent preview/production D1 databases and private R2 buckets. Accept JPEG, PNG, GIF and WebP only, at most 10 MiB per file, with server-side size and format checks. Do not expose a public bucket/domain.
- Keep uploads private before initial post creation and until a save references them. Do not create hidden drafts or autosave to attach images. Use authenticated administrator preview routes without persisting their URLs in Markdown.
- Public image delivery requires a current saved-body reference from an undeleted published post. Removing the reference, archiving or trashing the post revokes public access. Use non-cached responses for content and media; already downloaded copies cannot be revoked.
- Clean new objects after failed upload metadata persistence. Successful abandoned uploads remain private; background cleanup and a shared media library are deferred.
- Generate named SQL and snapshots with Drizzle; Wrangler alone applies and records migrations. Use actual resource identifiers. Local setup and CI use local D1/R2 and fixture-signed authentication without remote credentials or a deployed authorization bypass.
- Extend existing serialized delivery with target checks and additive target-environment migrations after build validation and before deployment. Migration failure blocks deployment; recheck target refs before deploying. Publication-only recovery does not repeat migration/deployment. Preserve existing activation proof and publication rules from [ADR 0002](0002-delivery-pipeline.md).

## Consequences

Content publication needs no application rebuild. Immutable slugs and first-publication dates preserve links and ordering, but cannot be edited after initial publication. Archive/trash revoke application access without deleting retained data; trash and abandoned uploads consume storage until a future cleanup feature.

The minimal release excludes autosave, scheduled publication, revision history, statistics, multiple authors, permanent deletion and advanced public navigation. Access, D1/R2 provisioning and migration permissions need real environment configuration before live use. Local tests and activation proof do not replace authenticated feature acceptance. Architectural documentation is integrated before schema, authorization, editor, image and public-rendering implementation, each delivered through a separate reviewed PR and focused commits.
