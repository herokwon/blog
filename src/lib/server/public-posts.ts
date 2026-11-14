import { and, asc, desc, eq, isNull, sql } from 'drizzle-orm';
import rehypeSanitize, { defaultSchema } from 'rehype-sanitize';
import rehypeStringify from 'rehype-stringify';
import remarkGfm from 'remark-gfm';
import remarkParse from 'remark-parse';
import remarkRehype from 'remark-rehype';
import { unified } from 'unified';
import { explicitBreaks } from '../markdown-breaks.js';
import { getDb } from './db/index.js';
import { categories, posts, postTags } from './db/schema.js';

const published = and(eq(posts.status, 'published'), isNull(posts.deletedAt));
const metadata = {
  title: posts.title,
  slug: sql<string>`${posts.slug}`,
  publishedAt: sql<string>`${posts.publishedAt}`,
  category: categories.name,
};
const renderer = unified()
  .use(remarkParse)
  .use(remarkGfm)
  .use(explicitBreaks)
  // Raw authored HTML remains disabled. The bridge owns the generated ID
  // namespace; applying a second sanitizer prefix would break fragment/ARIA refs.
  .use(remarkRehype, {
    allowDangerousHtml: false,
    clobberPrefix: 'user-content-',
  })
  .use(rehypeSanitize, { ...defaultSchema, clobberPrefix: '' })
  .use(rehypeStringify);

export async function renderMarkdown(body: string) {
  return String(await renderer.process(body));
}

export async function listPublicPosts(d1: D1Database, page = 1) {
  const rows = await getDb(d1)
    .select(metadata)
    .from(posts)
    .innerJoin(categories, eq(posts.categoryId, categories.id))
    .where(published)
    .orderBy(desc(posts.publishedAt), desc(posts.id))
    .limit(21)
    .offset((page - 1) * 20);
  return { posts: rows.slice(0, 20), hasNext: rows.length > 20 };
}

export async function getPublicPost(d1: D1Database, slug: string) {
  const db = getDb(d1);
  const [rows, names] = await db.batch([
    db
      .select({ ...metadata, body: posts.body })
      .from(posts)
      .innerJoin(categories, eq(posts.categoryId, categories.id))
      .where(and(published, eq(posts.slug, slug)))
      .limit(1),
    db
      .select({ name: postTags.name })
      .from(postTags)
      .innerJoin(posts, eq(postTags.postId, posts.id))
      .where(and(published, eq(posts.slug, slug)))
      .orderBy(asc(postTags.position)),
  ]);
  return rows[0] ? { ...rows[0], tags: names.map(tag => tag.name) } : null;
}
