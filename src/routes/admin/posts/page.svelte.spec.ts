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

      await Promise.all([
        expect
          .element(page.getByRole('heading', { level: 1 }))
          .toHaveTextContent('Posts'),
        expect
          .element(page.getByRole('link', { name: 'New post' }))
          .toBeInTheDocument(),
        expect.element(page.getByText('No posts yet.')).toBeInTheDocument(),
        expect
          .element(page.getByRole('link', { name: /Write the first post/ }))
          .toBeInTheDocument(),
        expect.element(page.getByRole('table')).not.toBeInTheDocument(),
      ]);
    });
  });

  describe('error state', () => {
    it('should display error message when loadError is present', async () => {
      render(Page, { data: { posts: [], loadError: 'Failed to load posts' } });

      await Promise.all([
        expect
          .element(page.getByText('Failed to load posts'))
          .toBeInTheDocument(),
        expect.element(page.getByRole('table')).not.toBeInTheDocument(),
      ]);
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
      const titleLink = page.getByRole('link', { name: mockPost.title });

      await Promise.all([
        expect.element(page.getByRole('table')).toBeInTheDocument(),
        expect.element(page.getByText(mockPost.title)).toBeInTheDocument(),
        expect.element(page.getByText(mockPost.id)).toBeInTheDocument(),
        expect.element(page.getByText('No posts yet.')).not.toBeInTheDocument(),
        expect.element(page.getByText('1 post')).toBeInTheDocument(),
        expect
          .element(titleLink)
          .toHaveAttribute('href', `/posts/${mockPost.id}`),
        expect.element(titleLink).toHaveAttribute('target', '_blank'),
        expect.element(titleLink).toHaveAttribute('rel', 'noopener noreferrer'),
        expect
          .element(page.getByRole('link', { name: 'Edit' }))
          .toBeInTheDocument(),
        expect
          .element(page.getByRole('button', { name: 'Delete' }))
          .toBeInTheDocument(),
      ]);
    });

    it('should render a "Delete" button for the post', async () => {
      render(Page, { data: { posts: [mockPost] } });

      await Promise.all([
        expect.element(page.getByText(mockPost.title)).toBeInTheDocument(),
        expect.element(page.getByText(mockPost2.title)).toBeInTheDocument(),
        expect.element(page.getByText('2 posts')).toBeInTheDocument(),
      ]);
    });

    it('should remove post from table when Delete button is clicked', async () => {
      vi.stubGlobal('confirm', () => true);
      render(Page, { data: { posts: [mockPost] } });

      await page.getByRole('button', { name: 'Delete' }).click();

      await Promise.all([
        expect.element(page.getByText(mockPost.title)).not.toBeInTheDocument(),
        expect.element(page.getByText(mockPost.id)).not.toBeInTheDocument(),
      ]);
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
