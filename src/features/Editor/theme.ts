import type { EditorThemeClasses } from 'lexical';

const editorTheme = {
  text: {
    code: 'bg-slate-200 px-1.5 py-0.5 rounded font-mono',
    underline: 'underline',
    strikethrough: 'line-through',
    underlineStrikethrough: '[text-decoration-line:underline_line-through]',
  },
} satisfies EditorThemeClasses;

export default editorTheme;
