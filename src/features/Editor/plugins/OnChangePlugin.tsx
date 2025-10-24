import { useCallback, useEffect, useRef } from 'react';

import type { PostRequest } from '@/features/Post';
import { useLexicalComposerContext } from '@lexical/react/LexicalComposerContext';
import type { SerializedEditorState, SerializedLexicalNode } from 'lexical';

type OnChangePluginProps = {
  value?: PostRequest['content'];
  onChangeValue: (editorState: string) => void;
};

export const OnChangePlugin = ({
  value = '',
  onChangeValue,
}: OnChangePluginProps) => {
  const [editor] = useLexicalComposerContext();

  const previousValueRef = useRef<string>('');
  const isUpdatingRef = useRef<boolean>(false);

  const handleChangeEditor = useCallback(
    (newContent: string) => {
      if (newContent !== previousValueRef.current) {
        isUpdatingRef.current = true;
        onChangeValue(newContent);
        previousValueRef.current = newContent;
      }
    },
    [onChangeValue],
  );

  useEffect(() => {
    if (isUpdatingRef.current && value === previousValueRef.current) {
      isUpdatingRef.current = false;
    }
  }, [value]);

  useEffect(() => {
    try {
      if (!isUpdatingRef.current && value !== previousValueRef.current) {
        const parsedEditorState = editor.parseEditorState(value);
        editor.setEditorState(parsedEditorState);
        previousValueRef.current = value;
      }
    } catch (error) {
      console.error('Failed to parse initial data:', error);
    }
  }, [editor, value]);

  useEffect(() => {
    return editor.registerUpdateListener(({ editorState }) => {
      const editorStateJSON: SerializedEditorState = editorState.toJSON();
      const firstChild: SerializedLexicalNode =
        editorStateJSON.root.children[0];

      if (!('children' in firstChild) || !Array.isArray(firstChild.children))
        throw new Error('내용을 찾을 수 없습니다.');

      const newContent =
        firstChild.children.length === 0 ? '' : JSON.stringify(editorStateJSON);
      handleChangeEditor(newContent);
    });
  }, [editor, handleChangeEditor]);

  return null;
};
