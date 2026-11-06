import { describe, expect, it } from 'vitest';
import { render } from 'vitest-browser-svelte';
import { page } from 'vitest/browser';
import Page from './+page.svelte';

describe('homepage component', () => {
  it('renders the homepage in the browser', async () => {
    await render(Page);
    await expect
      .element(page.getByRole('heading', { level: 1 }))
      .toHaveTextContent('Personal Blog');
  });
});
