import {
  contentResponseSchemaObject,
  errorResponseSchemaObject,
  json,
  paginationSchemaObject,
} from '$lib/test/fixtures';
import { createTestDocument } from '$lib/test/helpers';
import { registerSchemas } from '../schemas';
import { registerAdminPaths } from './admin';

describe('[OpenAPI] Admin Paths', () => {
  const document = createTestDocument(registry => {
    registerSchemas(registry);
    registerAdminPaths(registry);
  });

  describe('GET /api/admin/contents', () => {
    it('defines pagination query parameters', () => {
      const parameters =
        document.paths?.['/api/admin/contents']?.get?.parameters;

      expect(parameters).toEqual(
        expect.arrayContaining([
          expect.objectContaining({
            name: 'cursor',
            in: 'query',
          }),
          expect.objectContaining({
            name: 'limit',
            in: 'query',
          }),
        ]),
      );
    });

    it('defines a 200 response', () => {
      expect(
        document.paths?.['/api/admin/contents']?.get?.responses?.[200],
      ).toBeDefined();
    });

    it('defines the paginated content response schema', () => {
      const schema =
        document.paths?.['/api/admin/contents']?.get?.responses?.[200]
          ?.content?.[json]?.schema;

      expect(schema).toMatchObject(paginationSchemaObject);
    });

    it('defines a 400 validation error response', () => {
      expect(
        document.paths?.['/api/admin/contents']?.get?.responses?.[400],
      ).toBeDefined();
    });

    it('defines the validation error response schema', () => {
      const schema =
        document.paths?.['/api/admin/contents']?.get?.responses?.[400]
          ?.content?.[json]?.schema;

      expect(schema).toMatchObject(errorResponseSchemaObject);
    });
  });

  describe('POST /api/admin/contents', () => {
    it('defines the create content request body schema', () => {
      const requestBody =
        document.paths?.['/api/admin/contents']?.post?.requestBody;

      expect(requestBody).toBeDefined();

      if (!requestBody || '$ref' in requestBody) {
        throw new Error('Expected an inline request body.');
      }

      const schema = requestBody.content?.[json]?.schema;

      expect(schema).toMatchObject({
        type: 'object',
        properties: {
          title: {
            type: 'string',
            minLength: 1,
          },
          body: {
            type: 'string',
          },
        },
        required: ['title', 'body'],
      });
    });

    it('defines a 201 response', () => {
      expect(
        document.paths?.['/api/admin/contents']?.post?.responses?.[201],
      ).toBeDefined();
    });

    it('defines the create content response schema', () => {
      const schema =
        document.paths?.['/api/admin/contents']?.post?.responses?.[201]
          ?.content?.[json]?.schema;

      expect(schema).toMatchObject(contentResponseSchemaObject);
    });

    it('defines a 400 validation error response', () => {
      expect(
        document.paths?.['/api/admin/contents']?.post?.responses?.[400],
      ).toBeDefined();
    });

    it('defines the validation error response schema', () => {
      const schema =
        document.paths?.['/api/admin/contents']?.post?.responses?.[400]
          ?.content?.[json]?.schema;

      expect(schema).toMatchObject(errorResponseSchemaObject);
    });
  });

  describe('GET /api/admin/contents/trash', () => {
    it('defines pagination query parameters', () => {
      const parameters =
        document.paths?.['/api/admin/contents/trash']?.get?.parameters;

      expect(parameters).toEqual(
        expect.arrayContaining([
          expect.objectContaining({
            name: 'cursor',
            in: 'query',
          }),
          expect.objectContaining({
            name: 'limit',
            in: 'query',
          }),
        ]),
      );
    });

    it('defines a 200 response', () => {
      expect(
        document.paths?.['/api/admin/contents/trash']?.get?.responses?.[200],
      ).toBeDefined();
    });

    it('defines the paginated trashed content response schema', () => {
      const schema =
        document.paths?.['/api/admin/contents/trash']?.get?.responses?.[200]
          ?.content?.[json]?.schema;

      expect(schema).toMatchObject(paginationSchemaObject);
    });

    it('defines a 400 validation error response', () => {
      expect(
        document.paths?.['/api/admin/contents/trash']?.get?.responses?.[400],
      ).toBeDefined();
    });

    it('defines the validation error response schema', () => {
      const schema =
        document.paths?.['/api/admin/contents/trash']?.get?.responses?.[400]
          ?.content?.[json]?.schema;

      expect(schema).toMatchObject(errorResponseSchemaObject);
    });
  });

  describe('GET /api/admin/contents/:id', () => {
    it('defines an id path parameter', () => {
      const parameters =
        document.paths?.['/api/admin/contents/{id}']?.get?.parameters;

      expect(parameters).toEqual(
        expect.arrayContaining([
          expect.objectContaining({
            name: 'id',
            in: 'path',
            required: true,
          }),
        ]),
      );
    });

    it('defines a 200 response', () => {
      expect(
        document.paths?.['/api/admin/contents/{id}']?.get?.responses?.[200],
      ).toBeDefined();
    });

    it('defines the content response schema', () => {
      const schema =
        document.paths?.['/api/admin/contents/{id}']?.get?.responses?.[200]
          ?.content?.[json]?.schema;

      expect(schema).toMatchObject(contentResponseSchemaObject);
    });

    it('defines a 400 validation error response', () => {
      expect(
        document.paths?.['/api/admin/contents/{id}']?.get?.responses?.[400],
      ).toBeDefined();
    });

    it('defines the validation error response schema', () => {
      const schema =
        document.paths?.['/api/admin/contents/{id}']?.get?.responses?.[400]
          ?.content?.[json]?.schema;

      expect(schema).toMatchObject(errorResponseSchemaObject);
    });

    it('defines a 404 not found error response', () => {
      expect(
        document.paths?.['/api/admin/contents/{id}']?.get?.responses?.[404],
      ).toBeDefined();
    });

    it('defines the not found error response schema', () => {
      const schema =
        document.paths?.['/api/admin/contents/{id}']?.get?.responses?.[404]
          ?.content?.[json]?.schema;

      expect(schema).toMatchObject(errorResponseSchemaObject);
    });
  });

  describe('PATCH /api/admin/contents/:id', () => {
    it('defines an id path parameter', () => {
      const parameters =
        document.paths?.['/api/admin/contents/{id}']?.patch?.parameters;

      expect(parameters).toEqual(
        expect.arrayContaining([
          expect.objectContaining({
            name: 'id',
            in: 'path',
            required: true,
          }),
        ]),
      );
    });

    it('defines the update content request body schema', () => {
      const requestBody =
        document.paths?.['/api/admin/contents/{id}']?.patch?.requestBody;

      expect(requestBody).toBeDefined();

      if (!requestBody || '$ref' in requestBody) {
        throw new Error('Expected an inline request body.');
      }

      const schema = requestBody.content?.[json]?.schema;

      expect(schema).toMatchObject({
        type: 'object',
        properties: {
          title: {
            type: 'string',
            minLength: 1,
          },
          body: {
            type: 'string',
          },
        },
        anyOf: [
          {
            required: ['title'],
          },
          {
            required: ['body'],
          },
        ],
      });
    });

    it('defines a 200 response', () => {
      expect(
        document.paths?.['/api/admin/contents/{id}']?.patch?.responses?.[200],
      ).toBeDefined();
    });

    it('defines the update content response schema', () => {
      const schema =
        document.paths?.['/api/admin/contents/{id}']?.patch?.responses?.[200]
          ?.content?.[json]?.schema;

      expect(schema).toMatchObject(contentResponseSchemaObject);
    });

    it('defines a 400 validation error response', () => {
      expect(
        document.paths?.['/api/admin/contents/{id}']?.patch?.responses?.[400],
      ).toBeDefined();
    });

    it('defines the validation error response schema', () => {
      const schema =
        document.paths?.['/api/admin/contents/{id}']?.patch?.responses?.[400]
          ?.content?.[json]?.schema;

      expect(schema).toMatchObject(errorResponseSchemaObject);
    });

    it('defines a 404 not found error response', () => {
      expect(
        document.paths?.['/api/admin/contents/{id}']?.patch?.responses?.[404],
      ).toBeDefined();
    });

    it('defines the not found error response schema', () => {
      const schema =
        document.paths?.['/api/admin/contents/{id}']?.patch?.responses?.[404]
          ?.content?.[json]?.schema;

      expect(schema).toMatchObject(errorResponseSchemaObject);
    });
  });

  describe('DELETE /api/admin/contents/:id', () => {
    it('defines an id path parameter', () => {
      const parameters =
        document.paths?.['/api/admin/contents/{id}']?.delete?.parameters;

      expect(parameters).toEqual(
        expect.arrayContaining([
          expect.objectContaining({
            name: 'id',
            in: 'path',
            required: true,
          }),
        ]),
      );
    });

    it('defines a 204 response', () => {
      const noContentResponse =
        document.paths?.['/api/admin/contents/{id}']?.delete?.responses?.[204];

      expect(noContentResponse).toBeDefined();
      expect(noContentResponse?.content).toBeUndefined();
    });

    it('defines a 400 validation error response', () => {
      expect(
        document.paths?.['/api/admin/contents/{id}']?.delete?.responses?.[400],
      ).toBeDefined();
    });

    it('defines the validation error response schema', () => {
      const schema =
        document.paths?.['/api/admin/contents/{id}']?.delete?.responses?.[400]
          ?.content?.[json]?.schema;

      expect(schema).toMatchObject(errorResponseSchemaObject);
    });

    it('defines a 404 not found error response', () => {
      expect(
        document.paths?.['/api/admin/contents/{id}']?.delete?.responses?.[404],
      ).toBeDefined();
    });

    it('defines the not found error response schema', () => {
      const schema =
        document.paths?.['/api/admin/contents/{id}']?.delete?.responses?.[404]
          ?.content?.[json]?.schema;

      expect(schema).toMatchObject(errorResponseSchemaObject);
    });
  });

  describe('POST /api/admin/contents/:id/archive', () => {
    it('defines an id path parameter', () => {
      const parameters =
        document.paths?.['/api/admin/contents/{id}/archive']?.post?.parameters;

      expect(parameters).toEqual(
        expect.arrayContaining([
          expect.objectContaining({
            name: 'id',
            in: 'path',
            required: true,
          }),
        ]),
      );
    });

    it('defines a 200 response', () => {
      expect(
        document.paths?.['/api/admin/contents/{id}/archive']?.post
          ?.responses?.[200],
      ).toBeDefined();
    });

    it('defines the content response schema', () => {
      const schema =
        document.paths?.['/api/admin/contents/{id}/archive']?.post
          ?.responses?.[200]?.content?.[json]?.schema;

      expect(schema).toMatchObject(contentResponseSchemaObject);
    });

    it('defines a 400 validation error response', () => {
      expect(
        document.paths?.['/api/admin/contents/{id}/archive']?.post
          ?.responses?.[400],
      ).toBeDefined();
    });

    it('defines the validation error response schema', () => {
      const schema =
        document.paths?.['/api/admin/contents/{id}/archive']?.post
          ?.responses?.[400]?.content?.[json]?.schema;

      expect(schema).toMatchObject(errorResponseSchemaObject);
    });

    it('defines a 404 not found error response', () => {
      expect(
        document.paths?.['/api/admin/contents/{id}/archive']?.post
          ?.responses?.[404],
      ).toBeDefined();
    });

    it('defines the not found error response schema', () => {
      const schema =
        document.paths?.['/api/admin/contents/{id}/archive']?.post
          ?.responses?.[404]?.content?.[json]?.schema;

      expect(schema).toMatchObject(errorResponseSchemaObject);
    });
  });

  describe('POST /api/admin/contents/:id/publish', () => {
    it('defines an id path parameter', () => {
      const parameters =
        document.paths?.['/api/admin/contents/{id}/publish']?.post?.parameters;

      expect(parameters).toEqual(
        expect.arrayContaining([
          expect.objectContaining({
            name: 'id',
            in: 'path',
            required: true,
          }),
        ]),
      );
    });

    it('defines a 200 response', () => {
      expect(
        document.paths?.['/api/admin/contents/{id}/publish']?.post
          ?.responses?.[200],
      ).toBeDefined();
    });

    it('defines the content response schema', () => {
      const schema =
        document.paths?.['/api/admin/contents/{id}/publish']?.post
          ?.responses?.[200]?.content?.[json]?.schema;

      expect(schema).toMatchObject(contentResponseSchemaObject);
    });

    it('defines a 400 validation error response', () => {
      expect(
        document.paths?.['/api/admin/contents/{id}/publish']?.post
          ?.responses?.[400],
      ).toBeDefined();
    });

    it('defines the validation error response schema', () => {
      const schema =
        document.paths?.['/api/admin/contents/{id}/publish']?.post
          ?.responses?.[400]?.content?.[json]?.schema;

      expect(schema).toMatchObject(errorResponseSchemaObject);
    });

    it('defines a 404 not found error response', () => {
      expect(
        document.paths?.['/api/admin/contents/{id}/publish']?.post
          ?.responses?.[404],
      ).toBeDefined();
    });

    it('defines the not found error response schema', () => {
      const schema =
        document.paths?.['/api/admin/contents/{id}/publish']?.post
          ?.responses?.[404]?.content?.[json]?.schema;

      expect(schema).toMatchObject(errorResponseSchemaObject);
    });
  });

  describe('POST /api/admin/contents/:id/restore', () => {
    it('defines an id path parameter', () => {
      const parameters =
        document.paths?.['/api/admin/contents/{id}/restore']?.post?.parameters;

      expect(parameters).toEqual(
        expect.arrayContaining([
          expect.objectContaining({
            name: 'id',
            in: 'path',
            required: true,
          }),
        ]),
      );
    });

    it('defines a 200 response', () => {
      expect(
        document.paths?.['/api/admin/contents/{id}/restore']?.post
          ?.responses?.[200],
      ).toBeDefined();
    });

    it('defines the content response schema', () => {
      const schema =
        document.paths?.['/api/admin/contents/{id}/restore']?.post
          ?.responses?.[200]?.content?.[json]?.schema;

      expect(schema).toMatchObject(contentResponseSchemaObject);
    });

    it('defines a 400 validation error response', () => {
      expect(
        document.paths?.['/api/admin/contents/{id}/restore']?.post
          ?.responses?.[400],
      ).toBeDefined();
    });

    it('defines the validation error response schema', () => {
      const schema =
        document.paths?.['/api/admin/contents/{id}/restore']?.post
          ?.responses?.[400]?.content?.[json]?.schema;

      expect(schema).toMatchObject(errorResponseSchemaObject);
    });

    it('defines a 404 not found error response', () => {
      expect(
        document.paths?.['/api/admin/contents/{id}/restore']?.post
          ?.responses?.[404],
      ).toBeDefined();
    });

    it('defines the not found error response schema', () => {
      const schema =
        document.paths?.['/api/admin/contents/{id}/restore']?.post
          ?.responses?.[404]?.content?.[json]?.schema;

      expect(schema).toMatchObject(errorResponseSchemaObject);
    });
  });
});
