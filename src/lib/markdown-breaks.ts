import type { Root, RootContent } from 'mdast';
import type { Processor } from 'unified';
import { SKIP, visit } from 'unist-util-visit';

// Permit exact leading break tokens. Preserve following indentation and let the
// active Markdown parser handle the remainder, with arbitrary HTML still disabled.
export function explicitBreaks(
  this: Processor,
  options: { preserveEmptyParagraphs?: boolean } = {},
) {
  return (tree: Root) => {
    const definitions: string[] = [];
    visit(tree, ['definition', 'footnoteDefinition'], node => {
      if (node.type !== 'definition' && node.type !== 'footnoteDefinition')
        return;
      // Identifiers retain Markdown escapes and are already normalized by the
      // parser. These stubs enable reference recognition; they never enter the
      // returned tree, where the original URLs and note content remain intact.
      definitions.push(
        node.type === 'definition'
          ? `[${node.identifier}]: /__markdown_reference_context__`
          : `[^${node.identifier}]: context`,
      );
    });
    const context = definitions.length ? definitions.join('\n\n') + '\n\n' : '';
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
        const following = this.parse(context + followingSource) as Root;
        // Milkdown's native empty-line plugin must see HTML placeholders so its
        // serializer preserves blank paragraphs instead of trimming lone breaks.
        const prefix: RootContent[] = options.preserveEmptyParagraphs
          ? breaks.map(() => ({ type: 'html', value: '<br />' }))
          : [{ type: 'paragraph', children: breaks }];
        parent.children.splice(
          index,
          1,
          ...prefix,
          ...following.children.slice(definitions.length),
        );
        return [SKIP, index + prefix.length];
      } else parent.children.splice(index, 1, ...breaks);
      return [SKIP, index + breaks.length];
    });
  };
}
