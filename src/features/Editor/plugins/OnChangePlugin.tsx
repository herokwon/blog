import { useEffect } from 'react';

import { useLexicalComposerContext } from '@lexical/react/LexicalComposerContext';
import type { SerializedEditorState, SerializedLexicalNode } from 'lexical';

export const OnChangePlugin = ({
  onChange,
}: {
  onChange: (editorState: string) => void;
}) => {
  const [editor] = useLexicalComposerContext();

  useEffect(() => {
    return editor.registerUpdateListener(({ editorState }) => {
      const editorStateJSON: SerializedEditorState = editorState.toJSON();
      const firstChild: SerializedLexicalNode =
        editorStateJSON.root.children[0];

      if (!('children' in firstChild) || !Array.isArray(firstChild.children))
        throw new Error('내용을 찾을 수 없습니다.');

      onChange(
        firstChild.children.length === 0 ? '' : JSON.stringify(editorStateJSON),
      );
    });
  }, [editor, onChange]);

  return null;
};
