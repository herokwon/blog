'use client';

import { useState } from 'react';

import { AutoFocusPlugin } from '@lexical/react/LexicalAutoFocusPlugin';
import {
  InitialConfigType,
  LexicalComposer,
} from '@lexical/react/LexicalComposer';
import { ContentEditable } from '@lexical/react/LexicalContentEditable';
import { LexicalErrorBoundary } from '@lexical/react/LexicalErrorBoundary';
import { HistoryPlugin } from '@lexical/react/LexicalHistoryPlugin';
import { RichTextPlugin } from '@lexical/react/LexicalRichTextPlugin';
import { type ElementFormatType, ParagraphNode, TextNode } from 'lexical';

import { constructImportMap, exportMap } from './config';
import { OnChangePlugin } from './plugins/OnChangePlugin';
import { ToolbarPlugin } from './plugins/ToolbarPlugin';
import editorTheme from './theme';

type EditorProps = React.ComponentPropsWithoutRef<'div'> & {
  placeholder?: string;
  onChangeEditorState: React.ComponentProps<typeof OnChangePlugin>['onChange'];
};

const editorConfig = {
  html: {
    export: exportMap,
    import: constructImportMap(),
  },
  namespace: 'Editor',
  nodes: [ParagraphNode, TextNode],
  theme: editorTheme,
  onError(error: Error) {
    throw error;
  },
} satisfies InitialConfigType;

export type Alignment = Exclude<ElementFormatType, 'start' | 'end' | ''>;

export const EditorShell = ({
  placeholder = '텍스트를 입력해 주세요.',
  onChangeEditorState,
  ...props
}: EditorProps) => {
  const [alignment, setAlignment] = useState<Alignment>('left');

  const handleChangeAlignment = (alignment: Alignment) => {
    setAlignment(alignment);
  };

  return (
    <LexicalComposer initialConfig={editorConfig}>
      <div
        {...props}
        data-testid="editor-shell"
        className={`flex w-full flex-col rounded ring-1 ring-slate-200 ${props.className ?? ''}`}
      >
        <ToolbarPlugin onChangeAlignment={handleChangeAlignment} />
        <div
          data-testid="editor-inner"
          className="relative overflow-auto p-4 text-sm"
        >
          <RichTextPlugin
            contentEditable={
              <ContentEditable
                data-testid="editor-content"
                className="outline-none"
                aria-placeholder={placeholder}
                placeholder={
                  <p
                    data-testid="editor-placeholder"
                    className={`pointer-events-none absolute top-0 p-4 opacity-38 ${
                      alignment === 'right'
                        ? 'right-0'
                        : alignment === 'center'
                          ? 'left-1/2 -translate-x-1/2'
                          : 'left-0'
                    }`}
                  >
                    {placeholder}
                  </p>
                }
              />
            }
            ErrorBoundary={LexicalErrorBoundary}
          />
          <HistoryPlugin />
          <AutoFocusPlugin />
          <OnChangePlugin onChange={onChangeEditorState} />
        </div>
      </div>
    </LexicalComposer>
  );
};
