import { describe, expect, it } from 'vitest';

import { hasContentProperty, hasTitleProperty, isPostInput } from './utils';

describe('[Functions] API Utilities', () => {
  describe('hasTitleProperty', () => {
    it.each([
      null,
      undefined,
      42,
      'string',
      {},
      { content: 'hello' },
      { title: '' },
      { title: '   ' },
      { title: 123 },
    ])('returns false for %o', value => {
      expect(hasTitleProperty(value)).toBe(false);
    });

    it('returns true for valid title', () => {
      expect(hasTitleProperty({ title: 'hello' })).toBe(true);
    });
  });

  describe('hasContentProperty', () => {
    it.each([
      null,
      undefined,
      42,
      'string',
      {},
      { title: 'hello' },
      { content: '' },
      { content: '   ' },
      { content: 123 },
    ])('returns false for %o', value => {
      expect(hasContentProperty(value)).toBe(false);
    });

    it('returns true for valid content', () => {
      expect(hasContentProperty({ content: 'hello' })).toBe(true);
    });
  });

  describe('isPostInput', () => {
    it.each([
      null,
      undefined,
      {},
      { title: 'hello' },
      { content: 'world' },
      { title: '', content: 'world' },
      { title: 'hello', content: '' },
    ])('returns false for %o', value => {
      expect(isPostInput(value)).toBe(false);
    });

    it('returns true for valid PostInput', () => {
      expect(isPostInput({ title: 'hello', content: 'world' })).toBe(true);
    });
  });
});
