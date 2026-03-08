import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

import type { Post } from '$lib/types/post';
import { render } from 'vitest-browser-svelte';
import { page } from 'vitest/browser';

import Page from './+page.svelte';

const mockPost: Post = {
  id: '123e4567-e89b-12d3-a456-426614174000',
  title: 'Hello World',
  content: 'Some content',
  createdAt: '2026-01-15T00:00:00.000Z',
  updatedAt: '2026-02-20T00:00:00.000Z',
};

const mockPost2: Post = {
  id: '123e4567-e89b-12d3-a456-426614174001',
  title: 'Second Post',
  content: 'More content',
  createdAt: '2026-03-01T00:00:00.000Z',
  updatedAt: '2026-03-02T00:00:00.000Z',
};

describe('[Routes] /admin/posts', () => {
  afterEach(() => {
    vi.unstubAllGlobals();
  });

  describe('header', () => {
    it('should render page heading', async () => {
      render(Page, { data: { posts: [] } });

      await expect
        .element(page.getByRole('heading', { level: 1 }))
        .toHaveTextContent('Posts');
    });

    it('should render "New post" link', async () => {
      render(Page, { data: { posts: [] } });

      await expect
        .element(page.getByRole('link', { name: 'New post' }))
        .toBeInTheDocument();
    });
  });

  describe('error state', () => {
    it('should display error message when loadError is present', async () => {
      render(Page, { data: { posts: [], loadError: 'Failed to load posts' } });

      await expect
        .element(page.getByText('Failed to load posts'))
        .toBeInTheDocument();
    });

    it('should not render posts table when loadError is present', async () => {
      render(Page, { data: { posts: [], loadError: 'Failed to load posts' } });

      await expect.element(page.getByRole('table')).not.toBeInTheDocument();
    });
  });

  describe('empty state', () => {
    it('should display empty state message when no posts exist', async () => {
      render(Page, { data: { posts: [] } });

      await expect.element(page.getByText('No posts yet.')).toBeInTheDocument();
    });

    it('should display "Write the first post" link in empty state', async () => {
      render(Page, { data: { posts: [] } });

      await expect
        .element(page.getByRole('link', { name: /Write the first post/ }))
        .toBeInTheDocument();
    });

    it('should not render posts table when posts array is empty', async () => {
      render(Page, { data: { posts: [] } });

      await expect.element(page.getByRole('table')).not.toBeInTheDocument();
    });
  });

  describe('posts table', () => {
    beforeEach(() => {
      vi.stubGlobal(
        'fetch',
        vi.fn(() => Promise.resolve({ ok: true, status: 200 })),
      );
    });

    afterEach(() => {
      vi.unstubAllGlobals();
    });

    it('should render table when posts exist', async () => {
      render(Page, { data: { posts: [mockPost] } });

      await expect.element(page.getByRole('table')).toBeInTheDocument();
    });

    it('should display post title', async () => {
      render(Page, { data: { posts: [mockPost] } });

      await expect.element(page.getByText(mockPost.title)).toBeInTheDocument();
    });

    it('should display post id', async () => {
      render(Page, { data: { posts: [mockPost] } });

      await expect.element(page.getByText(mockPost.id)).toBeInTheDocument();
    });

    it('should render all posts', async () => {
      render(Page, { data: { posts: [mockPost, mockPost2] } });

      await expect.element(page.getByText(mockPost.title)).toBeInTheDocument();
      await expect.element(page.getByText(mockPost2.title)).toBeInTheDocument();
    });

    it('should render post title as a link to public post page', async () => {
      render(Page, { data: { posts: [mockPost] } });

      await expect
        .element(page.getByRole('link', { name: mockPost.title }))
        .toHaveAttribute('href', `/posts/${mockPost.id}`);
      await expect
        .element(page.getByRole('link', { name: mockPost.title }))
        .toHaveAttribute('target', '_blank');
      await expect
        .element(page.getByRole('link', { name: mockPost.title }))
        .toHaveAttribute('rel', 'noopener noreferrer');
    });

    it('should render an "Edit" link for the post', async () => {
      render(Page, { data: { posts: [mockPost] } });

      await expect
        .element(page.getByRole('link', { name: 'Edit' }))
        .toBeInTheDocument();
    });

    it('should render a "Delete" button for the post', async () => {
      render(Page, { data: { posts: [mockPost] } });

      await expect
        .element(page.getByRole('button', { name: 'Delete' }))
        .toBeInTheDocument();
    });

    it('should remove post from table when Delete button is clicked', async () => {
      vi.stubGlobal('confirm', () => true);
      render(Page, { data: { posts: [mockPost] } });

      await page.getByRole('button', { name: 'Delete' }).click();

      await vi.waitFor(() => {
        const text = document.body.textContent ?? '';
        expect(text).not.toContain(mockPost.title);
        expect(text).not.toContain(mockPost.id);
      });
    });

    it('should not show empty state when posts exist', async () => {
      render(Page, { data: { posts: [mockPost] } });

      await expect
        .element(page.getByText('No posts yet.'))
        .not.toBeInTheDocument();
    });
  });

  describe('post count', () => {
    it('should show singular "post" for one post', async () => {
      render(Page, { data: { posts: [mockPost] } });

      await expect.element(page.getByText('1 post')).toBeInTheDocument();
    });

    it('should show plural "posts" for multiple posts', async () => {
      render(Page, { data: { posts: [mockPost, mockPost2] } });

      await expect.element(page.getByText('2 posts')).toBeInTheDocument();
    });
  });
});
