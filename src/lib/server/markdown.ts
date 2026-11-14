import rehypeSanitize, { defaultSchema } from 'rehype-sanitize';
import rehypeStringify from 'rehype-stringify';
import remarkGfm from 'remark-gfm';
import remarkParse from 'remark-parse';
import remarkRehype from 'remark-rehype';
import { unified } from 'unified';
import { SKIP, visit } from 'unist-util-visit';
import { explicitBreaks } from '../markdown-breaks.js';

export type TocEntry = { id: string; title: string; depth: number };
type HtmlNode =
  | {
      type: 'root' | 'element';
      tagName?: string;
      properties?: Record<string, unknown>;
      children: HtmlNode[];
    }
  | { type: 'text' | 'comment' | 'doctype'; value?: string };

function htmlText(node: HtmlNode, excludeCode = false): string {
  if (node.type === 'text') return node.value ?? '';
  if (node.type !== 'element' && node.type !== 'root') return '';
  if (node.type === 'element') {
    if (node.tagName === 'br') return ' ';
    if (
      excludeCode &&
      ['code', 'pre', 'img', 'sup'].includes(node.tagName ?? '')
    )
      return '';
    if (
      excludeCode &&
      node.tagName === 'a' &&
      Object.hasOwn(node.properties ?? {}, 'dataFootnoteBackref')
    )
      return '';
    if (node.tagName === 'img')
      return typeof node.properties?.alt === 'string'
        ? node.properties.alt
        : '';
  }
  return node.children.map(child => htmlText(child, excludeCode)).join('');
}
function accessibleBlocks() {
  return (tree: HtmlNode) => {
    visit(tree, (node, index, parent) => {
      if (node.type !== 'element') return;
      if (node.tagName === 'pre')
        node.properties = {
          ...node.properties,
          tabIndex: 0,
          role: 'region',
          ariaLabel: 'Code block',
        };
      if (node.tagName === 'th')
        node.properties = { ...node.properties, scope: 'col' };
      if (node.tagName === 'table' && index !== undefined && parent?.children) {
        parent.children[index] = {
          type: 'element',
          tagName: 'div',
          properties: {
            className: ['reader-table'],
            tabIndex: 0,
            role: 'region',
            ariaLabel: 'Table',
          },
          children: [node],
        };
        visit(node, child => {
          if (child.type === 'element' && child.tagName === 'th')
            child.properties = { ...child.properties, scope: 'col' };
        });
        return SKIP;
      }
    });
  };
}
const attributes = { ...defaultSchema.attributes };
for (const name of ['h2', 'h3', 'h4', 'h5', 'h6'])
  attributes[name] = [...(attributes[name] ?? []), ['tabIndex', -1]];
for (const name of ['pre', 'div'])
  attributes[name] = [
    ...(attributes[name] ?? []),
    'className',
    'tabIndex',
    'role',
    'ariaLabel',
  ];
attributes.th = [...(attributes.th ?? []), 'scope'];

// Derive reader metadata after the bridge has omitted unused footnotes and the
// sanitizer has removed disallowed content. Reuse the same pipeline for RSS.
const safeHtml = unified()
  .use(remarkParse)
  .use(remarkGfm)
  .use(explicitBreaks)
  .use(remarkRehype, {
    allowDangerousHtml: false,
    clobberPrefix: 'user-content-',
  })
  .use(accessibleBlocks)
  .use(rehypeSanitize, { ...defaultSchema, attributes, clobberPrefix: '' });

function describeHtml(tree: HtmlNode) {
  const paragraphs: string[] = [];
  visit(tree, node => {
    if (node.type === 'element' && node.tagName === 'p')
      paragraphs.push(htmlText(node, true));
  });
  return [...paragraphs.join(' ').replace(/\s+/g, ' ').trim()]
    .slice(0, 160)
    .join('');
}
export function summarizeMarkdown(body: string, fallback = '') {
  return (
    describeHtml(safeHtml.runSync(safeHtml.parse(body)) as HtmlNode) || fallback
  );
}
export async function renderPostMarkdown(body: string) {
  const toc: TocEntry[] = [];
  let description = '';
  const file = await safeHtml()
    .use(() => (tree: HtmlNode) => {
      description = describeHtml(tree);
      visit(tree, node => {
        if (node.type !== 'element') return;
        const tag = node.tagName;
        if (
          !tag ||
          !/^h[2-6]$/.test(tag) ||
          node.properties?.id === 'footnote-label'
        )
          return;
        const entry = {
          id: 'post-heading-' + (toc.length + 1),
          title: htmlText(node).replace(/\s+/g, ' ').trim(),
          depth: Number(tag.slice(1)),
        };
        // These IDs and focus values are generated literals, never authored HTML.
        node.properties = { ...node.properties, id: entry.id, tabIndex: -1 };
        toc.push(entry);
      });
    })
    .use(rehypeStringify)
    .process(body);
  return { html: String(file), toc, description };
}
export async function renderMarkdown(body: string) {
  return (await renderPostMarkdown(body)).html;
}
