import { paginatedResponseSchema, paginationSchema } from './pagination';

import { z } from 'zod';

describe('[Schema] Pagination', () => {
  describe('paginationSchema', () => {
    it('accepts an empty object for the first page', () => {
      expect(paginationSchema.safeParse({}).success).toBe(true);
    });

    it('accepts an opaque cursor', () => {
      expect(
        paginationSchema.safeParse({
          cursor: 'opaque-cursor',
        }).success,
      ).toBe(true);
    });

    it.each([1, 20, 100])('accepts limit %s', limit => {
      expect(paginationSchema.safeParse({ limit }).success).toBe(true);
    });

    it('accepts cursor and limit together', () => {
      expect(
        paginationSchema.safeParse({
          cursor: 'opaque-cursor',
          limit: 20,
        }).success,
      ).toBe(true);
    });

    it.each(['', 123, null, false])('rejects invalid cursor %s', cursor => {
      expect(paginationSchema.safeParse({ cursor }).success).toBe(false);
    });

    it.each([0, -1, 1.5, '20', null])('rejects invalid limit %s', limit => {
      expect(
        paginationSchema.safeParse({
          limit,
        }).success,
      ).toBe(false);
    });
  });

  describe('paginatedResponseSchema', () => {
    const itemSchema = z.object({
      id: z.string(),
    });

    const schema = paginatedResponseSchema(itemSchema);

    it('accepts an empty item list without a next cursor', () => {
      expect(
        schema.safeParse({
          items: [],
          nextCursor: null,
        }).success,
      ).toBe(true);
    });

    it('accepts items with a next cursor', () => {
      expect(
        schema.safeParse({
          items: [{ id: '1' }, { id: '2' }],
          nextCursor: 'opaque-cursor',
        }).success,
      ).toBe(true);
    });

    it('rejects an invalid item', () => {
      expect(
        schema.safeParse({
          items: [{ id: 123 }],
          nextCursor: null,
        }).success,
      ).toBe(false);
    });

    it.each([
      {
        items: [],
      },
      {
        items: [],
        nextCursor: 123,
      },
      {
        items: {},
        nextCursor: null,
      },
      {
        items: null,
        nextCursor: null,
      },
    ])('rejects an invalid response: %o', response => {
      expect(schema.safeParse(response).success).toBe(false);
    });
  });
});
