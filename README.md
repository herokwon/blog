# sv

Everything you need to build a Svelte project, powered by [`sv`](https://github.com/sveltejs/cli).

## Creating a project

If you're seeing this, you've probably already done this step. Congrats!

```sh
# create a new project
npx sv create my-app
```

To recreate this project with the same configuration:

```sh
# recreate this project
pnpm dlx sv@0.17.1 create --template minimal --types ts --add prettier eslint vitest="usages:component,unit" playwright sveltekit-adapter="adapter:cloudflare+cfTarget:workers" drizzle="database:d1" tailwindcss="plugins:typography" --install pnpm blog
```

## Developing

Use Node.js 26 and pnpm 12 for local development and CI.

Once you've created the project and installed dependencies with `pnpm install`, start a development server:

```sh
pnpm run dev

# or start the server and open the app in a new browser tab
pnpm run dev -- --open
```

Local development and `pnpm preview` select Preview configuration with local
bindings. The adapter disables remote bindings and persists local D1 data in
`.wrangler/state/v3`; restarting the server does not reset it. Automated tests
use separate disposable fixtures and never connect to remote D1.

Run `pnpm db:migrate:local` to apply pending migrations to local Preview D1.
For authorized remote operations, `pnpm db:migrate:preview` explicitly targets
Preview and `pnpm db:migrate:production` targets Production.
`pnpm db:migrate:remote` is a Production compatibility alias.
`pnpm gen` and `pnpm types:check` cover both environments in one committed type
artifact, including distinct Origin and Access audience values.

## Building

To create a production version of your app:

```sh
pnpm run build
```

You can preview the production build with `pnpm run preview`.

## Testing

Install the Chromium browser required by Vitest and Playwright once:

```sh
pnpm run playwright:install
```

Run the unit and end-to-end test suites with:

```sh
pnpm test
```

> To deploy your app, you may need to install an [adapter](https://svelte.dev/docs/kit/adapters) for your target environment.
