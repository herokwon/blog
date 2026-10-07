import remarkGfm from 'remark-gfm';
import remarkParse from 'remark-parse';
import remarkStringify from 'remark-stringify';
import { unified } from 'unified';

const parser = unified().use(remarkParse).use(remarkGfm).use(remarkStringify);

type MarkdownNode = {
  type: string;
  url?: string;
  title?: string | null;
  identifier?: string;
  children?: MarkdownNode[];
};

function referenceDefinitions(tree: MarkdownNode): Map<string, MarkdownNode> {
  const definitions = new Map<string, MarkdownNode>();
  function collect(node: MarkdownNode) {
    if (
      node.type === 'definition' &&
      node.identifier &&
      !definitions.has(node.identifier)
    )
      definitions.set(node.identifier, node);
    node.children?.forEach(collect);
  }
  collect(tree);
  return definitions;
}

export function isAllowedLink(url: string): boolean {
  // Reject browser-normalized whitespace/backslashes before parsing.
  // eslint-disable-next-line no-control-regex -- Reject URL parser-stripped controls.
  if (!url || /[\s\u0000-\u001f\u007f\\]/u.test(url)) return false;
  if (url.startsWith('#')) return true;
  if (url.startsWith('/')) return !url.startsWith('//');
  if (!/^(https?:\/\/|mailto:)/i.test(url)) return false;
  try {
    return ['http:', 'https:', 'mailto:'].includes(new URL(url).protocol);
  } catch {
    return false;
  }
}

/** A display-only Markdown projection; never persisted or used for saving. */
export function readingMarkdown(body: string): string {
  const tree = parser.parse(body);
  const definitions = referenceDefinitions(tree);
  const allowed = new Set([
    'root',
    'heading',
    'paragraph',
    'text',
    'strong',
    'emphasis',
    'delete',
    'inlineCode',
    'code',
    'list',
    'listItem',
    'blockquote',
    'thematicBreak',
    'break',
    'link',
    'linkReference',
    'definition',
    'table',
    'tableRow',
    'tableCell',
  ]);
  // Invalid definitions become plain labels rather than links in Crepe.
  function clean(node: MarkdownNode): MarkdownNode[] {
    if (!allowed.has(node.type)) return [];
    if (node.type === 'definition') return [];
    if (node.children) node.children = node.children.flatMap(clean);
    if (node.type === 'linkReference') {
      const definition = definitions.get(node.identifier ?? '');
      if (!definition?.url || !isAllowedLink(definition.url))
        return node.children ?? [];
      return [
        {
          type: 'link',
          url: definition.url,
          title: definition.title,
          children: node.children,
        },
      ];
    }
    if (node.url !== undefined && !isAllowedLink(node.url))
      return node.children ?? [];
    return [node];
  }
  clean(tree);
  return parser.stringify(tree);
}

export function inspectMarkdown(body: string): {
  supported: boolean;
  reasons: string[];
} {
  const reasons = new Set<string>();
  const tree = parser.parse(body);
  const definitions = referenceDefinitions(tree);
  function visit(node: {
    type: string;
    url?: string;
    identifier?: string;
    children?: typeof tree.children;
  }) {
    if (['image', 'imageReference'].includes(node.type))
      reasons.add('Unsupported images');
    if (node.type === 'html') reasons.add('Unsupported HTML');
    if (node.type.startsWith('footnote')) reasons.add('Unsupported footnotes');
    const url =
      node.type === 'linkReference'
        ? definitions.get(node.identifier ?? '')?.url
        : node.type === 'link'
          ? node.url
          : undefined;
    if (url !== undefined && !isAllowedLink(url))
      reasons.add('Disallowed links');
    node.children?.forEach(visit);
  }
  tree.children.forEach(visit);
  return { supported: reasons.size === 0, reasons: [...reasons] };
}
