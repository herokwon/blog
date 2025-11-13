import type {
  SerializedEditorState,
  SerializedLexicalNode,
  SerializedTextNode,
} from 'lexical';

export const isValidEditorState = (content: string): boolean => {
  return parseEditorState(content) !== null;
};

export const parseEditorState = (
  content: string,
): SerializedEditorState | null => {
  try {
    const parsed = JSON.parse(content);
    return isSerializedEditorState(parsed) ? parsed : null;
  } catch {
    return null;
  }
};

export const extractTextNodes = (content: string): SerializedTextNode[] => {
  const states = parseEditorState(content);
  if (!states) return [];

  const nodes = getChildNodes(states);
  if (!nodes) return [];

  const textNodes: SerializedTextNode[] = [];
  const traverse = (node: SerializedLexicalNode) => {
    if (isTextNode(node)) {
      textNodes.push(node);
    }

    if ('children' in node && Array.isArray(node.children)) {
      node.children.forEach(traverse);
    }
  };

  nodes.forEach(traverse);
  return textNodes;
};

const getChildNodes = (
  state: SerializedEditorState,
): SerializedLexicalNode[] | null => {
  const firstChild = state.root.children[0];

  if (!('children' in firstChild) || !Array.isArray(firstChild.children))
    return null;

  return firstChild.children;
};

const isTextNode = (
  node: SerializedLexicalNode,
): node is SerializedTextNode => {
  return node.type === 'text';
};

const isSerializedEditorState = (
  value: unknown,
): value is SerializedEditorState => {
  if (!value || typeof value !== 'object') return false;

  const state = value as Partial<SerializedEditorState>;

  return (
    'root' in state &&
    state.root !== null &&
    typeof state.root === 'object' &&
    'children' in state.root &&
    Array.isArray(state.root.children) &&
    state.root.children.length > 0 &&
    state.root.children.every(c => isSerializedLexicalNode(c))
  );
};

const isSerializedLexicalNode = (
  value: unknown,
): value is SerializedLexicalNode => {
  if (!value || typeof value !== 'object') return false;

  const node = value as Partial<SerializedLexicalNode>;

  return (
    'type' in node &&
    typeof node.type === 'string' &&
    'version' in node &&
    typeof node.version === 'number'
  );
};
