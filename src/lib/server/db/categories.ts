import { asc, eq, sql } from 'drizzle-orm';
import { getDb } from './index.js';
import { categories, posts } from './schema.js';

type CategoryResult =
  | { ok: true; category?: { id: string; name: string } }
  | { ok: false; status: 400 | 404 | 409; message: string };

function validName(name: string) {
  return name.length > 0 && [...name].length <= 20 && !name.includes('\0');
}

const invalid: CategoryResult = {
  ok: false,
  status: 400,
  message: 'Enter a category name of 1–20 characters.',
};
const duplicate: CategoryResult = {
  ok: false,
  status: 409,
  message: 'A category with this name already exists.',
};
const missing: CategoryResult = {
  ok: false,
  status: 404,
  message: 'This category no longer exists. Refresh the list.',
};

export async function listCategories(d1: D1Database, page = 1) {
  const rows = await getDb(d1)
    .select({
      id: categories.id,
      name: categories.name,
      usage: sql<number>`count(${posts.id})`,
    })
    .from(categories)
    .leftJoin(posts, eq(posts.categoryId, categories.id))
    .groupBy(categories.id)
    .orderBy(asc(categories.name), asc(categories.id))
    .limit(21)
    .offset((page - 1) * 20);
  return { categories: rows.slice(0, 20), hasNext: rows.length > 20 };
}

export async function createCategory(
  d1: D1Database,
  input: string,
): Promise<CategoryResult> {
  const name = input.trim();
  if (!validName(name)) return invalid;
  const rows = await getDb(d1)
    .insert(categories)
    .values({ id: crypto.randomUUID(), name })
    .onConflictDoNothing()
    .returning({ id: categories.id, name: categories.name });
  return rows.length ? { ok: true, category: rows[0] } : duplicate;
}

export async function renameCategory(
  d1: D1Database,
  id: string,
  input: string,
): Promise<CategoryResult> {
  const name = input.trim();
  if (!validName(name)) return invalid;
  // Test uniqueness in the write itself: no check/write race or error-string matching.
  const rows = await getDb(d1)
    .update(categories)
    .set({ name })
    .where(
      sql`${categories.id} = ${id} and not exists (select 1 from categories where name = ${name} and id <> ${id})`,
    )
    .returning({ id: categories.id });
  if (rows.length) return { ok: true };
  const existing = await getDb(d1)
    .select({ id: categories.id })
    .from(categories)
    .where(eq(categories.id, id));
  return existing.length ? duplicate : missing;
}

export async function deleteCategory(
  d1: D1Database,
  id: string,
): Promise<CategoryResult> {
  // All statuses and trash count. The FK also protects later concurrent assignments.
  const rows = await getDb(d1)
    .delete(categories)
    .where(
      sql`${categories.id} = ${id} and not exists (select 1 from ${posts} where ${posts.categoryId} = ${id})`,
    )
    .returning({ id: categories.id });
  if (rows.length) return { ok: true };
  const existing = await getDb(d1)
    .select({ id: categories.id })
    .from(categories)
    .where(eq(categories.id, id));
  return existing.length
    ? {
        ok: false,
        status: 409,
        message:
          'This category is used by posts, including drafts, archived posts or trash. Reassign those posts before deleting it.',
      }
    : missing;
}
