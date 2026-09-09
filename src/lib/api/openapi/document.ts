import { OpenApiGeneratorV31 } from '@asteasolutions/zod-to-openapi';
import { registerAdminPaths } from './paths/admin';
import { createOpenApiRegistry } from './registry';
import { registerSchemas } from './schemas';

export function generateOpenApiDocument({ version }: { version: string }) {
  const registry = createOpenApiRegistry();

  registerSchemas(registry);
  registerAdminPaths(registry);

  return new OpenApiGeneratorV31(registry.definitions).generateDocument({
    openapi: '3.1.0',
    info: {
      title: 'Blog API',
      version: version,
    },
  });
}
