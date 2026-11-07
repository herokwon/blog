# Personal Blog

A minimal TypeScript SvelteKit project targeting Cloudflare Workers.

See [AGENTS.md](AGENTS.md) for setup, development, testing, review, and release instructions, and [ADR 0001](docs/adr/0001-blog-architecture.md) for the approved architecture.

The application includes the development and delivery baseline, plus the post, category, and tag schema with generated SQL migrations. Authoring, authentication, and remote content storage will be introduced incrementally under [ADR 0004](docs/adr/0004-author-administration.md).
