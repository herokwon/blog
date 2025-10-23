import { useEffect } from 'react';

import type { PostRequest } from '@/features/Post';
import { useLexicalComposerContext } from '@lexical/react/LexicalComposerContext';
import type { SerializedEditorState, SerializedLexicalNode } from 'lexical';

type OnChangePluginProps = {
  initialData?: PostRequest['content'];
  onChangeEditorState: (editorState: string) => void;
};

export const OnChangePlugin = ({
  initialData = '',
  onChangeEditorState,
}: OnChangePluginProps) => {
  const [editor] = useLexicalComposerContext();

  useEffect(() => {
    if (initialData.length > 0) {
      try {
        const parsedEditorState = editor.parseEditorState(initialData);
        editor.setEditorState(parsedEditorState);
      } catch (error) {
        console.error('Failed to parse initial data:', error);
      }
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [editor]);

  useEffect(() => {
    return editor.registerUpdateListener(({ editorState }) => {
      const editorStateJSON: SerializedEditorState = editorState.toJSON();
      const firstChild: SerializedLexicalNode =
        editorStateJSON.root.children[0];

      if (!('children' in firstChild) || !Array.isArray(firstChild.children))
        throw new Error('내용을 찾을 수 없습니다.');

      onChangeEditorState(
        firstChild.children.length === 0 ? '' : JSON.stringify(editorStateJSON),
      );
    });
  }, [editor, onChangeEditorState]);

  return null;
};
