import { describe, expect, it } from 'vitest';

import type { Post } from '$lib/types/post';
import { render } from 'vitest-browser-svelte';
import { page } from 'vitest/browser';

import Page from './+page.svelte';

const mockPost: Post = {
  id: '123e4567-e89b-12d3-a456-426614174200',
  title: 'Hello World',
  content: '# Heading\nHello **world** text',
  createdAt: '2026-01-15T00:00:00.000Z',
  updatedAt: '2026-02-20T00:00:00.000Z',
};

describe('[Routes] /posts', () => {
  it('should render page heading', async () => {
    render(Page, { data: { posts: [] } });

    await expect
      .element(page.getByRole('heading', { level: 1 }))
      .toHaveTextContent('Posts');
  });

  it('should render error message when loadError exists', async () => {
    render(Page, { data: { posts: [], loadError: 'Failed to load posts' } });

    await expect
      .element(page.getByText('Failed to load posts'))
      .toBeInTheDocument();
  });

  it('should render empty state when there are no posts', async () => {
    render(Page, { data: { posts: [] } });

    await expect.element(page.getByText('No posts yet.')).toBeInTheDocument();
  });

  it('should render post title, link, and markdown excerpt', async () => {
    render(Page, { data: { posts: [mockPost] } });

    await expect
      .element(page.getByRole('link', { name: /Hello World/ }))
      .toHaveAttribute('href', `/posts/${mockPost.id}`);
    await expect
      .element(page.getByText('Heading Hello world text'))
      .toBeInTheDocument();
    await expect
      .element(page.getByRole('heading', { level: 2, name: 'Hello World' }))
      .toBeInTheDocument();
  });

  it('should truncate long post excerpts with an ellipsis', async () => {
    const longPost: Post = {
      ...mockPost,
      content: 'a'.repeat(250),
    };
    render(Page, { data: { posts: [longPost] } });

    await expect.element(page.getByText(/a{200}…/)).toBeInTheDocument();
  });
});
