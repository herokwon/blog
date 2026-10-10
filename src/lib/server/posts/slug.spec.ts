import { describe, expect, it } from 'vitest';
import { normalizeSlug, slugCandidate } from './slug';

describe('publication slug normalization', () => {
  it.each([
    ['Hello World', 'hello-world'],
    ['Svelte_Kit 시작하기', 'svelte-kit-시작하기'],
    ['  Hello -- World  ', 'hello-world'],
    ['API/설계', 'api설계'],
    ['C++ 시작하기', 'c++-시작하기'],
    ['Cafe\u0301 \u1100\u1161', 'café-가'],
    ['Ä Z Α', 'Ä-z-Α'],
    ['A\tB\nC_ D?!#😀', 'a-b-c-d'],
    ['a\u0338 𐐀 １２', 'a-𐐀-１２'],
    [' /😀?___ ', ''],
  ])('normalizes %j to %j', (title, expected) => {
    expect(normalizeSlug(title)).toBe(expected);
  });
  it('truncates by code points while reserving the complete suffix', () => {
    const base = '𐐀'.repeat(101);
    expect(slugCandidate(base, 1)).toBe('𐐀'.repeat(100));
    expect(slugCandidate(base, 2)).toBe('𐐀'.repeat(98) + '-2');
    expect(slugCandidate(base, 100)).toBe('𐐀'.repeat(96) + '-100');
  });
  it('trims hyphens exposed by truncation without discarding the suffix', () => {
    expect(slugCandidate('a'.repeat(97) + '-bc', 2)).toBe(
      'a'.repeat(97) + '-2',
    );
    expect(slugCandidate('a'.repeat(99) + '-bc', 1)).toBe('a'.repeat(99));
    expect(slugCandidate('short', 3)).toBe('short-3');
  });
});
