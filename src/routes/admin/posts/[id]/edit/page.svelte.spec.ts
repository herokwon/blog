import { afterEach, describe, expect, it, vi } from 'vitest';

import type { UpdatePostByIdApiResponse } from '$lib/types/api';
import type { Post } from '$lib/types/post';
import { render } from 'vitest-browser-svelte';
import { page } from 'vitest/browser';

import Page from './+page.svelte';

const { gotoMock, beforeNavigateHandlers } = vi.hoisted(() => ({
  gotoMock: vi.fn(),
  beforeNavigateHandlers: [] as Array<
    (navigation: { to: object | null; cancel: () => void }) => void
  >,
}));

vi.mock('$app/navigation', () => ({
  goto: gotoMock,
  beforeNavigate: (
    handler: (navigation: { to: object | null; cancel: () => void }) => void,
  ) => {
    beforeNavigateHandlers.push(handler);
  },
}));

const now = new Date().toISOString();
const mockPost: Post = {
  id: '123e4567-e89b-12d3-a456-426614174100',
  title: 'Original Title',
  content: 'Original Content',
  createdAt: now,
  updatedAt: now,
};

function stubFetch(response: UpdatePostByIdApiResponse): void {
  vi.stubGlobal(
    'fetch',
    vi
      .fn()
      .mockResolvedValueOnce({ json: vi.fn().mockResolvedValueOnce(response) }),
  );
}

describe('[Routes] /admin/posts/[id]/edit', () => {
  afterEach(() => {
    vi.restoreAllMocks();
    vi.unstubAllGlobals();
    gotoMock.mockReset();
    beforeNavigateHandlers.length = 0;
  });

  it('should render form elements', async () => {
    render(Page, { data: { post: mockPost } });

    await expect
      .element(page.getByRole('heading', { level: 1 }))
      .toHaveTextContent('Edit post');
    await expect
      .element(page.getByRole('textbox', { name: 'Title' }))
      .toBeInTheDocument();
    await expect
      .element(page.getByRole('textbox', { name: 'Content' }))
      .toBeInTheDocument();
    await expect
      .element(page.getByRole('button', { name: 'Cancel' }))
      .toBeInTheDocument();
    await expect
      .element(page.getByRole('button', { name: 'Update' }))
      .toBeInTheDocument();
  });

  it('should navigate to admin posts when cancel is clicked', async () => {
    render(Page, { data: { post: mockPost } });

    await page.getByRole('button', { name: 'Cancel' }).click();

    expect(gotoMock).toHaveBeenCalledWith('/admin/posts');
  });

  it('should prefill title and content from page data', async () => {
    render(Page, { data: { post: mockPost } });

    await expect
      .element(page.getByRole('textbox', { name: 'Title' }))
      .toHaveValue(mockPost.title);

    await expect
      .element(page.getByRole('button', { name: 'Update' }))
      .toHaveAttribute('disabled');
  });

  it('should submit update request and navigate on success', async () => {
    const confirmSpy = vi.spyOn(window, 'confirm').mockReturnValue(true);

    stubFetch({
      success: true,
      data: { ...mockPost, title: 'Updated Title', content: 'Updated Content' },
      error: null,
    });

    render(Page, { data: { post: mockPost } });

    await expect
      .element(page.getByRole('textbox', { name: 'Title' }))
      .toHaveValue(mockPost.title);

    await page.getByRole('textbox', { name: 'Title' }).fill('Updated Title');

    await expect
      .element(page.getByRole('button', { name: 'Update' }))
      .not.toHaveAttribute('disabled');

    await page.getByRole('button', { name: 'Update' }).click();

    expect(confirmSpy).toHaveBeenCalledWith('Update this post?');

    expect(fetch).toHaveBeenCalledWith(`/api/posts/${mockPost.id}`, {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        title: 'Updated Title',
        content: mockPost.content,
      }),
    });
    expect(gotoMock).toHaveBeenCalledWith(`/posts/${mockPost.id}`);
  });

  it('should not navigate on API error response', async () => {
    const confirmSpy = vi.spyOn(window, 'confirm').mockReturnValue(true);

    stubFetch({
      success: false,
      data: null,
      error: {
        code: 'INVALID_REQUEST',
        message: 'Invalid input data.',
        details: null,
      },
    });

    render(Page, { data: { post: mockPost } });

    await page.getByRole('textbox', { name: 'Title' }).fill('Changed Title');
    await page.getByRole('button', { name: 'Update' }).click();

    expect(confirmSpy).toHaveBeenCalledWith('Update this post?');
    expect(fetch).toHaveBeenCalledTimes(1);
    expect(gotoMock).not.toHaveBeenCalled();
  });

  it('should not submit when user declines update confirmation', async () => {
    const confirmSpy = vi.spyOn(window, 'confirm').mockReturnValue(false);

    stubFetch({
      success: true,
      data: { ...mockPost, title: 'Updated Title', content: 'Updated Content' },
      error: null,
    });

    render(Page, { data: { post: mockPost } });

    await page.getByRole('textbox', { name: 'Title' }).fill('Changed Title');
    await page.getByRole('button', { name: 'Update' }).click();

    expect(confirmSpy).toHaveBeenCalledWith('Update this post?');
    expect(fetch).not.toHaveBeenCalled();
    expect(gotoMock).not.toHaveBeenCalled();
  });

  it('should cancel client-side navigation when user declines with unsaved changes', async () => {
    render(Page, { data: { post: mockPost } });

    await page.getByRole('textbox', { name: 'Title' }).fill('Changed Title');

    const confirmSpy = vi.spyOn(window, 'confirm').mockReturnValue(false);
    const cancel = vi.fn();

    beforeNavigateHandlers[0]?.({
      to: { route: { id: '/admin/posts' } },
      cancel,
    });

    expect(confirmSpy).toHaveBeenCalledWith(
      'You have unsaved changes. Leave this page?',
    );
    expect(cancel).toHaveBeenCalledTimes(1);
  });
});
