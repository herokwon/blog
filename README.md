# Personal blog

A SvelteKit application targeting Cloudflare Workers. The initial architecture
and version boundaries are recorded in [ADR 0001](docs/adr/0001-initial-blog-architecture.md).

## Local setup

Use Node.js 26.x and pnpm 12.x. Minor and patch versions may differ.

```sh
pnpm install --frozen-lockfile
pnpm run test:install
pnpm run dev
```

Installation generates Worker types and synchronizes SvelteKit. The development
server uses the `preview` configuration with locally simulated D1 and R2 storage.
It does not connect to the deployed preview resources. No Cloudflare credentials
or environment variables are required for the default local workflow.

`worker-configuration.d.ts` is generated and ignored by Git. Do not edit it.
`dev`, `build`, and type-check commands regenerate it automatically. Use `pnpm run
gen` after editing bindings when no such command is running. Main-module inference
is disabled so generated types do not pull built JavaScript into type checking.

## Development commands

| Command                  | Purpose                                                |
| ------------------------ | ------------------------------------------------------ |
| `pnpm run format`        | Format source and configuration files                  |
| `pnpm run format:check`  | Check formatting without modifying files               |
| `pnpm run lint`          | Run ESLint without modifying files                     |
| `pnpm run check`         | Generate types, synchronize SvelteKit, and check types |
| `pnpm run check:watch`   | Run type checking in watch mode                        |
| `pnpm run test:unit`     | Run Node.js and Chromium component tests once          |
| `pnpm run test:watch`    | Watch Vitest tests                                     |
| `pnpm run test:coverage` | Run Vitest with V8 coverage                            |
| `pnpm run test:e2e`      | Run Playwright against a local build                   |
| `pnpm test`              | Run Vitest, then Playwright if Vitest succeeds         |
| `pnpm run build`         | Build for Workers                                      |
| `pnpm run preview`       | Serve the build locally on port 4173                   |

Coverage includes untested source files and writes text, HTML, and JSON summary
reports under `coverage/`; it does not enforce a percentage threshold or include
Playwright execution. GitHub Actions enables Vitest's built-in test summary and
Playwright JSON output at `test-results/e2e-results.json`. Coverage/E2E summary
aggregation and artifact uploads belong to the separate CI/CD work.

Playwright reuses a running local server at port 4173 when available, so that
server must serve the current build. CI starts a fresh server and retries a
failed test once. Trace collection occurs on the first retry; screenshots and
videos are retained on failure. Browser installation is a separate step and
should be repeated after Playwright updates.

## Database changes

Drizzle generates SQL and metadata in `drizzle/`; commit both when migrations are
introduced. Wrangler applies those migrations and records each environment's
history in `d1_migrations`.

```sh
pnpm run db:generate
pnpm run db:migrate
```

The default migration command targets local preview storage. Remote commands are
`db:migrate:preview` and `db:migrate:production`. They require Cloudflare
authentication and the real database configuration from the infrastructure work.
Do not use Drizzle push or a second migration runner for these databases.

Cloudflare provisioning, Access, domains, deployment policies, repository settings,
and CI/CD are separate work. The configured resource names are declarations;
database IDs are intentionally absent until provisioning. Package version changes
will be discussed separately.
