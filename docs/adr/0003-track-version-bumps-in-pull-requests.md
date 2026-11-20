# ADR 0003: Track automated version bumps in pull requests

- Status: Accepted
- Date: 2026-11-20
- Related issue: [#22](https://github.com/herokwon/blog/issues/22)

## Context

[ADR 0002](0002-infrastructure-and-delivery.md) requires a tracking issue for
bot pull requests. Version Bump changes only the package version, and its pull
request already records the change, target milestone, and verification.

## Decision

Version Bump creates only a milestone-assigned pull request. The issue check
exempts the configured automation App's pull request when its head is the
same repository's `codex/bump-<version>` branch and its base is the matching
release branch. Other work pull requests, including Renovate's, still require
an open issue in the same milestone.

## Consequences

The bump pull request still needs the target milestone, CI, and review. Existing
tracking issues retain their history. The policy takes effect once it reaches
the default branch, where the workflows load their automation code.
