import type { Snippet } from 'svelte';

import { afterEach, describe, expect, it } from 'vitest';

import { render } from 'vitest-browser-svelte';

import Layout from './+layout.svelte';
import Page from './+page.svelte';

describe('/+layout.svelte', () => {
  afterEach(() => {
    document.head.innerHTML = '';
    document.body.innerHTML = '';
  });

  it('sets a favicon link in head', async () => {
    await render(Layout, {
      children: Page as unknown as Snippet,
    });

    const link = document.querySelector('link[rel="icon"]');
    expect(link).toBeTruthy();
    expect(link?.getAttribute('href')).toMatch(/favicon|favicon\.svg/);
  });
});
