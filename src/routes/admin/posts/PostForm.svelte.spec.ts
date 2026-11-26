import { render } from 'vitest-browser-svelte';
import { page, userEvent } from 'vitest/browser';

import PostForm from './PostForm.svelte';

const tagPrompt = '태그를 입력해 주세요. (최대 10개)';
const tagTrigger = page.getByRole('button', { name: tagPrompt, exact: true });
const addTag = page.getByRole('button', { name: '태그 추가', exact: true });
const tagInput = page.getByRole('textbox', { name: '태그', exact: true });

function renderForm(tags = '', body = '') {
  render(PostForm, {
    creating: true,
    categories: [{ id: 1, name: '개발' }],
    values: { id: 'test', title: 'Draft', body, categoryId: '1', tags },
  });
}

it('commits tag chips without interrupting IME and removes the focused chip with Backspace', async () => {
  renderForm();
  const input = tagInput;
  await expect.element(input).not.toBeInTheDocument();
  await expect.element(page.getByText('0/10개', { exact: true })).toBeVisible();
  (tagTrigger.element() as HTMLButtonElement).focus();
  await userEvent.keyboard('{Enter}');
  await expect.element(input).toHaveFocus();
  await expect.element(tagTrigger).not.toBeInTheDocument();
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

it('shows the tag prompt only when the inactive area has no confirmed tags', async () => {
  renderForm('existing');
  const title = page.getByRole('textbox', { name: '제목 (필수)' });
  await expect.element(page.getByText('1/10개', { exact: true })).toBeVisible();
  expect(page.getByText(tagPrompt, { exact: true }).elements()).toHaveLength(0);
  await addTag.click();
  await expect.element(tagInput).toHaveFocus();
  await title.click();
  await expect.element(tagTrigger).not.toBeInTheDocument();
  await expect.element(tagInput).not.toBeInTheDocument();
  await addTag.click();
  await tagInput.fill('한글태그');
  await title.click();
  await expect.element(title).toHaveFocus();
  await expect.element(tagTrigger).not.toBeInTheDocument();
  await expect
    .element(page.getByRole('button', { name: '태그 한글태그 제거' }))
    .toBeVisible();
  await expect.element(page.getByText('2/10개', { exact: true })).toBeVisible();
  await addTag.click();
  await tagInput.fill('한글태그');
  await title.click();
  await expect.element(title).toHaveFocus();
  await expect.element(tagInput).toHaveValue('한글태그');
  await expect
    .element(page.getByText('중복된 태그를 제거해 주세요.'))
    .toBeVisible();
  await tagInput.fill('');
  await title.click();
  await page.getByRole('button', { name: '태그 existing 제거' }).click();
  await expect.element(tagTrigger).not.toBeInTheDocument();
  await page.getByRole('button', { name: '태그 한글태그 제거' }).click();
  await expect.element(tagTrigger).toBeVisible();
  await expect.element(page.getByText('0/10개', { exact: true })).toBeVisible();
});

it('loads stored Markdown into Crepe and submits the latest edit', async () => {
  const original = '## 저장된 제목\n\n본문\n\n';
  renderForm('', original);
  const editor = page.getByRole('textbox', {
    name: '본문 (Markdown)',
    exact: true,
  });
  await expect.element(editor).toHaveAttribute('contenteditable', 'true');
  await expect
    .element(editor.getByRole('heading', { name: '저장된 제목' }))
    .toBeInTheDocument();
  await page.getByText('본문 (Markdown)', { exact: true }).click();
  await expect.element(editor).toHaveFocus();
  const submit = page.getByRole('button', { name: '초안 생성' });
  const form = (submit.element() as HTMLButtonElement).form!;
  expect(new FormData(form).get('body')).toBe(original);
  let body: FormDataEntryValue | null | undefined;
  form.addEventListener('submit', event => {
    event.preventDefault();
    body = new FormData(form).get('body');
  });
  await editor.fill('Updated body');
  await submit.click();
  expect(String(body).trim()).toBe('## Updated body');
});

it('keeps the pending input available when adding it would exceed the limit', async () => {
  renderForm(Array.from({ length: 10 }, (_, index) => `tag${index}`).join(','));
  const input = tagInput;
  await addTag.click();
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
  const input = tagInput;
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

  await tagTrigger.click();
  await input.fill('Preview');
  form.requestSubmit();
  expect(sent).toEqual(['preview']);
  await input.fill('PREVIEW');
  form.requestSubmit();
  expect(sent).toEqual(['preview']);
  await expect.element(input).toHaveValue('PREVIEW');
  await expect.element(input).toHaveFocus();
  await expect
    .element(page.getByText('중복된 태그를 제거해 주세요.'))
    .toBeInTheDocument();
});
