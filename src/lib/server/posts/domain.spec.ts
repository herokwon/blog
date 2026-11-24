import { describe, expect, it } from 'vitest';

import { resolvePostStatus, validatePostContent } from './domain';

describe('post lifecycle', () => {
  it('allows the agreed creation and transition states', () => {
    expect(resolvePostStatus(null, 'save')).toBe('draft');
    expect(resolvePostStatus(null, 'publish')).toBe('published');
    expect(resolvePostStatus('draft', 'publish')).toBe('published');
    expect(resolvePostStatus('published', 'archive')).toBe('archived');
    expect(resolvePostStatus('archived', 'publish')).toBe('published');
    expect(resolvePostStatus('archived', 'save')).toBe('archived');
    expect(resolvePostStatus(null, 'archive')).toBeNull();
    expect(resolvePostStatus('draft', 'archive')).toBeNull();
    expect(resolvePostStatus('published', 'publish')).toBeNull();
    expect(resolvePostStatus('archived', 'archive')).toBeNull();
  });
});

describe('post validation', () => {
  it('normalizes titles and tags while preserving Markdown', () => {
    const body = '  # 본문\n\n';
    expect(
      validatePostContent(
        {
          title: ' 제목 ',
          body,
          categoryId: 1,
          tags: [' Svelte ', '한글', '2026'],
        },
        'published',
      ),
    ).toEqual({
      valid: true,
      content: {
        title: '제목',
        body,
        categoryId: 1,
        tags: ['svelte', '한글', '2026'],
      },
    });
  });

  it('permits an empty draft body and rejects empty published or archived bodies', () => {
    const input = { title: 'Post', body: ' \n', categoryId: 1, tags: [] };
    expect(validatePostContent(input, 'draft').valid).toBe(true);
    for (const status of ['published', 'archived'] as const) {
      expect(validatePostContent(input, status)).toMatchObject({
        valid: false,
        errors: { body: 'required' },
      });
    }
  });

  it('rejects an invalid category, invalid tags, duplicates, and oversized text', () => {
    const input = {
      title: 'x'.repeat(201),
      body: '한'.repeat(90_000),
      categoryId: 0,
    };
    expect(
      validatePostContent({ ...input, tags: ['Svelte', 'svelte'] }, 'draft'),
    ).toEqual({
      valid: false,
      errors: {
        title: 'tooLong',
        body: 'tooLong',
        categoryId: 'required',
        tags: 'duplicate',
      },
    });
    expect(
      validatePostContent({ ...input, tags: ['two words'] }, 'draft'),
    ).toMatchObject({ valid: false, errors: { tags: 'invalid' } });
  });
});
