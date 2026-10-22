# Admin Loading Feedback Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:executing-plans or superpowers:subagent-driven-development after plan review and execution-method selection. Steps use checkbox syntax for tracking.

**Goal:** Deliver Issue #83's timing improvements, Admin loading inventory and list-menu region overlays in one implementation PR targeting `release/v0.2.2`.

**Architecture:** Retain `AdminProcessing`, `ProcessingIndicator` and existing result notices. Delay only visual loading; complete requests, refreshes, data application and temporary locks independently of feedback timers. Reuse the existing five-second success notice and persistent non-success notices for readable, nonblocking completion feedback rather than adding a second result renderer or an artificial processing delay.

**Tech Stack:** Svelte 5, SvelteKit 3, TypeScript, Vitest browser tests, Playwright and the existing local D1 fixture. No dependency additions.

**Spec:** [Issue #83](https://github.com/herokwon/blog/issues/83), read on 2026-10-21, and the approved in-chat scope. This document proposes implementation details for review; it does not mark implementation or acceptance complete.

## Global Constraints

- One Issue and one implementation PR; focused implementation, regression-test and documentation commits, referencing #83.
- Compare **200ms display delay** and **400ms minimum feedback visibility**, measured from actual appearance; these are candidates, not standards or final values.
- Do not delay requests, refreshes, result application or error reporting to satisfy a visual timer.
- Once actual processing settles, stop the spinner, remove the blocking overlay and release processing-only locks. Preserve restrictions required by read-only, conflict or uncertain state.
- Never label an observed state as a confirmed mutation success. Preserve revision checks, confirmation cancellation, recovery and original-request retry rules.
- Existing notice expiry, user dismissal, hover/focus pause and persistent failure guidance take precedence over a new minimum interval. Do not force a dismissed result to reappear.
- No Cloudflare Access login changes, new navigation subsystem, API/DB changes, Production deployment or automatic merge.

## Review Focus

1. Completion immediately after visual appearance must show the actual result without retaining a spinner or overlay.
2. A filtered-out/deleted/restored row can unmount its `PostActions` before its continuation finishes; list feedback and processing ownership must survive until refresh settles.
3. Saving may finish its mutation before `goto` finishes loading the destination; avoid an unlocked authoring gap and preserve permitted navigation.
4. Consecutive actions and navigation must not let an older timer or notice dismissal clear newer results.
5. An observed outcome or successful latest-content reload currently may finish without a result notice; add accurate feedback without duplicate or false success announcements.

## Initial Coverage Inventory

This inventory records source inspection, not completed browser acceptance. Verify every row with controlled waiting before closing the audit.

| Action                                       | Current presentation                                              | Planned disposition                                                                                                                          |
| -------------------------------------------- | ----------------------------------------------------------------- | -------------------------------------------------------------------------------------------------------------------------------------------- |
| Normal-list publish/republish/archive/delete | Local status in `PostList`; shared busy interval includes refresh | Replace with region overlay on `section.admin-content`; preserve heading/session guards                                                      |
| Trash restore                                | Same shared list implementation                                   | Same region overlay; include removal and empty/last-page handling                                                                            |
| Detail lifecycle actions                     | Local `PostActions` status                                        | Keep local; verify timing, result continuity and sibling navigation guards                                                                   |
| Create/save/publish/retry                    | Input-region overlay                                              | Keep region; investigate and close mutation-to-destination pending gap                                                                       |
| Latest-content reload                        | Input-region overlay; success clears message                      | Retain region and provide accurate nonblocking completion; preserve input on failure                                                         |
| Filter and pagination navigation             | Server route loads; no explicit in-page status                    | Exercise a held route load; use existing list/indicator state for missing feedback if safe; preserve native links and routing                |
| List/detail/new/edit/cancel navigation       | Native links or `goto`; existing dirty-state/processing guards    | Audit held navigation; add feedback only where supported by existing scope; record structural work separately                                |
| Recovery restore/discard                     | Local state change and editor remount                             | Audit actual waiting; no simulated network spinner or delay for synchronous work                                                             |
| Logout                                       | Exclusive global overlay, then document departure                 | Compare as reference; keep current global lifecycle unless evidence supports sharing display delay; never hold departure for a minimum timer |

## Task 1: Timing and Result Continuity

**Files:**

- Modify: `src/lib/admin/ProcessingIndicator.svelte` and `src/lib/admin/ProcessingIndicator.svelte.spec.ts`.
- Verify/modify only when required: `src/lib/admin/ResultNotice.svelte`, `src/lib/admin/notices.svelte.ts`, `src/lib/admin/PostActions.svelte`.
- Test: `src/routes/admin/result-feedback.e2e.ts` and `src/routes/admin/processing.e2e.ts`.

**Interfaces:** Keep `active: boolean`, `message: string`, and `scope?: 'global' | 'region' | 'local'`. Add `delay?: number` only if global feedback intentionally uses a different delay. Existing notice `show(message)`/`dismiss(id)` remains the single confirmed-success channel; persistent local notices retain their tone and details.

- [x] Add controlled-time component cases: completion before the delay produces no late indicator; appearance occurs at the candidate delay; completion immediately removes pending visuals; retry and disposal cancel previous delays. Verify an active operation's message change does not unnecessarily restart its display delay.
- [x] Run `pnpm test:unit --run src/lib/admin/ProcessingIndicator.svelte.spec.ts` and confirm new assertions fail on current behavior before changing production code.
- [x] Implement visual timing independently of processing. Use existing result-notice persistence to exceed the candidate 400ms feedback interval; do not add a minimum spinner timer or duplicate results.
- [x] Add browser assertions for just-before/at/just-after threshold completion, slow work, rejection and consecutive actions. Assert accurate result visibility and prompt unlock after completion, plus that older expiry/dismissal cannot clear a newer notice.
- [x] For an `observed` outcome lacking any completion feedback, retain its non-confirmed semantics and provide state-confirmation guidance through an existing nonblocking notice. Assert no confirmed-success wording is introduced.
- [x] Compare candidate timings at 1280px/390px and with reduced motion; record actual appearance/result times and the chosen global-scope policy in Task 4.
- [x] Re-run focused component and result-feedback checks. Prepare the timing implementation as a focused commit with `Refs #83` after verification and the review gate.

## Task 2: List and Trash Region Feedback

**Files:** Modify `src/lib/admin/PostList.svelte`; change `src/lib/admin/PostActions.svelte` or processing ownership only if the unmount test demonstrates a gap. Test in new `src/routes/admin/loading-coverage.e2e.ts` and existing `src/routes/admin/list-layout.e2e.ts`/`post-management.e2e.ts`.

Execution audit addition: `src/routes/admin/loading-viewport.e2e.ts` reproduces and guards status visibility in long lists. `src/routes/admin/loading-results.e2e.ts` verifies a non-confirmed result carried across authoring navigation. The legacy cursor test uses actual pointer movement because the new list overlay intentionally excludes item hover targets.

**Interfaces:** Continue sharing `actionState` between list and row actions. Preserve `refresh(): Promise<void>`, its valid-page correction and return context. The list owns the region container and status; row unmount must not end the list's pending interval.

- [x] Add parameterized browser cases for normal-list publish/republish/archive/delete and trash restore at 1280px and 390px. Use unique fixture identities containing operation/viewport/outcome and release held routes in `finally`.
- [x] Hold mutation and refresh separately. Assert one region indicator is inside `section.admin-content`, covers its bounds, excludes the heading, remains outside inert content and stays present while the refresh is held.
- [x] Assert filter/list/pagination interaction exclusion, heading/session guards, keyboard routes and actual pointer-hit cursors via `elementFromPoint`. Assert confirmation cancellation sends no mutation.
- [x] Add filtered-out-item, empty-final-page correction and empty-trash cases. On every outcome, assert overlay removal and lock release; distinguish confirmed mutation plus failed refresh from failed mutation.
- [x] Run the focused cases and observe failures for missing region coverage before implementation.
- [x] Make the section the positioned overlay container, use `scope="region"` and keep its status as a sibling of inert content. Preserve existing flex height, mobile/table layouts, notices and native links.
- [x] Re-run coverage, list-layout and post-management checks with `--workers=1`; inspect screenshots and the row-unmount invariant. Prepare the region implementation as a focused commit with `Refs #83`.

## Task 3: Close Existing-Structure Coverage Gaps

**Files:** `src/lib/admin/PostForm.svelte`, `src/lib/admin/PostList.svelte`, `src/routes/admin/+layout.svelte`, `src/lib/admin/Pagination.svelte` only as the audit requires. Tests in `src/routes/admin/loading-coverage.e2e.ts`, `authoring.e2e.ts`, `processing.e2e.ts` and `logout.e2e.ts`.

**Interfaces:** Keep `submitAuthoring(state, intent, fetcher)` mutation semantics unchanged. If pending must cover destination loading, add caller-owned navigation state to `locked`, processing registration, heading/input inert state and the existing indicator together. Any list-navigation pending presentation must remain separate from mutation state and must not cancel its own intended navigation.

- [x] Hold the destination route load after a confirmed save/create and assert no premature processing unlock before destination readiness. Confirm permitted navigation and destination result notices still work. Preserve existing `goto` rejection handling and framework route-error behavior; review those boundaries alongside existing loader-error regressions rather than adding a new navigation failure subsystem.
- [x] Hold latest-content reads; assert region feedback, retained local input on failure and readable completion on success, with no stale previous result. Add successful reload wording using an existing notice, without marking an unconfirmed mutation successful.
- [x] Exercise filter/page and list/detail/new/trash navigation under controlled delay. Verify edit/cancel and recovery/editor readiness through existing authoring/list-context regressions and verify logout through its existing controlled checks. Record actual coverage and appropriate scope for every audited action.
- [x] For demonstrated gaps resolvable using existing `ProcessingIndicator`/processing state, write failing tests and implement minimal presentation/state changes. Keep dirty-navigation confirmation, modifier/new-tab links, page-size/filter context and retry rules.
- [x] Document any case needing a new cross-page system as follow-up; do not implement a new navigation subsystem. A deferral must name the action, observed gap and structural reason.
- [x] Re-run focused authoring, navigation, processing and logout regressions. Prepare focused test commits with `Refs #83`.

## Task 4: Policy, Evidence and Whole-Branch Verification

**Files:** Update `docs/architecture/content-domain.md`, `docs/operations/admin-validation.md`; create `docs/operations/v0.2.2-admin-loading-feedback.md` with the completed inventory, timing comparison and limitations. Update this plan's checkboxes with actual evidence.

- [x] Record final display/minimum-feedback decisions, the existing notice lifecycle used to satisfy readability, the global-scope decision and operation-specific result wording. Distinguish local browser evidence from physical-device/Access acceptance.
- [x] Verify desktop/mobile screenshots for list/trash, detail, create/edit, latest reload and logout where behavior changed. Check overlay geometry, focus and reduced motion.
- [x] Run `pnpm check`, `pnpm lint`, `git diff --check`, and `pnpm test --workers=1` (workflow, unit/component and build-based E2E). Fix failures by diagnosing their cause; do not claim a passing baseline from a partial run.
- [x] Review the complete diff against Issue #83, especially the five Review Focus invariants and inventory completeness. Keep focused implementation/test/docs commits; do not create or merge a PR without the applicable delivery instruction.

## Preparation Evidence

- Branch: `codex/admin-loading-feedback`, created from local `release/v0.2.2` at `5075285` (clean checkout at start).
- No product code or test expectations changed during planning.
- Initial focused baseline: the three server processing tests passed; browser tests could not launch because the sandbox selected an empty Playwright cache. An installed matching browser was found at `C:/Users/Hero/AppData/Local/ms-playwright`; rerun using that cache before drawing conclusions.
- Final focused baseline: with the installed browser cache and elevated localhost access, `pnpm test:unit --run src/lib/admin/ProcessingIndicator.svelte.spec.ts src/lib/admin/processing.spec.ts` passed both files and all five tests. The intermediate sandbox run failed with `ERR_NETWORK_ACCESS_DENIED`; this was an environment restriction, not a test assertion failure.
- Plan self-review: every Issue section maps to Tasks 1–4; no request delay, minimum overlay hold, false observed-success claim, separate navigation subsystem or Production work is planned.
