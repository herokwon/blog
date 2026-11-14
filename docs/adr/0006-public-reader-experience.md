# ADR 0006: Public Reader Experience

- Status: Accepted
- Date: 2026-11-14
- Related issue: https://github.com/herokwon/blog/issues/81
- Extends: [ADR 0004](0004-author-administration.md)

## Context

Authoring and delivery are established, while public reading has only a chronological list and detail page. The owner approved discovery, long-form navigation, metadata and RSS for 0.3.0. Explicit HTML line breaks currently disappear although the editor displays them.

## Decision

- Reuse the existing SvelteKit SSR application, D1 schema and sanitized Markdown pipeline. Add no external search service or new storage.
- Extend the public list with URL-backed title substring search, one category ID and one exact case-sensitive tag name, combined with AND. Identical tag names across posts are discovery labels, not global identities. Keep 20 posts ordered by first publication and ID.
- Apply the existing published-and-not-deleted condition to every public list, classification choice, sitemap and RSS entry. Unknown/private records remain indistinguishable. Preserve no-store responses and media authorization.
- Preserve Markdown paragraphs and hard breaks. Permit only exact attribute-free HTML break forms <br>, <br/> and <br /> outside code by converting them to safe break nodes before HTML rendering. Other authored HTML remains disabled; ordinary soft breaks do not become hard breaks. Keep editor save/reload and public structure consistent with scoped shared typography.
- Produce heading IDs and a table of contents together on the server, using a namespace distinct from footnotes. Keep native fragment links and individually keyboard-scrollable code/table regions.
- Generate descriptions from readable paragraph text, at most 160 Unicode characters, excluding code/raw HTML with title fallback. Use https://blog.herokwon.dev for canonical URLs. Add Open Graph, a public-only sitemap, environment-aware robots rules and summary RSS 2.0 for the latest 20 public posts. Preview and search/filter/error pages are not indexable.
- Use native GET search forms, semantic landmarks, visible labels/focus, relative typography and non-JavaScript reading/navigation. Retain semantic tables with overflow rather than transforming arbitrary Markdown into cards.

## Consequences

Existing addresses, first-publication ordering, explicit saving, private media and delivery policies are unchanged. Previously ignored explicit breaks become visible without rewriting stored posts. No schema migration is needed. Reader bundles remain free of the editor. Crawling directives are not authorization and cannot revoke content already downloaded by readers or feed consumers. Full-text search, global tag management, redesign, autosave, revisions and cleanup remain separate work.
