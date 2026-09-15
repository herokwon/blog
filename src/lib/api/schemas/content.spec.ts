import { createTestContent } from '$lib/test/fixtures';
import {
  contentResponseSchema,
  contentSchema,
  createContentRequestSchema,
  updateContentRequestSchema,
} from './content';

const testContentTimestamp = '2026-01-01T00:00:00Z';
const testContent = createTestContent({
  id: '0198f7b1-1234-7abc-8def-123456789abc',
  title: 'Hello World',
  body: '# Hello World',
  createdAt: testContentTimestamp,
  updatedAt: testContentTimestamp,
});

describe('[API/Schema] Content', () => {
  describe('contentSchema', () => {
    it('accepts a valid draft content', () => {
      expect(contentSchema.safeParse(testContent).success).toBe(true);
    });

    it('accepts a published content', () => {
      expect(
        contentSchema.safeParse({
          ...testContent,
          status: 'published',
          slug: 'hello-world',
          publishedAt: testContentTimestamp,
        }).success,
      ).toBe(true);
    });

    it('accepts an archived content', () => {
      expect(
        contentSchema.safeParse({
          ...testContent,
          status: 'archived',
          slug: 'hello-world',
          publishedAt: testContentTimestamp,
        }).success,
      ).toBe(true);
    });

    it('rejects an invalid content id', () => {
      expect(
        contentSchema.safeParse({
          ...testContent,
          id: 'invalid-id',
        }).success,
      ).toBe(false);
    });

    it('rejects an invalid content status', () => {
      expect(
        contentSchema.safeParse({
          ...testContent,
          status: 'invalid',
        }).success,
      ).toBe(false);
    });

    it('rejects an invalid slug', () => {
      expect(
        contentSchema.safeParse({
          ...testContent,
          slug: '',
        }).success,
      ).toBe(false);
    });

    it('rejects an invalid timestamp', () => {
      expect(
        contentSchema.safeParse({
          ...testContent,
          createdAt: 'invalid-timestamp',
        }).success,
      ).toBe(false);
    });
  });

  describe('createContentRequestSchema', () => {
    it('accepts a valid create request', () => {
      expect(
        createContentRequestSchema.safeParse({
          title: testContent.title,
          body: testContent.body,
        }).success,
      ).toBe(true);
    });

    it('accepts a valid create request with whitespace in the title', () => {
      const result = createContentRequestSchema.safeParse({
        title: `  ${testContent.title}  `,
        body: testContent.body,
      });

      expect(result.success).toBe(true);

      if (result.success) {
        expect(result.data.title).toBe(testContent.title);
      }
    });

    it('rejects an empty title', () => {
      expect(
        createContentRequestSchema.safeParse({
          title: '',
          body: testContent.body,
        }).success,
      ).toBe(false);
    });

    it('rejects a whitespce-only title', () => {
      expect(
        createContentRequestSchema.safeParse({
          title: '   ',
          body: testContent.body,
        }).success,
      ).toBe(false);
    });

    it('rejects an empty body', () => {
      expect(
        createContentRequestSchema.safeParse({
          title: testContent.title,
          body: '',
        }).success,
      ).toBe(false);
    });

    it('rejects a whitespace-only body', () => {
      expect(
        createContentRequestSchema.safeParse({
          title: testContent.title,
          body: '   ',
        }).success,
      ).toBe(false);
    });

    it('rejects the status field', () => {
      expect(
        createContentRequestSchema.safeParse({
          title: testContent.title,
          body: testContent.body,
          status: 'draft',
        }).success,
      ).toBe(false);
    });

    it('rejects unknown fields', () => {
      expect(
        createContentRequestSchema.safeParse({
          title: testContent.title,
          body: testContent.body,
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
      expect(contentResponseSchema.safeParse(testContent).success).toBe(true);
    });

    it('rejects an invalid content response', () => {
      expect(
        contentResponseSchema.safeParse({
          ...testContent,
          status: 'invalid',
        }).success,
      ).toBe(false);
    });
  });
});
