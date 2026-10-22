# Authoring layout stability implementation plan

> Execute inline with superpowers:executing-plans and TDD.

**Goal:** Implement [Issue #77](https://github.com/herokwon/blog/issues/77): wrap long editor input, separate notices from the heading, and prevent unexplained height growth.

**Architecture:** Keep the existing PostForm/ResultNotice/Crepe integration. Measure rendered geometry before changing CSS; use supported CodeMirror wrapping configuration for nested code editing.

**Tech stack:** Svelte, Tailwind CSS, Milkdown Crepe, CodeMirror, Playwright.

**Constraints:** Preserve toolbar/body scrolling, caret visibility, Markdown semantics, strict CSP, recovery and processing locks. No dependencies, API changes or deployment.

## Task 1: Notice geometry

- [x] Add new/edit browser cases for heading-to-notice spacing, compact one-line feedback, multiple notices, repeated show/dismiss and stable editor/page bounds.
- [x] Run against the baseline and record the specific failing geometry.
- [x] Fix the demonstrated cause in PostForm spacing and ResultNotice dismiss-button geometry.
- [x] Rerun focused cases, including mobile and short viewports.

## Task 2: Long input

- [x] Add rendered checks for long URL/unbroken paragraph, pasted input and code lines; measure document, editor and nested code scrollers.
- [x] Observe failures before changing width/wrapping rules.
- [x] Apply minimal form/editor width constraints and supported CodeMirror wrapping extension as required by evidence.
- [x] Verify text remains intact, caret is visible and vertical body scrolling retains the toolbar.

## Task 3: Integration

- [x] Run check, lint and the project suite, inspect desktop/mobile screenshots and review the diff.
- [x] Update content-domain and Admin validation documentation with actual findings and limitations.
- [x] Leave work on the dedicated local branch, with no merge/deployment.

## Review focus

- New/edit validation must not discard input or change dirty-state behavior.
- Short viewports may scroll naturally; do not clip controls to enforce a height.
- Code wrapping must retain source and strict CSP nonce propagation.
- Multiple feedback blocks must take natural space without cumulative growth.
- Shared dismiss-button changes must retain keyboard focus and feedback actions.
