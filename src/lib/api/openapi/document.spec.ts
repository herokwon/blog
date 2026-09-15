import { generateOpenApiDocument } from './document';

describe('[API/OpenAPI] Document', () => {
  const document = generateOpenApiDocument({
    version: '1.2.3',
  });

  it('generates an OpenAPI 3.1 document', () => {
    expect(document.openapi).toBe('3.1.0');
  });

  it('defines the API title', () => {
    expect(document.info.title).toBe('Blog API');
  });

  it('uses the provided API version', () => {
    expect(document.info.version).toBe('1.2.3');
  });

  it('includes registered paths', () => {
    const paths = document.paths;

    expect(paths).toHaveProperty('/api/admin/contents');
    expect(paths).toHaveProperty('/api/admin/contents/{id}');
  });

  it('includes registered schemas', () => {
    const schemas = document.components?.schemas;

    expect(schemas).toHaveProperty('Content');
    expect(schemas).toHaveProperty('ErrorResponse');
    expect(schemas).toHaveProperty('Pagination');
  });
});
