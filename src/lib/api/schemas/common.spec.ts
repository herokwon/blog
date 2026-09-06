import {
  contentIdParamsSchema,
  contentIdSchema,
  contentStatusSchema,
  slugSchema,
  timestampSchema,
} from './common';

describe('[Schema] Common', () => {
  describe('contentStatusSchema', () => {
    it.each(['draft', 'published', 'archived'])('accepts %s', status => {
      expect(contentStatusSchema.safeParse(status).success).toBe(true);
    });

    it.each(['', 'Draft', 'published ', 'deleted', 'unknown'])(
      'rejects %s',
      status => {
        expect(contentStatusSchema.safeParse(status).success).toBe(false);
      },
    );
  });

  describe('contentIdSchema', () => {
    it('accepts a valid UUIDv7', () => {
      expect(
        contentIdSchema.safeParse('0191c13d-8000-7a2b-8123-456789abcdef')
          .success,
      ).toBe(true);
    });

    it.each([
      '',
      '0191c13d-8000-7a2b-8123-456789abcde',
      '0191c13d-8000-7a2b-8123-456789abcdefg',
      'not-a-uuid',
      123,
      null,
    ])('rejects %s', id => {
      expect(contentIdSchema.safeParse(id).success).toBe(false);
    });
  });

  describe('contentIdParamsSchema', () => {
    it('accepts a valid content ID parameter', () => {
      expect(
        contentIdParamsSchema.safeParse({
          id: '0191c13d-8000-7a2b-8123-456789abcdef',
        }).success,
      ).toBe(true);
    });

    it.each([{ id: '' }, { id: 'not-a-uuid' }])('rejects %s', params => {
      expect(contentIdParamsSchema.safeParse(params).success).toBe(false);
    });
  });

  describe('slugSchema', () => {
    it.each(['hello-world', 'hello', 'hello-2', '안녕하세요', 'hello+world'])(
      'accepts %s',
      slug => {
        expect(slugSchema.safeParse(slug).success).toBe(true);
      },
    );

    it.each(['', null, undefined, 123, false])('rejects %s', slug => {
      expect(slugSchema.safeParse(slug).success).toBe(false);
    });
  });

  describe('timestampSchema', () => {
    it.each([
      '2026-09-05T00:00:00Z',
      '2026-09-05T00:00:00.000Z',
      '2026-09-05T12:34:56.789Z',
    ])('accepts %s', timestamp => {
      expect(timestampSchema.safeParse(timestamp).success).toBe(true);
    });

    it.each([
      '',
      '2026-09-05',
      '2026-09-05 00:00:00',
      '2026-09-05T00:00:00',
      'not-a-timestamp',
      123,
      null,
    ])('rejects %s', timestamp => {
      expect(timestampSchema.safeParse(timestamp).success).toBe(false);
    });
  });
});
