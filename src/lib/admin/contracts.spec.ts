import { describe, expect, it } from 'vitest';
import {
  adminListQuerySchema,
  adminPostPageSchema,
  adminPostSchema,
  apiErrorResponseSchema,
  createPostSchema,
  patchPostSchema,
  postIdSchema,
  revisionSchema,
  trashListQuerySchema,
  validationDetails,
} from './contracts';

const id = '019a0000-0000-7000-8000-000000000001';
const timestamp = '2026-10-07T00:00:00.000Z';
const post = {
  id,
  title: 'A',
  body: ' ',
  status: 'draft',
  slug: null,
  revision: 1,
  created_at: timestamp,
  updated_at: timestamp,
  published_at: null,
  deleted_at: null,
};

describe('Admin request contracts', () => {
  it('preserves title and raw Markdown whitespace', () => {
    expect(createPostSchema.parse({ title: ' A ', body: ' \n\t' })).toEqual({
      title: ' A ',
      body: ' \n\t',
    });
  });
  it.each(['', ' ', '\n\t'])('rejects whitespace-only title %j', title => {
    expect(createPostSchema.safeParse({ title, body: ' ' }).success).toBe(
      false,
    );
  });
  it('rejects empty body but accepts whitespace', () => {
    expect(createPostSchema.safeParse({ title: 'A', body: '' }).success).toBe(
      false,
    );
    expect(createPostSchema.safeParse({ title: 'A', body: ' ' }).success).toBe(
      true,
    );
  });
  it.each(['id', 'status', 'slug', 'revision', 'created_at', 'deleted_at'])(
    'rejects client-managed %s',
    field => {
      const result = createPostSchema.safeParse({
        title: 'A',
        body: 'B',
        [field]: 'forbidden',
      });
      expect(result.success).toBe(false);
      if (!result.success)
        expect(validationDetails(result.error)).toContainEqual({
          path: [field],
          message: 'This field is not allowed.',
        });
    },
  );
  it('requires PATCH editable fields and keeps omitted body absent', () => {
    expect(patchPostSchema.safeParse({ expected_revision: 1 }).success).toBe(
      false,
    );
    expect(patchPostSchema.parse({ expected_revision: 1, title: 'A' })).toEqual(
      { expected_revision: 1, title: 'A' },
    );
    expect(patchPostSchema.parse({ expected_revision: 1, body: ' ' })).toEqual({
      expected_revision: 1,
      body: ' ',
    });
    expect(
      patchPostSchema.safeParse({ expected_revision: 1, title: undefined })
        .success,
    ).toBe(false);
    expect(
      patchPostSchema.safeParse({
        expected_revision: 1,
        title: 'A',
        status: 'published',
      }).success,
    ).toBe(false);
  });
  it.each([undefined, 0, -1, 1.2, '1', Number.MAX_SAFE_INTEGER + 1])(
    'rejects revision %j',
    expected_revision => {
      expect(revisionSchema.safeParse({ expected_revision }).success).toBe(
        false,
      );
    },
  );
  it('accepts a revision-only command and rejects extra fields', () => {
    expect(revisionSchema.parse({ expected_revision: 1 })).toEqual({
      expected_revision: 1,
    });
    expect(
      revisionSchema.safeParse({ expected_revision: 1, body: 'B' }).success,
    ).toBe(false);
  });
  it.each([
    'trash',
    'bad',
    '019a0000-0000-4000-8000-000000000001',
    '019a0000-0000-7000-0000-000000000001',
  ])('rejects non-v7 ID %s', value => {
    expect(postIdSchema.safeParse(value).success).toBe(false);
  });
  it('accepts a UUIDv7 path ID', () => expect(postIdSchema.parse(id)).toBe(id));
  it('defaults pagination and parses safe decimal query strings', () => {
    expect(adminListQuerySchema.parse({})).toEqual({ page: 1, limit: 20 });
    expect(
      adminListQuerySchema.parse({
        page: '2',
        limit: '100',
        status: 'archived',
      }),
    ).toEqual({ page: 2, limit: 100, status: 'archived' });
  });
  it.each([
    { page: '0' },
    { page: '-1' },
    { page: '1.5' },
    { page: '' },
    { page: '1e2' },
    { page: ' 2' },
    { page: true },
    { limit: '101' },
    { limit: '0' },
    { status: 'All' },
    { cursor: 'x' },
    { page: '9007199254740992' },
    { page: '9007199254740991', limit: '2' },
  ])('rejects invalid pagination %j', query => {
    expect(adminListQuerySchema.safeParse(query).success).toBe(false);
  });
  it('accepts the safe offset boundary without rounding', () => {
    expect(
      adminListQuerySchema.parse({ page: '9007199254740991', limit: '1' }).page,
    ).toBe(Number.MAX_SAFE_INTEGER);
  });
  it('does not accept a status filter on trash', () => {
    expect(trashListQuerySchema.safeParse({ status: 'draft' }).success).toBe(
      false,
    );
    expect(trashListQuerySchema.parse({ page: '3' })).toEqual({
      page: 3,
      limit: 20,
    });
  });
});

describe('Admin response contracts', () => {
  it('returns detail directly and requires explicit nullable fields', () => {
    expect(adminPostSchema.parse(post)).toEqual(post);
    const missing: Partial<typeof post> = { ...post };
    delete missing.slug;
    expect(adminPostSchema.safeParse(missing).success).toBe(false);
    expect(adminPostSchema.safeParse({ data: post }).success).toBe(false);
    expect(
      adminPostSchema.safeParse({ ...post, summary: 'unexpected' }).success,
    ).toBe(false);
  });
  it.each([
    '2026-10-07T00:00:00Z',
    '2026-10-07T00:00:00.000+00:00',
    '2026-02-30T00:00:00.000Z',
  ])('rejects noncanonical timestamp %s', created_at => {
    expect(adminPostSchema.safeParse({ ...post, created_at }).success).toBe(
      false,
    );
  });
  it('represents empty and beyond-end lists and rejects leaked bodies/cursors', () => {
    expect(
      adminPostPageSchema.parse({
        items: [],
        page: 1,
        limit: 20,
        totalItems: 0,
        totalPages: 0,
      }).totalPages,
    ).toBe(0);
    expect(
      adminPostPageSchema.parse({
        items: [],
        page: 5,
        limit: 20,
        totalItems: 1,
        totalPages: 1,
      }).page,
    ).toBe(5);
    expect(
      adminPostPageSchema.safeParse({
        items: [post],
        page: 1,
        limit: 20,
        totalItems: 1,
        totalPages: 1,
      }).success,
    ).toBe(false);
    expect(
      adminPostPageSchema.safeParse({
        items: [],
        page: 1,
        limit: 20,
        totalItems: 0,
        totalPages: 0,
        nextCursor: null,
      }).success,
    ).toBe(false);
  });
  it('uses the shared error code list with safe field paths', () => {
    expect(
      apiErrorResponseSchema.parse({
        error: { code: 'POST_VERSION_CONFLICT', message: 'Conflict' },
      }).error.code,
    ).toBe('POST_VERSION_CONFLICT');
    expect(
      apiErrorResponseSchema.safeParse({
        error: { code: 'UNKNOWN', message: 'Failure' },
      }).success,
    ).toBe(false);
    expect(
      apiErrorResponseSchema.safeParse({
        error: {
          code: 'VALIDATION_ERROR',
          message: 'Invalid',
          details: [{ path: ['items', 0, 'title'], message: 'Required' }],
        },
      }).success,
    ).toBe(true);
    expect(
      apiErrorResponseSchema.safeParse({
        error: { code: 'INTERNAL_ERROR', message: 'Failure', stack: 'secret' },
      }).success,
    ).toBe(false);
  });
});
