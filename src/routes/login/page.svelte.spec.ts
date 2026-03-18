import { afterEach, describe, expect, it, vi } from 'vitest';

import { render } from 'vitest-browser-svelte';
import { page } from 'vitest/browser';

import Page from './+page.svelte';

describe('[Page] /login', () => {
  afterEach(() => {
    vi.restoreAllMocks();
  });

  it('renders "Admin Login" heading', async () => {
    await render(Page, { form: null });

    await expect
      .element(page.getByRole('heading', { level: 2 }))
      .toHaveTextContent('Admin Login');
  });

  it('renders username input', async () => {
    await render(Page, { form: null });

    await expect.element(page.getByLabelText('Username')).toBeInTheDocument();
  });

  it('renders password input', async () => {
    await render(Page, { form: null });

    await expect.element(page.getByLabelText('Password')).toBeInTheDocument();
  });

  it('renders Login submit button', async () => {
    await render(Page, { form: null });

    await expect
      .element(page.getByRole('button', { name: 'Login' }))
      .toBeInTheDocument();
  });

  it('does not render error message when form is null', async () => {
    await render(Page, { form: null });

    await expect.element(page.getByRole('paragraph')).not.toBeInTheDocument();
  });

  it('renders error message when form.message is present', async () => {
    await render(Page, { form: { message: 'Invalid username or password' } });

    await expect
      .element(page.getByText('Invalid username or password'))
      .toBeInTheDocument();
  });
});
