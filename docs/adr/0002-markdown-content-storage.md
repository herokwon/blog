# ADR-0002: Markdown Content Storage

## Status

Accepted

## Context

The Content editor needs a durable representation that remains portable, readable, and suitable for server-side rendering and summary extraction. HTML and editor-specific JSON would couple persisted data to a renderer or editor model.

## Decision

Persist the Content body as Markdown source text. Use Milkdown as the Admin editor. Milkdown's ProseMirror state is transient; saving serializes it to Markdown. Public rendering and summary extraction use the same Markdown/Remark policy.

The initial editor feature set is intentionally limited to required CommonMark/GFM, history, clipboard, listener, and code-block capabilities.

## Alternatives Considered

- A custom `contenteditable` editor would require implementing selection, history, clipboard behavior, and Markdown conversion.
- HTML storage would require sanitization and couples the database to rendered markup.
- Editor JSON storage would preserve an internal model but reduce portability and complicate rendering outside the editor.
- A plain textarea with preview is simpler, but does not provide the desired authoring experience.

## Consequences

Markdown remains portable and is the Content SSoT. Milkdown introduces client-side integration and may normalize equivalent Markdown during serialization. The editor must be isolated from SSR, and the rendering/summary pipeline must remain consistent with the editor's supported Markdown.
