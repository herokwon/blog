import {
  ERROR_CODES,
  errorCodeSchema,
  errorResponseSchema,
  validationIssueSchema,
  type ValidationIssue,
} from './error';

describe('[API/Schema] Error', () => {
  describe('errorCodeSchema', () => {
    it.each(ERROR_CODES)('accepts %s', errorCode => {
      expect(errorCodeSchema.safeParse(errorCode).success).toBe(true);
    });

    it.each(['', 'UNKNOWN_ERROR', 'VALIDATION', 'validation_error', 123, null])(
      'rejects %s',
      errorCode => {
        expect(errorCodeSchema.safeParse(errorCode).success).toBe(false);
      },
    );
  });

  describe('validationIssueSchema', () => {
    it('accepts a field validation issue', () => {
      expect(
        validationIssueSchema.safeParse({
          path: ['title'],
          message: 'Title is required.',
        } satisfies ValidationIssue).success,
      ).toBe(true);
    });

    it('accepts a nested validation path', () => {
      expect(
        validationIssueSchema.safeParse({
          path: ['items', 0, 'title'],
          message: 'Title is required.',
        }).success,
      ).toBe(true);
    });

    it.each([
      {
        path: ['title'],
        message: '',
      },
      {
        path: ['title', true],
        message: 'Invalid path',
      },
      {
        path: ['title'],
        message: 123,
      },
    ])('rejects invalid issue: %o', issue => {
      expect(validationIssueSchema.safeParse(issue).success).toBe(false);
    });
  });

  describe('errorResponseSchema', () => {
    it('accepts an error without details', () => {
      expect(
        errorResponseSchema.safeParse({
          error: {
            code: 'CONTENT_NOT_FOUND',
            message: 'Content not found.',
          },
        }).success,
      ).toBe(true);
    });

    it('accepts an error with validation details', () => {
      expect(
        errorResponseSchema.safeParse({
          error: {
            code: 'VALIDATION_ERROR',
            message: 'Request validation failed.',
            details: [
              {
                path: ['title'],
                message: 'Title is required.',
              },
            ],
          },
        }).success,
      ).toBe(true);
    });

    it('rejects an invalid error code', () => {
      expect(
        errorResponseSchema.safeParse({
          error: {
            code: 'UNKNOWN_ERROR',
            message: 'Something went wrong.',
          },
        }).success,
      ).toBe(false);
    });

    it('rejects invalid validation details', () => {
      expect(
        errorResponseSchema.safeParse({
          error: {
            code: 'VALIDATION_ERROR',
            message: 'Request validation failed.',
            details: [
              {
                path: ['title'],
                message: 123,
              },
            ],
          },
        }).success,
      ).toBe(false);
    });
  });
});
