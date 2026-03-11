import { describe, expect, it } from 'vitest';

import type { Post } from '$lib/types/post';
import { render } from 'vitest-browser-svelte';
import { page } from 'vitest/browser';

import Page from './+page.svelte';

const mockPost: Post = {
  id: '123e4567-e89b-12d3-a456-426614174220',
  title: 'Detail Title',
  content: 'Detail content',
  createdAt: '2026-03-01T00:00:00.000Z',
  updatedAt: '2026-03-02T00:00:00.000Z',
};

describe('[Routes] /posts/[id]', () => {
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
    const updatedPost: Post = {
      ...mockPost,
      title: 'Updated Title',
    };

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
