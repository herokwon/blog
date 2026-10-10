import {
  parse,
  serialize,
  Tokenizer,
  type DefaultTreeAdapterTypes,
  type Token,
} from 'parse5';
import { isAllowedLink } from './policy';

const tags = new Set([
  'html',
  'head',
  'body',
  'p',
  'br',
  'strong',
  'b',
  'em',
  'i',
  'del',
  's',
  'ul',
  'ol',
  'li',
  'blockquote',
  'hr',
  'a',
  'pre',
  'code',
  'table',
  'thead',
  'tbody',
  'tr',
  'th',
  'td',
  'h1',
  'h2',
  'h3',
  'h4',
  'h5',
  'h6',
  'span',
]);

function allowedAttribute(tag: string, name: string, value: string): boolean {
  if (tag === 'a' && name === 'href') return isAllowedLink(value);
  if (tag === 'a' && name === 'title') return true;
  if (/^h[1-6]$/.test(tag) && name === 'id') return true;
  if (tag === 'pre' && name === 'data-language') return /^[\w+-]*$/.test(value);
  if (tag === 'tr' && name === 'data-is-header')
    return ['true', 'false'].includes(value);
  if (['th', 'td'].includes(tag) && name === 'style')
    return /^text-align:\s*(left|center|right);?$/.test(value);
  if (tag === 'code' && name === 'class')
    return /^language-[\w+-]+$/.test(value);
  if (tag === 'ol' && name === 'start') return /^\d{1,9}$/.test(value);
  if (['th', 'td'].includes(tag) && ['colspan', 'rowspan'].includes(name))
    return /^[1-9]\d{0,2}$/.test(value);
  if (['th', 'td'].includes(tag) && name === 'align')
    return ['left', 'center', 'right'].includes(value);
  // Slice metadata is checked, then omitted from the canonical HTML. The
  // editor derives a fresh slice from validated content, without trusting
  // clipboard-supplied schema node names or attributes.
  if (name === 'data-pm-slice' && !['html', 'head', 'body'].includes(tag)) {
    const match = /^\d{1,3} \d{1,3}(?: -\d{1,3})? (\[.*\])$/.exec(value);
    if (!match) return false;
    try {
      return Array.isArray(JSON.parse(match[1]));
    } catch {
      return false;
    }
  }
  return false;
}

/** Validate without creating browser DOM; return only the validated body. */
export function validatedTransferHtml(html: string): string | null {
  try {
    return parseTransferHtml(html);
  } catch {
    // Parsing/serialization failures must block the transfer, rather than
    // letting an exception in a capture listener fall through to the editor.
    return null;
  }
}

function parseTransferHtml(html: string): string | null {
  let malformed = false;
  const sourceTags: string[] = [];
  const inspectTag = (token: Token.TagToken) => {
    if (
      !tags.has(token.tagName) ||
      token.attrs.some(
        attr => !allowedAttribute(token.tagName, attr.name, attr.value),
      )
    )
      malformed = true;
    if (token.location)
      sourceTags.push(
        `${token.location.startOffset}:${token.location.endOffset}`,
      );
  };
  // Validate lexical tags as well as the tree. Tree construction silently
  // discards some tags and can merge text locations across discarded tokens.
  // All permitted elements use HTML's DATA tokenization mode; raw-text and
  // foreign-content elements are rejected before tree construction.
  new Tokenizer(
    { sourceCodeLocationInfo: true },
    {
      onStartTag: inspectTag,
      onEndTag: inspectTag,
      onComment() {},
      onDoctype() {},
      onEof() {},
      onCharacter() {},
      onWhitespaceCharacter() {},
      onNullCharacter() {
        malformed = true;
      },
      onParseError() {
        malformed = true;
      },
    },
  ).write(html, true);
  if (malformed) return null;
  const doc = parse(html, {
    sourceCodeLocationInfo: true,
    onParseError(error) {
      if (error.code !== 'missing-doctype') malformed = true;
    },
  });
  if (malformed) return null;
  const representedTags = new Set<string>();
  const pending: DefaultTreeAdapterTypes.Node[] = [doc];
  let body: DefaultTreeAdapterTypes.Element | undefined;
  while (pending.length) {
    const node = pending.pop()!;
    if ('tagName' in node) {
      if (
        node.namespaceURI !== 'http://www.w3.org/1999/xhtml' ||
        !tags.has(node.tagName)
      )
        return null;
      for (const attr of node.attrs) {
        if (
          attr.namespace ||
          attr.prefix ||
          !allowedAttribute(node.tagName, attr.name, attr.value)
        )
          return null;
      }
      node.attrs = node.attrs.filter(
        attr => !['data-pm-slice', 'id'].includes(attr.name),
      );
      if (node.tagName === 'body') body = node;
      const loc = node.sourceCodeLocation;
      for (const tag of [loc?.startTag, loc?.endTag])
        if (tag) representedTags.add(`${tag.startOffset}:${tag.endOffset}`);
    }
    if ('childNodes' in node)
      for (const child of node.childNodes) pending.push(child);
  }
  // HTML parsing can silently discard tokens (e.g. <frame> or stray table
  // cells). Reject unrepresented source, so mixed unsupported content never
  // becomes an accepted partial paste.
  if (sourceTags.some(tag => !representedTags.has(tag)) || !body) return null;
  return serialize(body);
}
