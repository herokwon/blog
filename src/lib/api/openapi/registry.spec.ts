import { OpenAPIRegistry } from '@asteasolutions/zod-to-openapi';
import { createOpenApiRegistry } from './registry';

describe('[OpenAPI] Registry', () => {
  it('creates a new registry for each call', () => {
    const first = createOpenApiRegistry();
    const second = createOpenApiRegistry();

    expect(first).toBeInstanceOf(OpenAPIRegistry);
    expect(second).toBeInstanceOf(OpenAPIRegistry);
    expect(first).not.toBe(second);
    expect(first.definitions).toEqual([]);
    expect(second.definitions).toEqual([]);
  });
});
