import {
  OpenApiGeneratorV31,
  type OpenAPIRegistry,
} from '@asteasolutions/zod-to-openapi';
import { createOpenApiRegistry } from '../registry';

/**
 * Creates a test OpenAPI document using the provided registry function.
 * @param register A function that registers paths and schemas to the OpenAPI registry.
 * @returns The generated OpenAPI document.
 */
export function createTestDocument(
  register: (registry: OpenAPIRegistry) => void,
) {
  const registry = createOpenApiRegistry();

  register(registry);

  return new OpenApiGeneratorV31(registry.definitions).generateDocument({
    openapi: '3.1.0',
    info: {
      title: 'Test API',
      version: '0.1.0',
    },
  });
}
