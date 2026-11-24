import { render } from 'vitest-browser-svelte';
import { page, userEvent } from 'vitest/browser';

import CategoryDialog from './CategoryDialog.svelte';

it('opens the add form in a dialog and returns focus to the trigger after Escape', async () => {
  render(CategoryDialog, {});
  const trigger = page.getByRole('button', { name: '추가', exact: true });
  await trigger.click();
  const dialog = page.getByRole('dialog', { name: '카테고리 추가' });
  await expect.element(dialog.getByRole('textbox')).toHaveFocus();
  await userEvent.keyboard('{Escape}');
  await expect.element(dialog).not.toBeInTheDocument();
  await expect.element(trigger).toHaveFocus();
});

it('reopens the edit dialog with the rejected name and category ID', async () => {
  render(CategoryDialog, {
    categoryId: 5,
    value: '입력한 이름',
    message: '이미 사용 중인 카테고리 이름입니다.',
  });
  const dialog = page.getByRole('dialog', { name: '카테고리 이름 변경' });
  await expect
    .element(dialog.getByText('이미 사용 중인 카테고리 이름입니다.'))
    .toBeVisible();
  await expect.element(dialog.getByRole('textbox')).toHaveValue('입력한 이름');
  await expect
    .element(dialog.getByRole('textbox'))
    .toHaveAttribute('aria-invalid', 'true');
  const form = dialog.getByRole('form').element() as HTMLFormElement;
  expect(form.getAttribute('action')).toBe('?/rename');
  expect(new FormData(form).get('id')).toBe('5');
  await userEvent.keyboard('{Escape}');
  await expect
    .element(page.getByRole('button', { name: '이름 변경', exact: true }))
    .toHaveFocus();
});
