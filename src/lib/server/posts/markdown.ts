import rehypeSanitize, { defaultSchema } from 'rehype-sanitize';
import rehypeStringify from 'rehype-stringify';
import remarkGfm from 'remark-gfm';
import remarkParse from 'remark-parse';
import remarkRehype from 'remark-rehype';
import { unified } from 'unified';

import { getPost } from '../db/posts';

const sanitizedMarkdown = unified()
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
  .freeze();

const renderer = sanitizedMarkdown().use(rehypeStringify).freeze();

type HtmlRoot = Parameters<ReturnType<typeof rehypeSanitize>>[0];
type ArticleNode = HtmlRoot | HtmlRoot['children'][number];

function formatPublicArticle() {
  return (root: HtmlRoot) => {
    function hasLevelOneHeading(node: ArticleNode): boolean {
      return (
        (node.type === 'element' && node.tagName === 'h1') ||
        ('children' in node && node.children.some(hasLevelOneHeading))
      );
    }

    const shiftHeadings = hasLevelOneHeading(root);

    function format(node: ArticleNode): void {
      if (node.type === 'element') {
        if (shiftHeadings && /^h[1-5]$/.test(node.tagName)) {
          node.tagName = `h${Number(node.tagName.charAt(1)) + 1}`;
        }
        if (node.tagName === 'pre') {
          node.properties.tabIndex = 0;
          node.properties.role = 'region';
          node.properties.ariaLabel = '코드 블록';
        }
      }
      if (!('children' in node)) return;
      for (const [index, child] of node.children.entries()) {
        format(child);
        if (child.type === 'element' && child.tagName === 'table') {
          node.children[index] = {
            type: 'element',
            tagName: 'div',
            properties: {
              className: ['article-table'],
              role: 'region',
              tabIndex: 0,
              ariaLabel: '표',
            },
            children: [child],
          };
        }
      }
    }
    format(root);
  };
}

const publicRenderer = sanitizedMarkdown()
  .use(formatPublicArticle)
  .use(rehypeStringify)
  .freeze();

export function renderPostMarkdown(markdown: string) {
  return String(renderer.processSync(markdown));
}

export function renderPublicPostMarkdown(markdown: string) {
  return String(publicRenderer.processSync(markdown));
}

export async function getPostDetail(d1: D1Database, id: string) {
  const post = await getPost(d1, id);
  if (!post) return undefined;
  const { body, ...detail } = post;
  return { ...detail, html: renderPostMarkdown(body) };
}
