import rehypeSanitize, { defaultSchema } from 'rehype-sanitize';
import rehypeStringify from 'rehype-stringify';
import remarkGfm from 'remark-gfm';
import remarkParse from 'remark-parse';
import remarkRehype from 'remark-rehype';
import { unified } from 'unified';

import { getPost } from '../db/posts';

const renderer = unified()
  .use(remarkParse)
  .use(remarkGfm)
  .use(remarkRehype, { allowDangerousHtml: false })
  .use(rehypeSanitize, {
    ...defaultSchema,
    // Keep remark-rehype's generated footnote IDs and their links in sync.
    // User-controlled IDs in those footnotes already have a namespace.
    clobber: ['name', 'ariaLabelledBy'],
    attributes: {
      ...defaultSchema.attributes,
      '*': [
        ...(defaultSchema.attributes?.['*'] ?? []).filter(
          attribute => attribute !== 'id',
        ),
        ['id', /^user-content-fn(?:ref)?-/, 'footnote-label'],
      ],
    },
  })
  .use(rehypeStringify)
  .freeze();

export function renderPostMarkdown(markdown: string) {
  return String(renderer.processSync(markdown));
}

export async function getPostDetail(d1: D1Database, id: string) {
  const post = await getPost(d1, id);
  if (!post) return undefined;
  const { body, ...detail } = post;
  return { ...detail, html: renderPostMarkdown(body) };
}
