import { vi } from 'vitest';

import {
  createEditor,
  DOMExportOutput,
  type LexicalEditor,
  LexicalNode,
  ParagraphNode,
  TextNode,
} from 'lexical';

import { constructImportMap, exportMap } from './config';

const initEditor = (): LexicalEditor =>
  createEditor({ namespace: 'test-editor', nodes: [ParagraphNode, TextNode] });

const nodePair = () => ({
  child: new TextNode('child'),
  parent: new ParagraphNode(),
});

describe('[Features/Editor] config', () => {
  it('exportMap 객체는 ParagraphNode와 TextNode가 포함되어 있어야 합니다.', () => {
    expect(exportMap.has(ParagraphNode)).toBe(true);
    expect(exportMap.has(TextNode)).toBe(true);

    expect(exportMap.size).toBe(2);
    expect(Array.from(exportMap.keys())).toEqual([ParagraphNode, TextNode]);
    expect(
      Array.from(exportMap.values()).every(fn => typeof fn === 'function'),
    ).toBe(true);
  });

  it('removeStyleExportDOM 함수는 요소의 style과 class 속성을 제거해야 합니다.', () => {
    const editor = initEditor();
    const textExport = exportMap.get(TextNode);

    expect(textExport).toBeDefined();
    expect(typeof textExport).toBe('function');

    editor.update(() => {
      const textNode = new TextNode('Styled Text');
      textNode.setStyle('color: red; font-size: 20px;');
      textNode.setFormat('bold');

      const textOutput = textExport?.(editor, textNode);

      expect(textOutput).toBeTruthy();
      const element = textOutput?.element as HTMLElement | null;

      expect(element).toBeInstanceOf(HTMLElement);
      expect(element?.getAttribute('style')).toBeNull();
      expect(element?.getAttribute('class')).toBeNull();
    });
  });

  it('removeStyleExportDOM 함수는 exportDOM = null 일때, null을 반환해야 합니다.', () => {
    const editor = initEditor();
    let output: DOMExportOutput | null = null;

    editor.update(() => {
      const textNode = new TextNode('x');
      const spy = vi
        .spyOn(textNode, 'exportDOM')
        .mockImplementation(() => null as unknown as DOMExportOutput);

      const fn = exportMap.get(TextNode);
      output = fn?.(editor, textNode) ?? null;

      expect(spy).toHaveBeenCalled();
    });

    expect(output).toBeNull();
  });

  it('constructImportMap 함수는 importer = null 일 때, handler가 null을 반환해야 합니다.', () => {
    vi.spyOn(TextNode, 'importDOM').mockReturnValue({
      span: () => null,
    });

    const element = document.createElement('span');

    const map = constructImportMap();
    const handler = map['span'];
    const importer = handler?.(element);

    expect(typeof handler).toBe('function');
    expect(importer).toBeNull();
  });

  it('constructImportMap 함수는 conversion이 없는 경우 null을 반환해야 합니다.', () => {
    vi.spyOn(TextNode, 'importDOM').mockReturnValue({
      span: () => ({
        priority: 1,
        conversion: () => null,
      }),
    });

    const element = document.createElement('span');
    element.style.fontSize = '20px';
    element.style.color = 'rgb(255, 0, 0)';
    element.style.backgroundColor = 'rgb(240, 240, 240)';

    const map = constructImportMap();
    const handler = map['span'];
    const importer = handler?.(element);

    const editor = initEditor();
    let node: LexicalNode | null = null;

    editor.update(() => {
      const output = importer?.conversion(element);
      const { child, parent } = nodePair();
      node = output?.forChild?.(child, parent) ?? null;
    });

    expect(node).toBeNull();
  });

  it('constructImportMap 함수는 extraStyles가 없으면 forChild 결과를 반영하지 않는다.', () => {
    vi.spyOn(TextNode, 'importDOM').mockReturnValue({
      span: () => ({
        priority: 1,
        conversion: () => ({
          node: null,
          forChild: () => new TextNode('ok'),
        }),
      }),
    });
    const element = document.createElement('span');
    element.style.fontSize = '16px';
    element.style.color = 'rgb(0, 0, 0)';
    element.style.backgroundColor = 'rgb(255, 255, 255)';

    const map = constructImportMap();
    const handler = map['span'];
    const importer = handler?.(element);

    const editor = initEditor();
    let style: string = 'unset';

    editor.update(() => {
      const output = importer?.conversion(element);
      const { child, parent } = nodePair();
      const text = output?.forChild?.(child, parent) as TextNode;

      style = text.getStyle();
    });

    expect(style).toBe('');
  });

  it('constructImportMap 함수는 extraStyles가 있으면 forChild 결과에 반영한다.', () => {
    vi.spyOn(TextNode, 'importDOM').mockReturnValue({
      span: () => ({
        priority: 1,
        conversion: () => ({
          node: null,
          forChild: () => new TextNode('ok'),
        }),
      }),
    });

    const element = document.createElement('span');
    element.style.fontSize = '20px';
    element.style.color = 'rgb(255, 0, 0)';
    element.style.backgroundColor = 'rgb(240, 240, 240)';

    const map = constructImportMap();
    const handler = map['span'];
    const importer = handler?.(element);

    const editor = initEditor();
    let style: string = 'unset';

    editor.update(() => {
      const output = importer?.conversion(element);
      const { child, parent } = nodePair();
      const text = output?.forChild?.(child, parent) as TextNode;

      style = text.getStyle();
    });

    expect(style).toBe(
      'font-size: 20px;color: rgb(255, 0, 0);background-color: rgb(240, 240, 240);',
    );
  });

  it('constructImportMap 함수는 forChild가 (TextNode가 아닌) ParagraphNode를 반환하면 스타일 변경이 없어야 합니다.', () => {
    vi.spyOn(TextNode, 'importDOM').mockReturnValue({
      span: () => ({
        priority: 1,
        conversion: () => ({
          node: null,
          forChild: () => new ParagraphNode(),
        }),
      }),
    } satisfies ReturnType<typeof TextNode.importDOM>);

    const element = document.createElement('span');
    element.style.fontSize = '20px';
    element.style.color = 'rgb(10, 20, 30)';
    element.style.backgroundColor = 'rgb(240, 240, 240)';

    const map = constructImportMap();
    const importer = map['span'](element);

    const setStyleSpy = vi.spyOn(TextNode.prototype, 'setStyle');

    const editor = initEditor();

    editor.update(() => {
      const output = importer?.conversion(element);
      const { child, parent } = nodePair();
      const result = output?.forChild?.(child, parent);

      expect(result).toBeInstanceOf(ParagraphNode);
      expect(setStyleSpy).not.toHaveBeenCalled();
    });
  });
});
