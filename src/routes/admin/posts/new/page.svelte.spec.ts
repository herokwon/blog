import { afterEach, describe, expect, it, vi } from 'vitest';

import { createMockPost } from '$lib/test-utils';
import type { CreatePostApiResponse } from '$lib/types/api';
import { render } from 'vitest-browser-svelte';
import { page } from 'vitest/browser';

import Page from './+page.svelte';

const { gotoMock } = vi.hoisted(() => ({
  gotoMock: vi.fn(),
}));

vi.mock('$app/navigation', () => ({
  goto: gotoMock,
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

const mockPost = createMockPost();

function stubFetch(response: CreatePostApiResponse): void {
  vi.stubGlobal(
    'fetch',
    vi
      .fn()
      .mockResolvedValueOnce({ json: vi.fn().mockResolvedValueOnce(response) }),
  );
}

async function submitForm(): Promise<void> {
  await page.getByRole('textbox', { name: 'Title' }).fill('Hello');
  await page.getByRole('button', { name: 'Submit' }).click();
}

describe('[Page] /admin/posts/new', () => {
  afterEach(() => {
    vi.unstubAllGlobals();
    localStorage.clear();
    gotoMock.mockReset();
  });

  it('should render form elements', async () => {
    render(Page);

    await Promise.all([
      expect
        .element(page.getByRole('textbox', { name: 'Title' }))
        .toBeInTheDocument(),
      expect
        .element(page.getByRole('textbox', { name: 'Content' }))
        .toBeInTheDocument(),
      expect
        .element(page.getByRole('button', { name: 'Save draft' }))
        .toBeInTheDocument(),
      expect
        .element(page.getByRole('button', { name: 'Submit' }))
        .toBeInTheDocument(),
    ]);
  });

  it('should restore draft from localStorage on mount', async () => {
    localStorage.setItem(
      'DRAFT_POST',
      JSON.stringify({
        title: 'Draft Title',
        content: 'Draft Content',
      }),
    );
    render(Page);

    await expect
      .element(page.getByRole('textbox', { name: 'Title' }))
      .toHaveValue('Draft Title');
    await expect
      .element(page.getByRole('textbox', { name: /content/i }))
      .toHaveTextContent('Draft Content');
  });

  it('should not save draft when title and content are both empty', async () => {
    render(Page);
    await expect
      .element(page.getByRole('button', { name: 'Save draft' }))
      .toBeDisabled();

    const setItemSpy = vi.spyOn(Storage.prototype, 'setItem');

    const button = document.querySelector(
      'button[type="button"]',
    ) as HTMLButtonElement;
    button.disabled = false;
    button.click();

    expect(setItemSpy).not.toHaveBeenCalled();
  });

  it('should save draft to localStorage', async () => {
    render(Page);

    await page.getByRole('textbox', { name: 'Title' }).fill('Hello');
    await page.getByRole('button', { name: 'Save draft' }).click();

    expect(localStorage.getItem('DRAFT_POST')).toBe(
      JSON.stringify({ title: 'Hello', content: '' }),
    );
  });

  it('should navigate to post detail on successful submission', async () => {
    stubFetch({
      success: true,
      data: mockPost,
      error: null,
    });
    localStorage.setItem(
      'DRAFT_POST',
      JSON.stringify({ title: 'A', content: 'B' }),
    );
    render(Page);

    await submitForm();

    expect(gotoMock).toHaveBeenCalledWith(`/posts/${mockPost.id}`);
    expect(localStorage.getItem('DRAFT_POST')).toBeNull();
  });

  it('should handle corrupted localStorage data gracefully', async () => {
    localStorage.setItem('DRAFT_POST', 'not-valid-json');
    const consoleErrorSpy = vi
      .spyOn(console, 'error')
      .mockImplementation(() => {});
    render(Page);

    await expect
      .element(page.getByRole('textbox', { name: 'Title' }))
      .toHaveValue('');
    expect(consoleErrorSpy).toHaveBeenCalledWith(
      'Failed to load draft post from localStorage:',
      expect.any(Error),
    );
  });

  it('should not navigate on API error response', async () => {
    localStorage.setItem(
      'DRAFT_POST',
      JSON.stringify({ title: 'Draft Title', content: 'Draft Content' }),
    );
    stubFetch({
      success: false,
      data: null,
      error: {
        code: 'INVALID_REQUEST',
        message: 'Invalid input data.',
        details: null,
      },
    });
    render(Page);

    await submitForm();

    expect(gotoMock).not.toHaveBeenCalled();
  });
});
