import { OpenAPIRegistry } from '@asteasolutions/zod-to-openapi';

/**
 * Creates a new OpenAPI registry instance.
 * @returns A new OpenAPIRegistry instance.
 */
export function createOpenApiRegistry(): OpenAPIRegistry {
  return new OpenAPIRegistry();
}
