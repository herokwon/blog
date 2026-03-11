# Introduction

> Personal blog built with SvelteKit. Focused on fast, readable posts, clean navigation, and a minimal authoring workflow.

<br />

## ✨ Features

- Post listing and detail pages
- Tag and category
- SEO-friendly metadata
- Responsive layout
- Milkdown-based editor integration
- Cloudflare R2-based content storage and management

<br />

## 🛠️ Tech Stack

![svelte](https://img.shields.io/badge/svelte-FF3E00?style=for-the-badge&logo=svelte&logoColor=white)
![typescript](https://img.shields.io/badge/typescript-3178C6?style=for-the-badge&logo=typescript&logoColor=white)
![tailwindcss](https://img.shields.io/badge/tailwind_css-38B2AC?style=for-the-badge&logo=tailwindcss&logoColor=white)
![prettier](https://img.shields.io/badge/prettier-F7B93E?style=for-the-badge&logo=prettier&logoColor=black)
![eslint](https://img.shields.io/badge/eslint-4B32C3?style=for-the-badge&logo=eslint&logoColor=white)
![vitest](https://img.shields.io/badge/vitest-00FF74?style=for-the-badge&logo=vitest&logoColor=white)
![cloudflare r2](https://img.shields.io/badge/cloudflare_r2-F38020?style=for-the-badge&logo=cloudflare&logoColor=white)
![cloudflare workers](https://img.shields.io/badge/cloudflare_workers-F38020?style=for-the-badge&logo=cloudflareworkers&logoColor=white)

<br />

## 📍 Getting Started

Install dependencies:

```sh
pnpm install
```

Run the dev server:

```sh
pnpm dev
```

Build for production:

```sh
pnpm build
```

Preview the production build:

```sh
pnpm preview
```

<br />

## 🧪 Testing

Prerequisites:

- Node.js (recommended LTS)
- pnpm (package manager)

Install dependencies and Playwright browsers:

```sh
pnpm install
pnpm exec playwright install chromium --with-deps
```

Run the full test suite (this project uses a small test runner wrapper that launches a single Playwright Chromium server and runs Vitest):

```sh
pnpm test
```

<br />

## 📖 Content

This blog uses [Milkdown](https://milkdown.dev) as the writting editor and stores post data in [Cloudflare R2](https://cloudflare.com/developer-platform/products/r2)

### Content flow

1. Write and edit content in Milkdown.
2. Convert editor output to Markdown format.
3. Upload and manage content files in Cloudflare R2.
4. Read content from R2 in the app and render post pages.

### Key capabilities

- Rich text authoring with Markdown workflow
- Centralized content storage on R2
- Easy post update and asset management
- Scalable content delivery for blog pages

<br />

## 🚀 Deployment

This project targets Cloudflare Workers. Use the SvelteKit adapter configuration in [`svelte.config.js`](./svelte.config.js) and deploy with your preferred workflow.

<br />

## 📜 License

Distributed under the MIT license. See [LICENSE](LICENSE) for more information.
