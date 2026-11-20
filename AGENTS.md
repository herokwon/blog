# Repository Guidelines

- Title `release/*` → `main` pull requests using `` release: `<version>` ``, where `<version>` is the target release version. Example: `` release: `0.1.0` ``.
- Link directly related issues in an ADR when they provide context for the decision or track follow-up work.
- Before committing, run `pnpm run format`, review the resulting changes, and ensure `pnpm run lint` passes.
