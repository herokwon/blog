'use client';

import { useCallback, useEffect, useState } from 'react';

import { useLexicalComposerContext } from '@lexical/react/LexicalComposerContext';
import { mergeRegister } from '@lexical/utils';
import {
  $getRoot,
  $getSelection,
  $isRangeSelection,
  CAN_REDO_COMMAND,
  CAN_UNDO_COMMAND,
  COMMAND_PRIORITY_EDITOR,
  COMMAND_PRIORITY_LOW,
  ElementNode,
  FORMAT_ELEMENT_COMMAND,
  FORMAT_TEXT_COMMAND,
  INDENT_CONTENT_COMMAND,
  KEY_TAB_COMMAND,
  OUTDENT_CONTENT_COMMAND,
  REDO_COMMAND,
  SELECTION_CHANGE_COMMAND,
  UNDO_COMMAND,
} from 'lexical';
import {
  AlignCenter,
  AlignJustify,
  AlignLeft,
  AlignRight,
  Bold,
  Code,
  Italic,
  type LucideIcon,
  RotateCcw,
  RotateCw,
  Strikethrough,
  Underline,
} from 'lucide-react';

import type { Alignment } from '../EditorShell';

const ToolbarButton = ({
  icon: Icon,
  ...props
}: Omit<React.ComponentPropsWithoutRef<'button'>, 'children'> & {
  icon: LucideIcon;
}) => {
  return (
    <button
      {...props}
      type="button"
      className={`rounded-md p-2 transition-colors not-disabled:cursor-pointer hover:not-disabled:bg-slate-200 disabled:cursor-not-allowed disabled:opacity-38 disabled:*:pointer-events-none [.active]:not-disabled:bg-slate-200 ${props.className ?? ''}`}
    >
      <Icon size={16} />
    </button>
  );
};

const Divider = () => {
  return <hr className="mx-2 h-4 w-0.25 border-none bg-slate-200" />;
};

export const ToolbarPlugin = ({
  onChangeAlignment,
}: {
  onChangeAlignment: (alignment: Alignment) => void;
}) => {
  const [editor] = useLexicalComposerContext();
  const [canUndo, setCanUndo] = useState<boolean>(false);
  const [canRedo, setCanRedo] = useState<boolean>(false);
  const [isBold, setIsBold] = useState<boolean>(false);
  const [isItalic, setIsItalic] = useState<boolean>(false);
  const [isCode, setIsCode] = useState<boolean>(false);
  const [isUnderline, setIsUnderline] = useState<boolean>(false);
  const [isStrikethrough, setIsStrikethrough] = useState<boolean>(false);
  const [blockAlignment, setBlockAlignment] = useState<Alignment | 'mixed'>(
    'left',
  );

  const collectBlockAlignment = useCallback(() => {
    const selection = $getSelection();
    if (!$isRangeSelection(selection)) {
      setBlockAlignment('left');
      return;
    }

    const nodes = selection.getNodes();
    const seen = new Set<string>();
    const alignments = new Set<string>();

    for (const node of nodes) {
      const topLevelElement = node.getTopLevelElement();
      if (!topLevelElement) continue;

      const key = topLevelElement.getKey();
      if (seen.has(key)) continue;
      seen.add(key);

      const alignment =
        topLevelElement instanceof ElementNode
          ? topLevelElement.getFormatType()
          : 'left';

      alignments.add(alignment);
      if (alignments.size > 1) break;
    }

    switch (alignments.size) {
      case 0:
        setBlockAlignment('left');
        break;
      case 1:
        const alignment = alignments.values().next().value ?? '';
        setBlockAlignment(
          (alignment.length > 0 ? alignment : 'left') as Alignment,
        );
        break;
      default:
        setBlockAlignment('mixed');
    }
  }, []);

  const $updateToolbar = useCallback(() => {
    const selection = $getSelection();

    if ($isRangeSelection(selection)) {
      setIsBold(selection.hasFormat('bold'));
      setIsItalic(selection.hasFormat('italic'));
      setIsCode(selection.hasFormat('code'));
      setIsUnderline(selection.hasFormat('underline'));
      setIsStrikethrough(selection.hasFormat('strikethrough'));
    }

    collectBlockAlignment();
  }, [collectBlockAlignment]);

  useEffect(() => {
    if (blockAlignment === 'mixed') return;
    onChangeAlignment?.(blockAlignment);
  }, [blockAlignment, onChangeAlignment]);

  useEffect(() => {
    return mergeRegister(
      editor.registerUpdateListener(({ editorState }) => {
        editorState.read(
          () => {
            $updateToolbar();
          },
          { editor },
        );
      }),

      // Selection 변경
      editor.registerCommand(
        SELECTION_CHANGE_COMMAND,
        () => {
          $updateToolbar();
          return false;
        },
        COMMAND_PRIORITY_LOW,
      ),

      // Undo 가능 여부
      editor.registerCommand(
        CAN_UNDO_COMMAND,
        payload => {
          setCanUndo(payload);
          return false;
        },
        COMMAND_PRIORITY_LOW,
      ),

      // Redo 가능 여부
      editor.registerCommand(
        CAN_REDO_COMMAND,
        payload => {
          setCanRedo(payload);
          return false;
        },
        COMMAND_PRIORITY_LOW,
      ),

      // Tab 키 입력
      editor.registerCommand(
        KEY_TAB_COMMAND,
        event => {
          event.preventDefault();

          editor.getEditorState().read(() => {
            const selection = $getSelection();

            if ($isRangeSelection(selection)) {
              editor.dispatchCommand(
                event.shiftKey
                  ? OUTDENT_CONTENT_COMMAND
                  : INDENT_CONTENT_COMMAND,
                undefined,
              );
            } else {
              editor.update(() => {
                if ($isRangeSelection(selection)) {
                  selection.insertText('\t');
                }
              });
            }
          });
          return true;
        },
        COMMAND_PRIORITY_EDITOR,
      ),

      // 텍스트 정렬
      editor.registerCommand(
        FORMAT_ELEMENT_COMMAND,
        payload => {
          if (payload === 'start' || payload === 'end') return false;

          const alignment = payload === '' ? 'left' : payload;

          let shouldNotify = false;
          editor.getEditorState().read(() => {
            const root = $getRoot();
            const text = root.getTextContent().trim();

            shouldNotify = text.length === 0;
          });
          if (shouldNotify) {
            onChangeAlignment?.(alignment);
          }

          return false;
        },
        COMMAND_PRIORITY_LOW,
      ),
    );
  }, [editor, $updateToolbar, onChangeAlignment]);

  return (
    <div className="flex w-full items-center gap-1 border-b border-slate-200 p-2">
      <ToolbarButton
        icon={RotateCcw}
        disabled={!canUndo}
        onClick={() => {
          editor.dispatchCommand(UNDO_COMMAND, undefined);
        }}
      />
      <ToolbarButton
        icon={RotateCw}
        disabled={!canRedo}
        onClick={() => {
          editor.dispatchCommand(REDO_COMMAND, undefined);
        }}
      />
      <Divider />
      <ToolbarButton
        icon={Bold}
        className={isBold ? 'active' : ''}
        onClick={() => {
          editor.dispatchCommand(FORMAT_TEXT_COMMAND, 'bold');
        }}
      />
      <ToolbarButton
        icon={Italic}
        className={isItalic ? 'active' : ''}
        onClick={() => {
          editor.dispatchCommand(FORMAT_TEXT_COMMAND, 'italic');
        }}
      />
      <ToolbarButton
        icon={Underline}
        className={isUnderline ? 'active' : ''}
        onClick={() => {
          editor.dispatchCommand(FORMAT_TEXT_COMMAND, 'underline');
        }}
      />
      <ToolbarButton
        icon={Strikethrough}
        className={isStrikethrough ? 'active' : ''}
        onClick={() => {
          editor.dispatchCommand(FORMAT_TEXT_COMMAND, 'strikethrough');
        }}
      />
      <ToolbarButton
        icon={Code}
        className={isCode ? 'active' : ''}
        onClick={() => {
          editor.dispatchCommand(FORMAT_TEXT_COMMAND, 'code');
        }}
      />
      <Divider />
      <ToolbarButton
        icon={AlignLeft}
        className={blockAlignment === 'left' ? 'active' : ''}
        onClick={() => {
          editor.dispatchCommand(FORMAT_ELEMENT_COMMAND, 'left');
        }}
      />
      <ToolbarButton
        icon={AlignCenter}
        className={blockAlignment === 'center' ? 'active' : ''}
        onClick={() => {
          editor.dispatchCommand(FORMAT_ELEMENT_COMMAND, 'center');
        }}
      />
      <ToolbarButton
        icon={AlignRight}
        className={blockAlignment === 'right' ? 'active' : ''}
        onClick={() => {
          editor.dispatchCommand(FORMAT_ELEMENT_COMMAND, 'right');
        }}
      />
      <ToolbarButton
        icon={AlignJustify}
        className={blockAlignment === 'justify' ? 'active' : ''}
        onClick={() => {
          editor.dispatchCommand(FORMAT_ELEMENT_COMMAND, 'justify');
        }}
      />
    </div>
  );
};
