import { render } from 'vitest-browser-svelte';
import { page, userEvent } from 'vitest/browser';

import PostForm from './PostForm.svelte';

function renderForm(tags = '') {
  render(PostForm, {
    creating: true,
    categories: [{ id: 1, name: '개발' }],
    values: { id: 'test', title: 'Draft', body: '', categoryId: '1', tags },
  });
}

it('commits tag chips without interrupting IME and removes the focused chip with Backspace', async () => {
  renderForm();
  const input = page.getByRole('textbox', { name: '태그', exact: true });
  await expect
    .element(input)
    .toHaveAttribute('placeholder', '태그를 입력해 주세요. (최대 10개)');
  await input.fill('Svelte');
  await userEvent.keyboard(' ');
  const chip = page.getByRole('button', { name: '태그 svelte 제거' });
  await expect.element(chip).toBeInTheDocument();
  await expect.element(input).toHaveValue('');

  await input.fill('한글');
  input.element().dispatchEvent(
    new KeyboardEvent('keydown', {
      key: 'Enter',
      isComposing: true,
      bubbles: true,
      cancelable: true,
    }),
  );
  await expect.element(input).toHaveValue('한글');
  await userEvent.keyboard('{Enter}');
  const korean = page.getByRole('button', { name: '태그 한글 제거' });
  await expect.element(korean).toBeInTheDocument();
  await userEvent.keyboard('{Backspace}');
  await expect.element(korean).toHaveFocus();
  korean.element().dispatchEvent(
    new KeyboardEvent('keydown', {
      key: 'Backspace',
      repeat: true,
      bubbles: true,
      cancelable: true,
    }),
  );
  await expect.element(korean).toBeInTheDocument();
  await userEvent.keyboard('{Backspace}');
  await expect.element(korean).not.toBeInTheDocument();
  await expect.element(input).toHaveFocus();
});

it('keeps the pending input available when adding it would exceed the limit', async () => {
  renderForm(Array.from({ length: 10 }, (_, index) => `tag${index}`).join(','));
  const input = page.getByRole('textbox', { name: '태그', exact: true });
  await input.fill('extra');
  await userEvent.keyboard('{Enter}');
  await expect
    .element(page.getByText('태그는 최대 10개까지 추가할 수 있습니다.'))
    .toBeInTheDocument();
  await expect.element(input).toHaveValue('extra');
  await expect
    .element(page.getByRole('button', { name: '태그 extra 제거' }))
    .not.toBeInTheDocument();
});

it('includes valid pending tags on submit and keeps invalid pending input', async () => {
  renderForm();
  const input = page.getByRole('textbox', { name: '태그', exact: true });
  const submit = page.getByRole('button', { name: '초안 생성' });
  const form = (submit.element() as HTMLButtonElement).form!;
  const sent: FormDataEntryValue[] = [];
  form.addEventListener('submit', event => {
    if (!event.defaultPrevented) {
      const field = new FormData(form).get('tags');
      if (field !== null) sent.push(field);
    }
    event.preventDefault();
  });

  await input.fill('Preview');
  await submit.click();
  expect(sent).toEqual(['preview']);
  await input.fill('PREVIEW');
  await submit.click();
  expect(sent).toEqual(['preview']);
  await expect.element(input).toHaveValue('PREVIEW');
  await expect.element(input).toHaveFocus();
  await expect
    .element(page.getByText('중복된 태그를 제거해 주세요.'))
    .toBeInTheDocument();
});
