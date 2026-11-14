import type { Root } from 'mdast';
import type { Processor } from 'unified';
import { SKIP, visit } from 'unist-util-visit';

// Permit exact leading break tokens. Preserve following indentation and let the
// active Markdown parser handle the remainder, with arbitrary HTML still disabled.
export function explicitBreaks(this: Processor) {
  return (tree: Root) => {
    visit(tree, 'html', (node, index, parent) => {
      if (index === undefined || !parent) return;
      let followingSource = node.value.trimStart();
      const breaks: { type: 'break' }[] = [];
      for (;;) {
        const token = followingSource.match(
          /^(?:<br>|<br\/>|<br \/>)(?:[ \t]*(?:\r?\n|$))?/,
        )?.[0];
        if (!token) break;
        breaks.push({ type: 'break' });
        followingSource = followingSource.slice(token.length);
      }
      if (!breaks.length) return;
      if (
        ['root', 'blockquote', 'listItem', 'footnoteDefinition'].includes(
          parent.type,
        )
      ) {
        const following = this.parse(followingSource) as Root;
        parent.children.splice(
          index,
          1,
          { type: 'paragraph', children: breaks },
          ...following.children,
        );
      } else parent.children.splice(index, 1, ...breaks);
      return [SKIP, index];
    });
  };
}
