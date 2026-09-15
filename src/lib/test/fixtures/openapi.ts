import type { ZodContentObject } from '@asteasolutions/zod-to-openapi';

export const json: keyof ZodContentObject = 'application/json';

export const paginationSchemaObject: object = {
  type: 'object',
  properties: {
    items: {
      type: 'array',
    },
    nextCursor: {
      type: ['string', 'null'],
    },
  },
  required: ['items', 'nextCursor'],
};

export const contentResponseSchemaObject: object = {
  type: 'object',
  properties: {
    id: {
      type: 'string',
      format: 'uuid',
    },
    status: {
      type: 'string',
    },
    slug: {
      type: ['string', 'null'],
    },
    title: {
      type: 'string',
    },
    body: {
      type: 'string',
    },
    createdAt: {
      type: 'string',
      format: 'date-time',
    },
    publishedAt: {
      type: ['string', 'null'],
      format: 'date-time',
    },
    updatedAt: {
      type: 'string',
      format: 'date-time',
    },
    deletedAt: {
      type: ['string', 'null'],
      format: 'date-time',
    },
  },
  required: [
    'id',
    'status',
    'slug',
    'title',
    'body',
    'createdAt',
    'publishedAt',
    'updatedAt',
    'deletedAt',
  ],
};

export const errorResponseSchemaObject: object = {
  type: 'object',
  properties: {
    error: {
      type: 'object',
      properties: {
        code: {
          type: 'string',
        },
        message: {
          type: 'string',
        },
      },
      required: ['code', 'message'],
    },
  },
  required: ['error'],
};
