# Introduction

> Personal blog built with SvelteKit. Focused on fast, readable posts, clean navigation, and a minimal authoring workflow.

<br>

## ✨ Features

- Post listing and detail pages
- Tag and category
- SEO-friendly metadata
- Responsive layout

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

## 🔎 Content

- Posts live under `src/lib` or `src/routes` depending on the chosen structure.
- Add front matter for title, date, and tags.

<br />

## 🚀 Deployment

This project targets Cloudflare Workers. Use the SvelteKit adapter configuration in [`svelte.config.js`](./svelte.config.js) and deploy with your preferred workflow.

<br />

## 📜 License

Licensed under the [MIT](LICENSE) license.

[![License: MIT](https://img.shields.io/badge/License-MIT-blue.svg?style=flat-square)](https://opensource.org/licenses/MIT)
