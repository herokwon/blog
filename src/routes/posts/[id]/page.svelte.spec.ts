import { describe, expect, it } from 'vitest';

import { createMockPost } from '$lib/test-utils';
import { render, type RenderResult } from 'vitest-browser-svelte';
import { page } from 'vitest/browser';

import type { PageData } from './$types';
import Page from './+page.svelte';

const mockPost = createMockPost();

describe('[Page] /posts/[id]', () => {
  it('should render back link to posts list', async () => {
    await renderPage();
    await expect
      .element(page.getByRole('link', { name: '← All posts' }))
      .toHaveAttribute('href', '/posts');
  });

  it('should render post title and created date', async () => {
    await renderPage();

    await expect
      .element(page.getByRole('heading', { level: 1, name: mockPost.title }))
      .toBeInTheDocument();
    await expect.element(page.getByRole('time')).toBeInTheDocument();
  });

  it('should update page title and heading when post data changes', async () => {
    const updatedPost = createMockPost({
      title: 'Updated Title',
    });
    const view = await renderPage();

    await view.rerender({ data: { post: updatedPost } });

    await expect
      .element(page.getByRole('heading', { level: 1 }))
      .toHaveTextContent(updatedPost.title);
    expect(document.title).toBe(updatedPost.title);
  });

  it('should render without crashing when post title is null', async () => {
    await renderPage({ ...mockPost, title: null as unknown as string });
    await expect.element(page.getByRole('article')).toBeInTheDocument();
  });
});

async function renderPage(
  post: PageData['post'] = mockPost,
): Promise<RenderResult<typeof Page>> {
  return await render(Page, { data: { post } });
}
