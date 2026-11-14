import type { Root } from 'mdast';
import { visit } from 'unist-util-visit';

// Never parse arbitrary HTML: a raw block must contain only allowed break tokens.
export function explicitBreaks() {
  return (tree: Root) => {
    visit(tree, 'html', (node, index, parent) => {
      if (index === undefined || !parent) return;
      const tokens = node.value.match(/<br>|<br\/>|<br \/>/g);
      if (!tokens || node.value.replace(/<br>|<br\/>|<br \/>/g, '').trim())
        return;
      const breaks = tokens.map(() => ({ type: 'break' as const }));
      if (
        ['root', 'blockquote', 'listItem', 'footnoteDefinition'].includes(
          parent.type,
        )
      )
        parent.children[index] = { type: 'paragraph', children: breaks };
      else parent.children.splice(index, 1, ...breaks);
    });
  };
}
