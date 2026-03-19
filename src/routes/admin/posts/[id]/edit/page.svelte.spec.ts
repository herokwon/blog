import { afterEach, describe, expect, it, vi } from 'vitest';

import { createMockPost, stubGlobalFetch } from '$lib/test-utils';
import type { UpdatePostByIdApiResponse } from '$lib/types/api';
import type { Post } from '$lib/types/post';
import { render, type RenderResult } from 'vitest-browser-svelte';
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

const mockPost: Post = createMockPost({
  id: '123e4567-e89b-12d3-a456-426614174100',
});

const mockPost2: Post = createMockPost({
  id: '123e4567-e89b-12d3-a456-426614174101',
});

describe('[Page] /admin/posts/[id]/edit', () => {
  afterEach(() => {
    vi.restoreAllMocks();
    vi.unstubAllGlobals();
    gotoMock.mockReset();
    beforeNavigateHandlers.length = 0;
  });

  it('should render form with prefilled values', async () => {
    await renderPage();

    await Promise.all([
      expect
        .element(page.getByRole('heading', { level: 1 }))
        .toHaveTextContent('Edit post'),
      expect
        .element(page.getByRole('textbox', { name: 'Title' }))
        .toHaveValue(mockPost.title),
      expect
        .element(page.getByRole('textbox', { name: 'Content' }))
        .toBeInTheDocument(),
      expect
        .element(page.getByRole('button', { name: 'Cancel' }))
        .toBeInTheDocument(),
      expect
        .element(page.getByRole('button', { name: 'Update' }))
        .toHaveAttribute('disabled'),
    ]);
  });

  it('should navigate to admin posts when cancel is clicked', async () => {
    await renderPage();

    await page.getByRole('button', { name: 'Cancel' }).click();

    expect(gotoMock).toHaveBeenCalledWith('/admin/posts');
  });

  it('should reset form values when post id changes', async () => {
    const view = await renderPage();

    await page.getByRole('textbox', { name: 'Title' }).fill('Changed Title');

    await expect
      .element(page.getByRole('button', { name: 'Update' }))
      .not.toHaveAttribute('disabled');

    await view.rerender({ data: { post: mockPost2 } });

    await Promise.all([
      expect
        .element(page.getByRole('textbox', { name: 'Title' }))
        .toHaveValue(mockPost2.title),
      expect
        .element(page.getByRole('textbox', { name: 'Content' }))
        .toHaveTextContent(mockPost2.content),
      expect
        .element(page.getByRole('button', { name: 'Update' }))
        .toHaveAttribute('disabled'),
    ]);
  });

  it('should submit update request and navigate on success', async () => {
    const confirmSpy = vi.spyOn(window, 'confirm').mockReturnValue(true);
    stubGlobalFetch<UpdatePostByIdApiResponse>({
      response: {
        success: true,
        data: {
          ...mockPost,
          title: 'Updated Title',
          content: 'Updated Content',
        },
        error: null,
      },
    });
    await renderPage();

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
    stubGlobalFetch<UpdatePostByIdApiResponse>({
      response: {
        success: false,
        data: null,
        error: {
          code: 'INVALID_REQUEST',
          message: 'Invalid input data.',
          details: null,
        },
      },
      options: { status: 400 },
    });
    await renderPage();

    await submitForm();

    expect(confirmSpy).toHaveBeenCalledWith('Update this post?');
    expect(fetch).toHaveBeenCalledTimes(1);
    expect(gotoMock).not.toHaveBeenCalled();
  });

  it('should not submit when user declines update confirmation', async () => {
    const confirmSpy = vi.spyOn(window, 'confirm').mockReturnValue(false);
    stubGlobalFetch<UpdatePostByIdApiResponse>({
      response: {
        success: true,
        data: {
          ...mockPost,
          title: 'Updated Title',
          content: 'Updated Content',
        },
        error: null,
      },
    });
    await renderPage();

    await submitForm();

    expect(confirmSpy).toHaveBeenCalledWith('Update this post?');
    expect(fetch).not.toHaveBeenCalled();
    expect(gotoMock).not.toHaveBeenCalled();
  });

  it('should cancel client-side navigation when user declines with unsaved changes', async () => {
    await renderPage();

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
    await renderPage();

    await page.getByRole('textbox', { name: 'Title' }).fill('Changed Title');

    const confirmSpy = vi.spyOn(window, 'confirm');
    const cancel = vi.fn();
    beforeNavigateHandlers[0]?.({ to: null, cancel });

    expect(confirmSpy).not.toHaveBeenCalled();
    expect(cancel).not.toHaveBeenCalled();
  });

  it('should skip navigation guard when there are no unsaved changes', async () => {
    await renderPage();

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
    stubGlobalFetch({ options: { pending: true } });
    const confirmSpy = vi.spyOn(window, 'confirm').mockReturnValue(true);
    await renderPage();

    await submitForm();

    expect(confirmSpy).toHaveBeenCalledTimes(1);

    const cancel = vi.fn();
    beforeNavigateHandlers[0]?.({ to: { route: { id: '/other' } }, cancel });

    expect(confirmSpy).toHaveBeenCalledTimes(1);
    expect(cancel).not.toHaveBeenCalled();
  });

  it('should allow navigation when user confirms leaving with unsaved changes', async () => {
    await renderPage();

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
    await renderPage();

    await expect
      .element(page.getByRole('textbox', { name: 'Title' }))
      .toHaveValue(mockPost.title);

    const event = new Event('beforeunload', { cancelable: true });
    const preventDefaultSpy = vi.spyOn(event, 'preventDefault');

    window.dispatchEvent(event);

    expect(preventDefaultSpy).not.toHaveBeenCalled();
  });

  it('should prevent page unload when there are unsaved changes', async () => {
    await renderPage();

    await page.getByRole('textbox', { name: 'Title' }).fill('Changed Title');

    const event = new Event('beforeunload', { cancelable: true });
    const preventDefaultSpy = vi.spyOn(event, 'preventDefault');
    window.dispatchEvent(event);

    expect(preventDefaultSpy).toHaveBeenCalled();
  });

  it('should not prevent page unload while the form is being submitted', async () => {
    stubGlobalFetch({ options: { pending: true } });
    vi.spyOn(window, 'confirm').mockReturnValue(true);

    await renderPage();

    await submitForm();

    const event = new Event('beforeunload', { cancelable: true });
    const preventDefaultSpy = vi.spyOn(event, 'preventDefault');
    window.dispatchEvent(event);

    expect(preventDefaultSpy).not.toHaveBeenCalled();
  });

  it('should remove beforeunload listener on unmount', async () => {
    const removeEventListenerSpy = vi.spyOn(window, 'removeEventListener');
    const view = await renderPage();

    await view.unmount();

    expect(removeEventListenerSpy).toHaveBeenCalledWith(
      'beforeunload',
      expect.any(Function),
    );
  });
});

async function renderPage(): Promise<RenderResult<typeof Page>> {
  return await render(Page, { data: { post: mockPost } });
}

async function submitForm(): Promise<void> {
  await page.getByRole('textbox', { name: 'Title' }).fill('Changed Title');
  await page.getByRole('button', { name: 'Update' }).click();
}
