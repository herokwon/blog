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

vi.mock('$lib/components/editor/config', () => ({
  createMilkdownEditor: vi.fn(
    async (options: {
      root: HTMLElement;
      defaultValue: string;
      onChange?: (markdown: string) => void;
      readOnly?: boolean;
    }) => {
      const editable = document.createElement('div');
      editable.setAttribute('contenteditable', 'true');
      editable.setAttribute('role', 'textbox');
      editable.textContent = options.defaultValue ?? '';
      options.root.appendChild(editable);
      options.onChange?.(options.defaultValue ?? '');
      return {};
    },
  ),
}));

const now = new Date().toISOString();
const mockPost: Post = {
  id: '123e4567-e89b-12d3-a456-426614174100',
  title: 'Original Title',
  content: 'Original Content',
  createdAt: now,
  updatedAt: now,
};

const mockPost2: Post = {
  id: '123e4567-e89b-12d3-a456-426614174101',
  title: 'Second Title',
  content: 'Second Content',
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

describe('[Page] /admin/posts/[id]/edit', () => {
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

  it('should reset form values when post id changes', async () => {
    const view = render(Page, { data: { post: mockPost } });

    await page.getByRole('textbox', { name: 'Title' }).fill('Changed Title');

    await expect
      .element(page.getByRole('button', { name: 'Update' }))
      .not.toHaveAttribute('disabled');

    await view.rerender({ data: { post: mockPost2 } });

    await expect
      .element(page.getByRole('textbox', { name: 'Title' }))
      .toHaveValue(mockPost2.title);
    await expect
      .element(page.getByRole('textbox', { name: 'Content' }))
      .toHaveTextContent(mockPost2.content);
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

  it('should skip navigation guard when navigation.to is null', async () => {
    render(Page, { data: { post: mockPost } });

    await page.getByRole('textbox', { name: 'Title' }).fill('Changed Title');

    const confirmSpy = vi.spyOn(window, 'confirm');
    const cancel = vi.fn();

    beforeNavigateHandlers[0]?.({ to: null, cancel });

    expect(confirmSpy).not.toHaveBeenCalled();
    expect(cancel).not.toHaveBeenCalled();
  });

  it('should skip navigation guard when there are no unsaved changes', async () => {
    render(Page, { data: { post: mockPost } });

    await expect
      .element(page.getByRole('textbox', { name: 'Title' }))
      .toHaveValue(mockPost.title);

    const confirmSpy = vi.spyOn(window, 'confirm');
    const cancel = vi.fn();

    beforeNavigateHandlers[0]?.({ to: { route: { id: '/other' } }, cancel });

    expect(confirmSpy).not.toHaveBeenCalled();
    expect(cancel).not.toHaveBeenCalled();
  });

  it('should skip navigation guard while the form is being submitted', async () => {
    vi.stubGlobal(
      'fetch',
      vi.fn(() => new Promise(() => {})),
    );
    const confirmSpy = vi.spyOn(window, 'confirm').mockReturnValue(true);

    render(Page, { data: { post: mockPost } });

    await page.getByRole('textbox', { name: 'Title' }).fill('Changed Title');
    await page.getByRole('button', { name: 'Update' }).click();

    expect(confirmSpy).toHaveBeenCalledTimes(1);

    const cancel = vi.fn();
    beforeNavigateHandlers[0]?.({ to: { route: { id: '/other' } }, cancel });

    expect(confirmSpy).toHaveBeenCalledTimes(1);
    expect(cancel).not.toHaveBeenCalled();
  });

  it('should allow navigation when user confirms leaving with unsaved changes', async () => {
    render(Page, { data: { post: mockPost } });

    await page.getByRole('textbox', { name: 'Title' }).fill('Changed Title');

    const confirmSpy = vi.spyOn(window, 'confirm').mockReturnValue(true);
    const cancel = vi.fn();

    beforeNavigateHandlers[0]?.({ to: { route: { id: '/other' } }, cancel });

    expect(confirmSpy).toHaveBeenCalledWith(
      'You have unsaved changes. Leave this page?',
    );
    expect(cancel).not.toHaveBeenCalled();
  });

  it('should not prevent page unload when there are no unsaved changes', async () => {
    render(Page, { data: { post: mockPost } });

    await expect
      .element(page.getByRole('textbox', { name: 'Title' }))
      .toHaveValue(mockPost.title);

    const event = new Event('beforeunload', { cancelable: true });
    const preventDefaultSpy = vi.spyOn(event, 'preventDefault');

    window.dispatchEvent(event);

    expect(preventDefaultSpy).not.toHaveBeenCalled();
  });

  it('should prevent page unload when there are unsaved changes', async () => {
    render(Page, { data: { post: mockPost } });

    await page.getByRole('textbox', { name: 'Title' }).fill('Changed Title');

    const event = new Event('beforeunload', { cancelable: true });
    const preventDefaultSpy = vi.spyOn(event, 'preventDefault');

    window.dispatchEvent(event);

    expect(preventDefaultSpy).toHaveBeenCalled();
  });

  it('should not prevent page unload while the form is being submitted', async () => {
    vi.stubGlobal(
      'fetch',
      vi.fn(() => new Promise(() => {})),
    );
    vi.spyOn(window, 'confirm').mockReturnValue(true);

    render(Page, { data: { post: mockPost } });

    await page.getByRole('textbox', { name: 'Title' }).fill('Changed Title');
    await page.getByRole('button', { name: 'Update' }).click();

    const event = new Event('beforeunload', { cancelable: true });
    const preventDefaultSpy = vi.spyOn(event, 'preventDefault');

    window.dispatchEvent(event);

    expect(preventDefaultSpy).not.toHaveBeenCalled();
  });

  it('should remove beforeunload listener on unmount', async () => {
    const removeEventListenerSpy = vi.spyOn(window, 'removeEventListener');
    const view = render(Page, { data: { post: mockPost } });

    await view.unmount();

    expect(removeEventListenerSpy).toHaveBeenCalledWith(
      'beforeunload',
      expect.any(Function),
    );
  });
});
