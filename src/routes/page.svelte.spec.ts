import { describe, expect, it } from 'vitest';

import { render } from 'vitest-browser-svelte';
import { page } from 'vitest/browser';

import Page from './+page.svelte';

describe('[Routes] /', () => {
  it('should render h1', async () => {
    render(Page);
    const heading = page.getByRole('heading', { level: 1 });

    await expect.element(heading).toBeInTheDocument();
    await expect.element(heading).toHaveTextContent('Welcome to SvelteKit');
  });

  it('should render paragraph', async () => {
    render(Page);
    const paragraph = page.getByRole('paragraph');

    await expect.element(paragraph).toBeInTheDocument();
    await expect
      .element(paragraph)
      .toHaveTextContent(`Visit svelte.dev/docs/kit to read the documentation`);
  });

  it('should render link', async () => {
    render(Page);
    const link = page.getByRole('link', { hasText: 'svelte.dev/docs/kit' });

    await expect.element(link).toBeInTheDocument();
    await expect
      .element(link)
      .toHaveAttribute('href', 'https://svelte.dev/docs/kit');
  });
});
