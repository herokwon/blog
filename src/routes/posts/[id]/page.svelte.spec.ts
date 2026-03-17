import { describe, expect, it } from 'vitest';

import { createMockPost } from '$lib/test-utils';
import { render } from 'vitest-browser-svelte';
import { page } from 'vitest/browser';

import Page from './+page.svelte';

const mockPost = createMockPost();

describe('[Page] /posts/[id]', () => {
  it('should render back link to posts list', async () => {
    render(Page, { data: { post: mockPost } });
    await expect
      .element(page.getByRole('link', { name: '← All posts' }))
      .toHaveAttribute('href', '/posts');
  });

  it('should render post title and created date', async () => {
    render(Page, { data: { post: mockPost } });

    await expect
      .element(page.getByRole('heading', { level: 1, name: mockPost.title }))
      .toBeInTheDocument();
    await expect.element(page.getByRole('time')).toBeInTheDocument();
  });

  it('should update page title and heading when post data changes', async () => {
    const updatedPost = createMockPost({
      title: 'Updated Title',
    });
    const view = render(Page, { data: { post: mockPost } });

    await view.rerender({ data: { post: updatedPost } });

    await expect
      .element(page.getByRole('heading', { level: 1 }))
      .toHaveTextContent(updatedPost.title);
    expect(document.title).toBe(updatedPost.title);
  });

  it('should render without crashing when post title is null', async () => {
    render(Page, {
      data: { post: { ...mockPost, title: null as unknown as string } },
    });
    await expect.element(page.getByRole('article')).toBeInTheDocument();
  });
});
