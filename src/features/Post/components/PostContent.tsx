'use client';

import { editorConfig } from '@/features/Editor';
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

const isValidEditorState = (content: string): boolean => {
  try {
    const parsed = JSON.parse(content);
    return (
      parsed &&
      typeof parsed === 'object' &&
      'root' in parsed &&
      typeof parsed.root === 'object' &&
      'children' in parsed.root &&
      Array.isArray(parsed.root.children) &&
      parsed.root.children.length > 0 &&
      'children' in parsed.root.children[0] &&
      Array.isArray(parsed.root.children[0].children) &&
      parsed.root.children.length > 0
    );
  } catch {
    return false;
  }
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
