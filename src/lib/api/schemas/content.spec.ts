import {
  contentResponseSchema,
  contentSchema,
  createContentRequestSchema,
  updateContentRequestSchema,
} from './content';

const validContent = {
  id: '0191c13d-8000-7a2b-8123-456789abcdef',
  title: 'Hello World',
  body: '# Hello World',
  status: 'draft',
  slug: null,
  createdAt: '2026-09-05T00:00:00Z',
  publishedAt: null,
  updatedAt: '2026-09-05T00:00:00Z',
  deletedAt: null,
};

describe('[Schema] Content', () => {
  describe('contentSchema', () => {
    it('accepts a valid draft content', () => {
      expect(contentSchema.safeParse(validContent).success).toBe(true);
    });

    it('accepts a published content', () => {
      expect(
        contentSchema.safeParse({
          ...validContent,
          status: 'published',
          slug: 'hello-world',
          publishedAt: '2026-09-05T00:00:00Z',
        }).success,
      ).toBe(true);
    });

    it('accepts an archived content', () => {
      expect(
        contentSchema.safeParse({
          ...validContent,
          status: 'archived',
          slug: 'hello-world',
          publishedAt: '2026-09-05T00:00:00Z',
        }).success,
      ).toBe(true);
    });

    it('rejects an invalid content id', () => {
      expect(
        contentSchema.safeParse({
          ...validContent,
          id: 'invalid-id',
        }).success,
      ).toBe(false);
    });

    it('rejects an invalid content status', () => {
      expect(
        contentSchema.safeParse({
          ...validContent,
          status: 'invalid',
        }).success,
      ).toBe(false);
    });

    it('rejects an invalid slug', () => {
      expect(
        contentSchema.safeParse({
          ...validContent,
          slug: '',
        }).success,
      ).toBe(false);
    });

    it('rejects an invalid timestamp', () => {
      expect(
        contentSchema.safeParse({
          ...validContent,
          createdAt: 'invalid-timestamp',
        }).success,
      ).toBe(false);
    });
  });

  describe('createContentRequestSchema', () => {
    it('accepts a valid create request', () => {
      expect(
        createContentRequestSchema.safeParse({
          title: validContent.title,
          body: validContent.body,
        }).success,
      ).toBe(true);
    });

    it('accepts a valid create request with whitespace in the title', () => {
      const result = createContentRequestSchema.safeParse({
        title: `  ${validContent.title}  `,
        body: validContent.body,
      });

      expect(result.success).toBe(true);

      if (result.success) {
        expect(result.data.title).toBe(validContent.title);
      }
    });

    it('rejects an empty title', () => {
      expect(
        createContentRequestSchema.safeParse({
          title: '',
          body: validContent.body,
        }).success,
      ).toBe(false);
    });

    it('rejects a whitespce-only title', () => {
      expect(
        createContentRequestSchema.safeParse({
          title: '   ',
          body: validContent.body,
        }).success,
      ).toBe(false);
    });

    it('rejects an empty body', () => {
      expect(
        createContentRequestSchema.safeParse({
          title: validContent.title,
          body: '',
        }).success,
      ).toBe(false);
    });

    it('rejects a whitespace-only body', () => {
      expect(
        createContentRequestSchema.safeParse({
          title: validContent.title,
          body: '   ',
        }).success,
      ).toBe(false);
    });

    it('rejects the status field', () => {
      expect(
        createContentRequestSchema.safeParse({
          title: validContent.title,
          body: validContent.body,
          status: 'draft',
        }).success,
      ).toBe(false);
    });

    it('rejects unknown fields', () => {
      expect(
        createContentRequestSchema.safeParse({
          title: validContent.title,
          body: validContent.body,
          unknown: 'value',
        }).success,
      ).toBe(false);
    });
  });

  describe('updateContentRequestSchema', () => {
    it('accepts a title-only update', () => {
      expect(
        updateContentRequestSchema.safeParse({
          title: 'Updated title',
        }).success,
      ).toBe(true);
    });

    it('accepts a title-only update with whitespace in the title', () => {
      const result = updateContentRequestSchema.safeParse({
        title: '  Updated title  ',
      });

      expect(result.success).toBe(true);

      if (result.success) {
        expect(result.data.title).toBe('Updated title');
      }
    });

    it('accepts a body-only update', () => {
      expect(
        updateContentRequestSchema.safeParse({
          body: '# Updated body',
        }).success,
      ).toBe(true);
    });

    it('accepts a title-and-body update', () => {
      expect(
        updateContentRequestSchema.safeParse({
          title: 'Updated title',
          body: '# Updated body',
        }).success,
      ).toBe(true);
    });

    it('rejects an empty update request', () => {
      expect(updateContentRequestSchema.safeParse({}).success).toBe(false);
    });

    it('rejects an empty title', () => {
      expect(
        updateContentRequestSchema.safeParse({
          title: '',
        }).success,
      ).toBe(false);
    });

    it('rejects a whitespace-only title', () => {
      expect(
        updateContentRequestSchema.safeParse({
          title: '   ',
        }).success,
      ).toBe(false);
    });

    it('rejects an empty body', () => {
      expect(
        updateContentRequestSchema.safeParse({
          body: '',
        }).success,
      ).toBe(false);
    });

    it('rejects a whitespace-only body', () => {
      expect(
        updateContentRequestSchema.safeParse({
          body: '   ',
        }).success,
      ).toBe(false);
    });

    it('rejects the status field', () => {
      expect(
        updateContentRequestSchema.safeParse({
          status: 'published',
        }).success,
      ).toBe(false);
    });

    it('rejects unknown fields', () => {
      expect(
        updateContentRequestSchema.safeParse({
          title: 'Updated title',
          unknown: 'value',
        }).success,
      ).toBe(false);
    });
  });

  describe('contentResponseSchema', () => {
    it('accepts a valid content response', () => {
      expect(contentResponseSchema.safeParse(validContent).success).toBe(true);
    });

    it('rejects an invalid content response', () => {
      expect(
        contentResponseSchema.safeParse({
          ...validContent,
          status: 'invalid',
        }).success,
      ).toBe(false);
    });
  });
});
