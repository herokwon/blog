'use client';

import { editorConfig, isValidEditorState } from '@/features/Editor';
import {
  type InitialConfigType,
  LexicalComposer,
} from '@lexical/react/LexicalComposer';
import { ContentEditable } from '@lexical/react/LexicalContentEditable';
import { LexicalErrorBoundary } from '@lexical/react/LexicalErrorBoundary';
import { RichTextPlugin } from '@lexical/react/LexicalRichTextPlugin';

type PostContentProps = {
  content: string;
};

export const PostContent = ({ content }: PostContentProps) => {
  const viewerConfig: InitialConfigType = {
    ...editorConfig,
    namespace: 'Viewer',
    editable: false,
    editorState: isValidEditorState(content) ? content : null,
  };

  return (
    <LexicalComposer initialConfig={viewerConfig}>
      <RichTextPlugin
        contentEditable={
          <ContentEditable
            data-testid="viewer-content"
            readOnly
            className="outline-none"
          />
        }
        ErrorBoundary={LexicalErrorBoundary}
      />
    </LexicalComposer>
  );
};
