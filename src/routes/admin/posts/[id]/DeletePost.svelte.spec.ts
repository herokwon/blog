import { render } from 'vitest-browser-svelte';
import { page, userEvent } from 'vitest/browser';

import DeletePost from './DeletePost.svelte';

it('opens a reversible-delete warning, supports Escape, and submits the version only when confirmed', async () => {
  render(DeletePost, { id: 'example', version: 4 });
  const trigger = page.getByRole('button', { name: '삭제', exact: true });
  const dialog = page.getByRole('dialog', { name: '게시글 삭제' });
  await trigger.click();
  await expect.element(dialog).toBeVisible();
  await expect.element(dialog.getByText(/휴지통으로 이동/)).toBeVisible();
  await expect
    .element(dialog.getByRole('button', { name: '취소' }))
    .toHaveFocus();
  await userEvent.keyboard('{Escape}');
  await expect.element(dialog).not.toBeInTheDocument();
  await expect.element(trigger).toHaveFocus();

  await trigger.click();
  const confirm = dialog.getByRole('button', { name: '확인', exact: true });
  const form = (confirm.element() as HTMLButtonElement).form!;
  let result: FormDataEntryValue | null | undefined;
  form.addEventListener('submit', event => {
    event.preventDefault();
    result = new FormData(form).get('version');
  });
  await confirm.click();
  expect(result).toBe('4');
});
