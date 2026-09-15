import { createTestDocument } from '$lib/test/helpers';
import { registerSchemas } from './schemas';

describe('[API/OpenAPI] Schemas', () => {
  const document = createTestDocument(registerSchemas);

  describe('content schemas', () => {
    it('registers the Content schema', () => {
      expect(document.components?.schemas?.Content).toBeDefined();
    });

    it('registers the CreateContentRequest schema', () => {
      expect(document.components?.schemas?.CreateContentRequest).toBeDefined();
    });

    it('registers the UpdateContentRequest schema', () => {
      expect(document.components?.schemas?.UpdateContentRequest).toBeDefined();
    });

    it('registers the ContentResponse schema', () => {
      expect(document.components?.schemas?.ContentResponse).toBeDefined();
    });
  });

  describe('common schemas', () => {
    it('registers the ContentStatus schema', () => {
      expect(document.components?.schemas?.ContentStatus).toBeDefined();
    });

    it('registers the ContentId schema', () => {
      expect(document.components?.schemas?.ContentId).toBeDefined();
    });

    it('registers the ContentIdParams schema', () => {
      expect(document.components?.schemas?.ContentIdParams).toBeDefined();
    });

    it('registers the Slug schema', () => {
      expect(document.components?.schemas?.Slug).toBeDefined();
    });

    it('registers the Timestamp schema', () => {
      expect(document.components?.schemas?.Timestamp).toBeDefined();
    });
  });

  describe('error schemas', () => {
    it('registers the ErrorCode schema', () => {
      expect(document.components?.schemas?.ErrorCode).toBeDefined();
    });

    it('registers the ValidationIssue schema', () => {
      expect(document.components?.schemas?.ValidationIssue).toBeDefined();
    });

    it('registers the ErrorResponse schema', () => {
      expect(document.components?.schemas?.ErrorResponse).toBeDefined();
    });
  });

  describe('pagination schemas', () => {
    it('registers the Pagination schema', () => {
      expect(document.components?.schemas?.Pagination).toBeDefined();
    });
  });
});
