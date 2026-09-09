import type { OpenAPIRegistry } from '@asteasolutions/zod-to-openapi';
import {
  contentIdParamsSchema,
  contentIdSchema,
  contentResponseSchema,
  contentSchema,
  contentStatusSchema,
  createContentRequestSchema,
  errorCodeSchema,
  errorResponseSchema,
  paginationSchema,
  slugSchema,
  timestampSchema,
  updateContentRequestSchema,
  validationIssueSchema,
} from '../schemas';

/**
 * Registers the OpenAPI schemas for the API.
 * @param registry - The OpenAPI registry to register the schemas with.
 */
export function registerSchemas(registry: OpenAPIRegistry): void {
  // content schemas
  registry.register('Content', contentSchema);
  registry.register('CreateContentRequest', createContentRequestSchema);
  registry.register('UpdateContentRequest', updateContentRequestSchema);
  registry.register('ContentResponse', contentResponseSchema);

  // common schemas
  registry.register('ContentStatus', contentStatusSchema);
  registry.register('ContentId', contentIdSchema);
  registry.register('ContentIdParams', contentIdParamsSchema);
  registry.register('Slug', slugSchema);
  registry.register('Timestamp', timestampSchema);

  // error
  registry.register('ErrorCode', errorCodeSchema);
  registry.register('ValidationIssue', validationIssueSchema);
  registry.register('ErrorResponse', errorResponseSchema);

  // pagination
  registry.register('Pagination', paginationSchema);
}
