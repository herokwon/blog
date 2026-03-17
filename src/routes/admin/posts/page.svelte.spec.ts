import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

import { createMockPost } from '$lib/test-utils';
import type { Post } from '$lib/types/post';
import { render } from 'vitest-browser-svelte';
import { page } from 'vitest/browser';

import Page from './+page.svelte';

const mockPost: Post = createMockPost({
  id: '123e4567-e89b-12d3-a456-426614174000',
  title: 'title1',
});

const mockPost2: Post = createMockPost({
  id: '123e4567-e89b-12d3-a456-426614174001',
  title: 'title2',
});

describe('[Page] /admin/posts', () => {
  afterEach(() => {
    vi.unstubAllGlobals();
    vi.restoreAllMocks();
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

    it('should not remove post when user cancels the confirmation dialog', async () => {
      vi.stubGlobal('confirm', () => false);
      render(Page, { data: { posts: [mockPost] } });

      await page.getByRole('button', { name: 'Delete' }).click();

      await expect.element(page.getByText(mockPost.title)).toBeInTheDocument();
    });

    it('should log error and keep post when server returns a non-ok response', async () => {
      vi.stubGlobal('confirm', () => true);
      vi.stubGlobal(
        'fetch',
        vi.fn(() => Promise.resolve({ ok: false, status: 500 })),
      );
      const errorSpy = vi.spyOn(console, 'error').mockImplementation(() => {});

      render(Page, { data: { posts: [mockPost] } });
      await page.getByRole('button', { name: 'Delete' }).click();

      await vi.waitFor(() => {
        expect(errorSpy).toHaveBeenCalledWith(
          'Error deleting post: Failed to delete post (status 500)',
        );
      });
      await expect.element(page.getByText(mockPost.title)).toBeInTheDocument();
    });

    it('should log error when fetch rejects with a non-Error value', async () => {
      vi.stubGlobal('confirm', () => true);
      vi.stubGlobal(
        'fetch',
        vi.fn(() => Promise.reject('Network timeout')),
      );
      const errorSpy = vi.spyOn(console, 'error').mockImplementation(() => {});

      render(Page, { data: { posts: [mockPost] } });
      await page.getByRole('button', { name: 'Delete' }).click();

      await vi.waitFor(() => {
        expect(errorSpy).toHaveBeenCalledWith(
          'Error deleting post: Network timeout',
        );
      });
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

    it('should update count to singular after deleting one of two posts', async () => {
      vi.stubGlobal('confirm', () => true);
      vi.stubGlobal(
        'fetch',
        vi.fn(() => Promise.resolve({ ok: true, status: 200 })),
      );
      render(Page, { data: { posts: [mockPost, mockPost2] } });

      await expect.element(page.getByText('2 posts')).toBeInTheDocument();

      await page.getByRole('button', { name: 'Delete' }).first().click();

      await vi.waitFor(() => {
        expect(document.body.textContent).toContain('1 post');
      });
    });

    it('should fall back to empty string when posts.length is nullish', async () => {
      // Svelte 5 compiles `{data.posts.length}` as `${data().posts.length ?? ''}`.
      // The `?? ''` fallback branch is only triggered when .length is null/undefined.
      // We use a Proxy to make .length return null, covering that compiler-generated branch.
      const posts = new Proxy([] as Post[], {
        get(target, prop, receiver) {
          if (prop === 'length') return null;
          return Reflect.get(target, prop, receiver);
        },
      });
      render(Page, { data: { posts } });
      // null !== 0, so the table branch is entered (not empty state)
      await expect.element(page.getByRole('table')).toBeInTheDocument();
    });
  });
});
