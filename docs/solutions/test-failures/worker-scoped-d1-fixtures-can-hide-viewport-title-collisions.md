---
module: Admin browser tests
date: 2026-10-19
problem_type: test_failure
component: testing_framework
severity: medium
category: test-failures
symptoms:
  - 'A desktop title locator matched both mobile and desktop fixture records.'
  - 'Later cases passed after an earlier failure replaced the worker.'
root_cause: test_isolation
resolution_type: test_fix
tags: [playwright, local-d1, worker-fixtures, viewport, test-isolation]
---

# Worker restarts can hide shared D1 fixture collisions

## Problem

The Admin button test matrix reused post titles across mobile and desktop
variants. Its title-based locator eventually matched two records. Fixing only
the first failing case would have left the same defect in later cases that
appeared to pass.

## Environment

The local D1 fixture in [local-d1.ts](../../../tests/admin/local-d1.ts) has
worker scope. It creates a persistence directory for that worker, applies
migrations and removes the directory on teardown. It does not reset posts
between tests. A new browser page or request context does not reset this database.

The API suite explicitly deletes its own posts in `beforeEach`; browser suites
using the same fixture do not inherit that hook. See
[Admin validation](../../operations/admin-validation.md) for the local-only
fixture and environment boundaries.

## Symptoms

During [Issue #72](https://github.com/herokwon/blog/issues/72), the first
implementation run reported 18 passes and one failure. The 1280px geometry
locator found two posts named `Button geometry`, left by the two viewport cases.
The mobile cases passed before it; desktop outcome cases passed after it.

The failing run's worker process changed immediately after that failure. The
replacement worker initialized a fresh D1 fixture, so later passes no longer
tested coexistence with the mobile records. Review found that the outcome
titles also omitted the width. This explains why a green case after an earlier
failure was insufficient evidence of isolation.

## What Didn't Work

- `--workers=1` serializes execution; it does not create a fresh database per test.
- Distinct test names do not make stored post titles unique.
- Fixing only the first strict-locator failure misses defects masked by the
  worker replacement that failure triggers.
- Selecting the first matching row would hide the collision and could exercise
  the wrong post. Assertions and locators should remain strict.

## Solution

Give stored records the identity of the complete parameter case. The
[button tests](../../../src/routes/admin/button-states.e2e.ts) now use width
in geometry titles and both width and outcome in mutation titles:

```ts
data: { title: `Button geometry ${width}`, body: 'Body' }
data: { title: `Cursor ${width} ${outcome}`, body: 'Body' }
```

Locators use the returned post's title. The corrected ten-case matrix passed
serially without a preceding failure. That is local browser evidence, not
remote deployment or physical-device acceptance.

## Why This Works

Successful tests retain their worker's records for subsequent tests. Including
the parameters in stored titles keeps each locator unique while allowing that
intentional fixture reuse. Running the whole matrix without failures ensures
that a failure-triggered fresh fixture cannot conceal the same collision later.

## Prevention

1. Check the defining fixture's scope and its reset hooks before assuming that
   a test starts with an empty table. Distinguish suite-owned cleanup from
   fixture-owned cleanup.
2. Make records unique across the full parameter matrix, or locate the exact
   returned post ID. Keep strict locators; do not add `.first()` to silence an
   ambiguous match.
3. After repairing a failure, rerun the complete affected file serially. A
   collection of isolated passes or later passes after a failure does not prove
   that shared records coexist safely.
4. Release held request handlers in `finally` so a failed assertion cannot
   strand a request and obscure the original failure.
