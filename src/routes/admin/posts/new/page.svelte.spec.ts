import { afterEach, describe, expect, it, vi } from 'vitest';

import type { ApiResponse } from '$lib/types/api';
import type { Post } from '$lib/types/post';
import { render } from 'vitest-browser-svelte';
import { page } from 'vitest/browser';

import Page from './+page.svelte';

const now = new Date().toISOString();
const mockPost: Post = {
  id: crypto.randomUUID(),
  title: 'Test Title',
  content: 'Test Content',
  createdAt: now,
  updatedAt: now,
};

function stubFetch(response: ApiResponse<Post>): void {
  vi.stubGlobal(
    'fetch',
    vi
      .fn()
      .mockResolvedValueOnce({ json: vi.fn().mockResolvedValueOnce(response) }),
  );
}

async function submitForm(): Promise<void> {
  await page.getByRole('textbox', { name: 'Title' }).fill('Hello');
  await page.getByRole('textbox', { name: 'Content' }).fill('World');
  await page.getByRole('button', { name: 'Submit' }).click();
}

describe('[Routes] /admin/posts/new', () => {
  afterEach(() => {
    vi.unstubAllGlobals();
    localStorage.clear();
  });

  it('should render form elements', async () => {
    render(Page);

    await expect
      .element(page.getByRole('textbox', { name: 'Title' }))
      .toBeInTheDocument();
    await expect
      .element(page.getByRole('textbox', { name: 'Content' }))
      .toBeInTheDocument();
    await expect
      .element(page.getByRole('button', { name: 'Submit' }))
      .toBeInTheDocument();
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
      .element(page.getByRole('textbox', { name: 'Content' }))
      .toHaveTextContent('Draft Content');
  });

  it('should show success message and reset form on successful submission', async () => {
    stubFetch({
      success: true,
      data: mockPost,
      error: null,
    });
    render(Page);

    await submitForm();

    await expect
      .element(page.getByText('Created a new post successfully!'))
      .toBeInTheDocument();
    await expect
      .element(page.getByText(`ID: ${mockPost.id}`))
      .toBeInTheDocument();
    await expect
      .element(page.getByRole('textbox', { name: 'Title' }))
      .toHaveValue('');
    await expect
      .element(page.getByRole('textbox', { name: 'Content' }))
      .toBeInTheDocument();
  });

  it('should show error message on API error response', async () => {
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

    await expect
      .element(page.getByText('Invalid input data.'))
      .toBeInTheDocument();
  });

  it('should show error message on network failure', async () => {
    vi.stubGlobal(
      'fetch',
      vi.fn().mockRejectedValueOnce(new Error('Network Error')),
    );
    render(Page);

    await submitForm();

    await expect.element(page.getByText('Network Error')).toBeInTheDocument();
  });
});
