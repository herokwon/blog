import type { Root } from 'mdast';
import rehypeSanitize, { defaultSchema } from 'rehype-sanitize';
import rehypeStringify from 'rehype-stringify';
import remarkGfm from 'remark-gfm';
import remarkParse from 'remark-parse';
import remarkRehype from 'remark-rehype';
import { unified } from 'unified';
import { SKIP, visit } from 'unist-util-visit';
import { explicitBreaks } from '../markdown-breaks.js';

export type TocEntry = { id: string; title: string; depth: number };
type TextNode = {
  type: string;
  value?: string;
  alt?: string | null;
  children?: readonly TextNode[];
};
type HtmlNode =
  | {
      type: 'root' | 'element';
      tagName?: string;
      properties?: Record<string, unknown>;
      children: HtmlNode[];
    }
  | { type: 'text' | 'comment' | 'doctype'; value?: string };
function text(node: TextNode, excludeCode = false): string {
  if (
    excludeCode &&
    ['code', 'inlineCode', 'image', 'imageReference'].includes(node.type)
  )
    return '';
  if (node.type === 'html') return '';
  if (node.type === 'break') return ' ';
  return (
    node.value ??
    node.alt ??
    node.children?.map(child => text(child, excludeCode)).join('') ??
    ''
  );
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
const parser = unified().use(remarkParse).use(remarkGfm).use(explicitBreaks);
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

function describeTree(tree: Root) {
  const paragraphs: string[] = [];
  visit(tree, 'paragraph', node => {
    paragraphs.push(text(node, true));
  });
  return [...paragraphs.join(' ').replace(/\s+/g, ' ').trim()]
    .slice(0, 160)
    .join('');
}
export function summarizeMarkdown(body: string, fallback = '') {
  const processor = parser();
  const tree = processor.parse(body);
  processor.runSync(tree);
  return describeTree(tree) || fallback;
}

export async function renderPostMarkdown(body: string) {
  const toc: TocEntry[] = [];
  let description = '';
  const file = await parser()
    .use(() => (tree: Root) => {
      description = describeTree(tree);
      visit(tree, 'heading', node => {
        if (node.depth < 2) return;
        const entry = {
          id: 'post-heading-' + (toc.length + 1),
          title: text(node).replace(/\s+/g, ' ').trim(),
          depth: node.depth,
        };
        node.data = {
          ...node.data,
          hProperties: { id: entry.id, tabIndex: -1 },
        };
        toc.push(entry);
      });
    })
    // Raw HTML is disabled. The bridge owns the existing footnote ID namespace.
    .use(remarkRehype, {
      allowDangerousHtml: false,
      clobberPrefix: 'user-content-',
    })
    .use(accessibleBlocks)
    .use(rehypeSanitize, { ...defaultSchema, attributes, clobberPrefix: '' })
    .use(rehypeStringify)
    .process(body);
  return { html: String(file), toc, description };
}
export async function renderMarkdown(body: string) {
  return (await renderPostMarkdown(body)).html;
}
