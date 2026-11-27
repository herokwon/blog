import { render } from 'vitest-browser-svelte';
import { page } from 'vitest/browser';

import SessionHeader from './SessionHeader.svelte';

it('sends an authenticated administrator to Access logout with a same-origin home return', async () => {
  render(SessionHeader, {
    signedIn: true,
    onAdminPage: true,
    returnTo: 'https://blog.herokwon.dev/',
  });
  const form = (
    page
      .getByRole('button', { name: '로그아웃' })
      .element() as HTMLButtonElement
  ).form!;
  expect(form.getAttribute('action')).toBe('/cdn-cgi/access/logout');
  expect(new FormData(form).get('returnTo')).toBe('https://blog.herokwon.dev/');
  await expect
    .element(page.getByRole('link', { name: '로그인' }))
    .not.toBeInTheDocument();
});

it('offers the admin link to a signed-in user outside the admin area', async () => {
  render(SessionHeader, {
    signedIn: true,
    onAdminPage: false,
    returnTo: 'https://blog.herokwon.dev/',
  });
  await expect
    .element(page.getByRole('link', { name: '관리자 페이지', exact: true }))
    .toHaveAttribute('href', '/admin');
  await expect
    .element(page.getByRole('button', { name: '로그아웃' }))
    .not.toBeInTheDocument();
});
