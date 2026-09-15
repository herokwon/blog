import { createOpenApiRegistry } from '$lib/api/openapi';
import {
  OpenApiGeneratorV31,
  type OpenAPIRegistry,
} from '@asteasolutions/zod-to-openapi';

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
