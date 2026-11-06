import { render } from 'svelte/server';
import { describe, expect, it } from 'vitest';
import Page from './+page.svelte';

describe('homepage server rendering', () => {
  it('includes the page heading in server-rendered HTML', () => {
    const { body } = render(Page);
    expect(body).toContain('<h1>Personal Blog</h1>');
  });
});
