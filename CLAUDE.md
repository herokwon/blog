# CLAUDE.md

Project guidelines for AI assistants.

## Project Overview

- **Tech Stack**: SvelteKit + TypeScript
- **Database**: Cloudflare D1
- **Deploy**: Cloudflare Workers
- **CI/CD**: GitHub Actions
- **Testing**: Vitest + Playwright
- **Styling**: TailwindCSS
- **Linting**: ESLint + Prettier

## Coding Conventions

### Function Declaration Style

The project follows these function declaration guidelines:

#### ✅ Use Function Declarations (Recommended)

Use **function declarations** in the following cases:

- **Public APIs and utility functions**: Functions called from external modules
- **Server logic**: Authentication, database operations, etc.
- **Type guards**: Functions with `value is Type` return type
- **Independent and reusable functions**: Pure functions that don't depend on context

```typescript
// ✅ Good
export function isNonNullableObject(
  value: unknown,
): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null;
}

export async function hashPassword(password: string): Promise<string> {
  // ...
}
```

**Reasons**:

- Hoisting allows flexible declaration order
- Clear function names improve debugging
- Works naturally with TypeScript features like type guards

#### ✅ Use Arrow Function Expressions

Use **arrow function expressions** in the following cases:

- **Test helpers and mock factory functions**: Test utilities
- **Higher-order function callbacks**: `map`, `filter`, `reduce`, etc.
- **Simple inline functions**: 1-2 lines of logic

```typescript
// ✅ Good - Test helpers
export const createMockUserSession = (
  overrides: Partial<UserSession> = {},
): UserSession => ({
  sessionId: 'session-abc',
  // ...
});

export const stubGlobalFetch = <T extends Record<string, unknown>>({
  response,
  options,
  error,
}: StubFetchParams) => {
  // ...
};

// ✅ Good - Callbacks
const userIds = users.map(user => user.id);
const adults = users.filter(user => user.age >= 18);
```

**Reasons**:

- Test helpers typically return objects, making arrow function's concise syntax ideal
- Mock functions are only used in test context, so hoisting is unnecessary
- Callbacks conventionally use arrow functions

### TypeScript

- **Strict mode**: Project uses `strict: true` with `checkJs: true` for maximum type safety
- **Module resolution**: Uses `moduleResolution: "bundler"` for modern ESM support
- **Type annotations**: Explicitly declare function parameter and return types
- **Type guards**: Use `value is Type` return type for type validation functions
- **Generics**: Use with clear constraints when needed
- **Cloudflare types**: Uses `worker-configuration.d.ts` for platform-specific types

### Testing

#### Test Organization

- **Browser tests**: Files named `*.svelte.{test,spec}.ts` run in Chromium via Playwright
- **Server tests**: Files named `*.{test,spec}.ts` (not `.svelte`) run in Node.js environment
- **Test projects**: Vitest uses separate `client` and `server` projects for proper isolation

#### Mock Factories and Helpers

- **Mock functions**: Name using `createMock*` pattern
  - `createMockD1()` - Mock Cloudflare D1 database
  - `createMockRequestEvent()` - Mock SvelteKit RequestEvent
  - `createMockLoadEvent()` - Mock SvelteKit LoadEvent
  - `createMockUserSession()` - Mock user session object
- **Test helpers**: Define reusable utilities in `src/lib/test-utils.ts`
- **Fetch stubbing**: Use `stubGlobalFetch()` for consistent API mocking
- **Consistency**: Use the same helper functions for identical test operations

#### Coverage Requirements

- **Minimum thresholds**: 80% for lines, functions, branches, and statements
- **Excluded from coverage**: Type definitions, index files, test files
- **Provider**: V8 coverage provider via `@vitest/coverage-v8`

### Commit Messages

Use Gitmoji and Conventional Commits:

```
<emoji> <type>(<scope>): <subject>

Examples:
♻️ refactor(test-utils): Integrate stubGlobalFetch function for consistency
🧪 test(admin/posts): Extract form submission logic to submitForm helper
✨ feat(auth): Add password reset functionality
🐞 fix(api): Handle null values in post validation
```

Main types:

- `feat`: New feature
- `fix`: Bug fix
- `refactor`: Code refactoring
- `test`: Add/modify tests
- `style`: Code style changes
- `docs`: Documentation changes
- `chore`: Build process, package manager configs, etc.

### Code Style

- **Indentation**: 2 spaces (see `.prettierrc`)
- **Quotes**: Single quotes
- **Arrow function parentheses**: Omit when single parameter (`arrowParens: "avoid"`)
- **Import order**: Auto-sorted by Prettier plugin (Svelte → SvelteKit → Testing → Third-party → CSS → Local)

### File Structure

```
src/
├── lib/
│   ├── assets/            # Static assets (images, fonts, etc.)
│   ├── components/        # Svelte components
│   │   └── editor/        # Markdown editor components (Milkdown)
│   ├── server/            # Server-only code (auth, DB, etc.)
│   ├── types/             # TypeScript type definitions
│   ├── constants.ts       # Constants
│   └── test-utils.ts      # Test helpers and mock factories
├── routes/
│   ├── api/               # API endpoints
│   │   └── posts/         # Post-related APIs
│   ├── admin/             # Admin pages
│   │   └── posts/         # Post management UI
│   ├── login/             # Login page
│   ├── posts/             # Public post pages
│   │   └── [id]/          # Individual post page
│   └── +page.svelte       # Homepage
└── hooks.server.ts        # SvelteKit server hooks
```

## Development Workflow

### Key Commands

#### Development

```bash
pnpm dev              # Start development server
pnpm build            # Build for production
pnpm preview          # Preview production build locally (Wrangler)
pnpm check            # Type-check with svelte-check
pnpm check:watch      # Type-check in watch mode
```

#### Testing

```bash
pnpm test             # Run all tests with Chromium
pnpm test:watch       # Run tests in watch mode
pnpm test:ui          # Run tests with Vitest UI
```

#### Linting & Formatting

```bash
pnpm lint             # Check linting and formatting
pnpm lint:fix         # Auto-fix linting issues
pnpm format           # Format with Prettier
```

#### Code Generation

```bash
pnpm gen:types        # Generate Cloudflare Workers types
pnpm gen:api          # Generate TypeScript types from OpenAPI schema
```

#### Deployment

```bash
pnpm deploy           # Build and deploy to production
pnpm deploy:preview   # Build and deploy preview version
```

### Pre-commit Checklist

1. `pnpm lint` - Must have no lint errors
2. `pnpm test` - All tests must pass
3. Husky automatically checks via pre-commit hook

## Important Notes

### Security

- **SQL injection prevention**: Always use prepared statements in D1 queries
- **Password hashing**: Uses PBKDF2 with SHA-256
  - 100,000 iterations for strong key derivation
  - Random 16-byte salt per password
  - Base64-encoded salt + hash storage
- **Authentication**: Session-based authentication with HTTP-only cookies
- **Session management**: Server-side session validation via `hooks.server.ts`

### API Design

- **Response format**: Use consistent structure `{ success: boolean, data?: any, error?: string }`
- **Error handling**: Return appropriate HTTP status codes with descriptive error messages
- **Type safety**: Generate API types from OpenAPI schema using `pnpm gen:api`
