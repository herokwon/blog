import type {
  Content,
  contentSchema,
  PaginatedResponse,
  Pagination,
} from '$lib/api/schemas';
import { and, desc, eq, isNotNull, isNull, lt, or } from 'drizzle-orm';
import type { getDb } from '../db';
import { content } from '../db/schema';

const encodeCursor = (createdAt: string, id: string) =>
  btoa(JSON.stringify({ createdAt, id }))
    .replace(/\+/g, '-')
    .replace(/\//g, '_')
    .replace(/=+$/, '');

const decodeCursor = (cursor: string) => {
  const base64 = cursor.replace(/-/g, '+').replace(/_/g, '/');

  return JSON.parse(atob(base64)) as {
    createdAt: string;
    id: string;
  };
};

export class ContentRepository {
  constructor(private readonly db: ReturnType<typeof getDb>) {}

  async findById(id: string): Promise<Content | null> {
    const result = await this.db
      .select()
      .from(content)
      .where(eq(content.id, id))
      .limit(1);

    return result[0] ?? null;
  }

  async findBySlug(slug: string): Promise<Content | null> {
    const result = await this.db
      .select()
      .from(content)
      .where(eq(content.slug, slug))
      .limit(1);

    return result[0] ?? null;
  }

  async findMany(
    input: Required<Pick<Pagination, 'limit'>> & Pick<Pagination, 'cursor'>,
  ): Promise<PaginatedResponse<typeof contentSchema>> {
    const cursor = input.cursor ? decodeCursor(input.cursor) : undefined;

    const items = await this.db
      .select()
      .from(content)
      .where(
        and(
          isNull(content.deletedAt),
          cursor
            ? or(
                lt(content.createdAt, cursor.createdAt),
                and(
                  eq(content.createdAt, cursor.createdAt),
                  lt(content.id, cursor.id),
                ),
              )
            : undefined,
        ),
      )
      .orderBy(desc(content.createdAt), desc(content.id))
      .limit(input.limit + 1);

    const hasNextPage = items.length > input.limit;
    const pageItems = hasNextPage ? items.slice(0, input.limit) : items;
    const lastItem = pageItems.at(-1);

    return {
      items: pageItems,
      nextCursor:
        hasNextPage && lastItem
          ? encodeCursor(lastItem.createdAt, lastItem.id)
          : null,
    };
  }

  async findTrash(
    input: Required<Pick<Pagination, 'limit'>> & Pick<Pagination, 'cursor'>,
  ): Promise<PaginatedResponse<typeof contentSchema>> {
    const cursor = input.cursor ? decodeCursor(input.cursor) : undefined;

    const items = await this.db
      .select()
      .from(content)
      .where(
        and(
          isNotNull(content.deletedAt),
          cursor
            ? or(
                lt(content.createdAt, cursor.createdAt),
                and(
                  eq(content.createdAt, cursor.createdAt),
                  lt(content.id, cursor.id),
                ),
              )
            : undefined,
        ),
      )
      .orderBy(desc(content.deletedAt), desc(content.id))
      .limit(input.limit + 1);

    const hasNextPage = items.length > input.limit;
    const pageItems = hasNextPage ? items.slice(0, input.limit) : items;
    const lastItem = pageItems.at(-1);

    return {
      items: pageItems,
      nextCursor:
        hasNextPage && lastItem
          ? encodeCursor(lastItem.createdAt, lastItem.id)
          : null,
    };
  }

  async create(input: Content): Promise<Content> {
    const [result] = await this.db.insert(content).values(input).returning();
    return result;
  }

  async update(id: string, input: Partial<Content>): Promise<Content | null> {
    const [result] = await this.db
      .update(content)
      .set(input)
      .where(eq(content.id, id))
      .returning();

    return result ?? null;
  }

  async softDelete(
    id: string,
    deletedAt: NonNullable<Content['deletedAt']>,
  ): Promise<Content | null> {
    const [result] = await this.db
      .update(content)
      .set({
        deletedAt,
        updatedAt: deletedAt,
      })
      .where(eq(content.id, id))
      .returning();

    return result ?? null;
  }

  async restore(
    id: string,
    restoredAt: Content['updatedAt'],
  ): Promise<Content | null> {
    const [result] = await this.db
      .update(content)
      .set({
        deletedAt: null,
        updatedAt: restoredAt,
      })
      .where(eq(content.id, id))
      .returning();

    return result ?? null;
  }
}
