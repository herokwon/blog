import { describe, expect, it } from 'vitest';
import { pageAfterMutation, pageNumbers } from './pagination';

describe('fixed pagination groups', () => {
  it.each([
    [1, 12, [1, 2, 3, 4, 5]],
    [5, 12, [1, 2, 3, 4, 5]],
    [6, 12, [6, 7, 8, 9, 10]],
    [10, 12, [6, 7, 8, 9, 10]],
    [11, 12, [11, 12]],
    [12, 12, [11, 12]],
    [1, 0, []],
    [1, 1, [1]],
  ])('page %i of %i shows %j', (page, total, expected) => {
    expect(pageNumbers(page, total)).toEqual(expected);
  });
  it.each([
    [3, 2, 2],
    [2, 3, 2],
    [3, 0, 1],
    [1, 1, 1],
  ])(
    'page %i after mutation with %i pages becomes %i',
    (page, total, expected) => {
      expect(pageAfterMutation(page, total)).toBe(expected);
    },
  );
});
