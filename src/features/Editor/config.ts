import {
  $isTextNode,
  type DOMConversionMap,
  type DOMExportOutput,
  type DOMExportOutputMap,
  isHTMLElement,
  type Klass,
  type LexicalEditor,
  type LexicalNode,
  ParagraphNode,
  TextNode,
} from 'lexical';

import { parseAllowedColor, parseAllowedFontSize } from './style-config';

const removeStyleExportDOM = (
  editor: LexicalEditor,
  target: LexicalNode,
): DOMExportOutput => {
  const output = target.exportDOM(editor);

  if (output && isHTMLElement(output.element)) {
    for (const element of [
      output.element,
      ...output.element.querySelectorAll('[style], [class]'),
    ]) {
      element.removeAttribute('class');
      element.removeAttribute('style');
    }
  }

  return output;
};

const getExtraStyles = (element: HTMLElement): string => {
  let extraStyles = '';

  const fontSize = parseAllowedFontSize(element.style.fontSize);
  const color = parseAllowedColor(element.style.color);
  const backgroundColor = parseAllowedColor(element.style.backgroundColor);

  if (fontSize.length > 0 && fontSize !== '16px') {
    extraStyles += `font-size: ${fontSize};`;
  }
  if (color.length > 0 && color !== 'rgb(0, 0, 0)') {
    extraStyles += `color: ${color};`;
  }
  if (backgroundColor.length > 0 && backgroundColor !== 'rgb(255, 255, 255)') {
    extraStyles += `background-color: ${backgroundColor};`;
  }

  return extraStyles;
};

export const exportMap: DOMExportOutputMap = new Map<
  Klass<LexicalNode>,
  (editor: LexicalEditor, target: LexicalNode) => DOMExportOutput
>([
  [ParagraphNode, removeStyleExportDOM],
  [TextNode, removeStyleExportDOM],
]);

export const constructImportMap = (): DOMConversionMap => {
  const importMap: DOMConversionMap = {};

  for (const [tag, fn] of Object.entries(TextNode.importDOM() || {})) {
    importMap[tag] = importNode => {
      const importer = fn(importNode);

      if (!importer) return null;
      return {
        ...importer,
        conversion: element => {
          const output = importer.conversion(element);
          if (!output || !output.forChild || output.after || output.node) {
            return output;
          }

          const extraStyles = getExtraStyles(element);
          if (extraStyles.length === 0) {
            return output;
          }

          return {
            ...output,
            forChild: (child, parent) => {
              const textNode = output.forChild?.(child, parent);
              if ($isTextNode(textNode)) {
                textNode.setStyle(textNode.getStyle() + extraStyles);
              }

              return textNode;
            },
          };
        },
      };
    };
  }

  return importMap;
};
