import {
  contentIdParamsSchema,
  contentResponseSchema,
  contentSchema,
  createContentRequestSchema,
  errorResponseSchema,
  paginatedResponseSchema,
  paginationSchema,
  updateContentRequestSchema,
} from '$lib/api/schemas';
import type {
  OpenAPIRegistry,
  ZodContentObject,
} from '@asteasolutions/zod-to-openapi';

const json: keyof ZodContentObject = 'application/json';

/**
 * Registers the OpenAPI paths for the admin API.
 * @param registry - The OpenAPI registry to register the paths with.
 */
export function registerAdminPaths(registry: OpenAPIRegistry): void {
  registry.registerPath({
    method: 'get',
    path: '/api/admin/contents',
    request: {
      query: paginationSchema,
    },
    responses: {
      200: {
        description: 'Paginated list of content items',
        content: {
          [json]: {
            schema: paginatedResponseSchema(contentSchema),
          },
        },
      },
      400: {
        description: 'Validation error response',
        content: {
          [json]: {
            schema: errorResponseSchema,
          },
        },
      },
    },
  });

  registry.registerPath({
    method: 'post',
    path: '/api/admin/contents',
    request: {
      body: {
        required: true,
        content: {
          [json]: {
            schema: createContentRequestSchema,
          },
        },
      },
    },
    responses: {
      201: {
        description: 'Content created successfully',
        content: {
          [json]: {
            schema: contentResponseSchema,
          },
        },
      },
      400: {
        description: 'Validation error response',
        content: {
          [json]: {
            schema: errorResponseSchema,
          },
        },
      },
    },
  });

  registry.registerPath({
    method: 'get',
    path: '/api/admin/contents/trash',
    request: {
      query: paginationSchema,
    },
    responses: {
      200: {
        description: 'List of trashed content items',
        content: {
          [json]: {
            schema: paginatedResponseSchema(contentSchema),
          },
        },
      },
      400: {
        description: 'Validation error response',
        content: {
          [json]: {
            schema: errorResponseSchema,
          },
        },
      },
    },
  });

  registry.registerPath({
    method: 'get',
    path: '/api/admin/contents/{id}',
    request: {
      params: contentIdParamsSchema,
    },
    responses: {
      200: {
        description: 'Content item retrieved successfully',
        content: {
          [json]: {
            schema: contentResponseSchema,
          },
        },
      },
      400: {
        description: 'Validation error response',
        content: {
          [json]: {
            schema: errorResponseSchema,
          },
        },
      },
      404: {
        description: 'Content not found',
        content: {
          [json]: {
            schema: errorResponseSchema,
          },
        },
      },
    },
  });

  registry.registerPath({
    method: 'patch',
    path: '/api/admin/contents/{id}',
    request: {
      params: contentIdParamsSchema,
      body: {
        required: true,
        content: {
          [json]: {
            schema: updateContentRequestSchema,
          },
        },
      },
    },
    responses: {
      200: {
        description: 'Content item updated successfully',
        content: {
          [json]: {
            schema: contentResponseSchema,
          },
        },
      },
      400: {
        description: 'Validation error response',
        content: {
          [json]: {
            schema: errorResponseSchema,
          },
        },
      },
      404: {
        description: 'Content not found',
        content: {
          [json]: {
            schema: errorResponseSchema,
          },
        },
      },
    },
  });

  registry.registerPath({
    method: 'delete',
    path: '/api/admin/contents/{id}',
    request: {
      params: contentIdParamsSchema,
    },
    responses: {
      204: {
        description: 'Content item deleted successfully',
      },
      400: {
        description: 'Validation error response',
        content: {
          [json]: {
            schema: errorResponseSchema,
          },
        },
      },
      404: {
        description: 'Content not found',
        content: {
          [json]: {
            schema: errorResponseSchema,
          },
        },
      },
    },
  });

  registry.registerPath({
    method: 'post',
    path: '/api/admin/contents/{id}/archive',
    request: {
      params: contentIdParamsSchema,
    },
    responses: {
      200: {
        description: 'Content item archived successfully',
        content: {
          [json]: {
            schema: contentResponseSchema,
          },
        },
      },
      400: {
        description: 'Validation error response',
        content: {
          [json]: {
            schema: errorResponseSchema,
          },
        },
      },
      404: {
        description: 'Content not found',
        content: {
          [json]: {
            schema: errorResponseSchema,
          },
        },
      },
    },
  });

  registry.registerPath({
    method: 'post',
    path: '/api/admin/contents/{id}/publish',
    request: {
      params: contentIdParamsSchema,
    },
    responses: {
      200: {
        description: 'Content item published successfully',
        content: {
          [json]: {
            schema: contentResponseSchema,
          },
        },
      },
      400: {
        description: 'Validation error response',
        content: {
          [json]: {
            schema: errorResponseSchema,
          },
        },
      },
      404: {
        description: 'Content not found',
        content: {
          [json]: {
            schema: errorResponseSchema,
          },
        },
      },
    },
  });

  registry.registerPath({
    method: 'post',
    path: '/api/admin/contents/{id}/restore',
    request: {
      params: contentIdParamsSchema,
    },
    responses: {
      200: {
        description: 'Content item restored successfully',
        content: {
          [json]: {
            schema: contentResponseSchema,
          },
        },
      },
      400: {
        description: 'Validation error response',
        content: {
          [json]: {
            schema: errorResponseSchema,
          },
        },
      },
      404: {
        description: 'Content not found',
        content: {
          [json]: {
            schema: errorResponseSchema,
          },
        },
      },
    },
  });
}
