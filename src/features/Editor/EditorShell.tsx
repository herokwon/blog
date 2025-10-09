'use client';

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
import editorTheme from './theme';

type EditorProps = React.ComponentPropsWithoutRef<'div'> & {
  placeholder?: string;
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
  ...props
}: EditorProps) => {
  return (
    <LexicalComposer initialConfig={editorConfig}>
      <div
        {...props}
        className={`w-full rounded-md ring-1 ring-slate-200 ${props.className ?? ''}`}
      >
        <div className="relative p-4 text-sm">
          <RichTextPlugin
            contentEditable={
              <ContentEditable
                className="outline-none"
                aria-placeholder={placeholder}
                placeholder={
                  <p className="pointer-events-none absolute top-0 left-0 p-4 opacity-38">
                    {placeholder}
                  </p>
                }
              />
            }
            ErrorBoundary={LexicalErrorBoundary}
          />
          <HistoryPlugin />
          <AutoFocusPlugin />
        </div>
      </div>
    </LexicalComposer>
  );
};
