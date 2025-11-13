import {
  extractTextNodes,
  isValidEditorState,
  parseEditorState,
} from './editorState';

const validEditorState = JSON.stringify({
  root: {
    children: [
      {
        children: [
          { text: 'Hello', type: 'text', version: 1 },
          { text: ' World', type: 'text', version: 1 },
        ],
        type: 'paragraph',
        version: 1,
      },
    ],
    type: 'root',
    version: 1,
  },
});

const nestedEditorState = JSON.stringify({
  root: {
    children: [
      {
        children: [
          { text: 'First', type: 'text', version: 1 },
          {
            children: [{ text: 'Nested', type: 'text', version: 1 }],
            type: 'paragraph',
            version: 1,
          },
        ],
        type: 'paragraph',
        version: 1,
      },
    ],
    type: 'root',
    version: 1,
  },
});

describe('[Features/Post] editorState utils', () => {
  describe('isValidEditorState & parseEditorState', () => {
    it('유효한 에디터 상태를 파싱하고 검증해야 합니다.', () => {
      expect(isValidEditorState(validEditorState)).toBe(true);
      const result = parseEditorState(validEditorState);
      expect(result).not.toBeNull();
      expect(result?.root.children).toHaveLength(1);
    });

    it('잘못된 JSON 문자열을 거부해야 합니다.', () => {
      expect(isValidEditorState('invalid-json')).toBe(false);
      expect(parseEditorState('invalid-json')).toBeNull();
    });

    it('root가 없거나 null이거나 객체가 아닌 경우를 거부해야 합니다.', () => {
      expect(isValidEditorState(JSON.stringify({ data: 'test' }))).toBe(false);
      expect(isValidEditorState(JSON.stringify({ root: null }))).toBe(false);
      expect(isValidEditorState(JSON.stringify({ root: 'string' }))).toBe(
        false,
      );
      expect(isValidEditorState('null')).toBe(false);
    });

    it('children이 빈 배열이거나 배열이 아닌 경우를 거부해야 합니다.', () => {
      expect(
        isValidEditorState(JSON.stringify({ root: { children: [] } })),
      ).toBe(false);
      expect(
        isValidEditorState(JSON.stringify({ root: { children: 'not-array' } })),
      ).toBe(false);
    });

    it('유효하지 않은 노드 구조를 거부해야 합니다.', () => {
      expect(
        isValidEditorState(
          JSON.stringify({
            root: { children: [{ invalid: 'node' }] },
          }),
        ),
      ).toBe(false);
      expect(
        isValidEditorState(
          JSON.stringify({
            root: {
              children: [
                { type: 'paragraph', version: 1 },
                { invalid: 'node' },
              ],
            },
          }),
        ),
      ).toBe(false);
      expect(
        isValidEditorState(JSON.stringify({ root: { children: [null] } })),
      ).toBe(false);
      expect(
        isValidEditorState(JSON.stringify({ root: { children: ['string'] } })),
      ).toBe(false);
    });

    it('type이 없거나 문자열이 아닌 노드를 거부해야 합니다.', () => {
      expect(
        isValidEditorState(
          JSON.stringify({ root: { children: [{ version: 1 }] } }),
        ),
      ).toBe(false);
      expect(
        isValidEditorState(
          JSON.stringify({
            root: { children: [{ type: 123, version: 1 }] },
          }),
        ),
      ).toBe(false);
    });

    it('version이 없거나 숫자가 아닌 노드를 거부해야 합니다.', () => {
      expect(
        isValidEditorState(
          JSON.stringify({ root: { children: [{ type: 'paragraph' }] } }),
        ),
      ).toBe(false);
      expect(
        isValidEditorState(
          JSON.stringify({
            root: { children: [{ type: 'paragraph', version: '1' }] },
          }),
        ),
      ).toBe(false);
    });
  });

  describe('extractTextNodes', () => {
    it('유효한 에디터 상태에서 모든 텍스트 노드를 추출해야 합니다.', () => {
      const textNodes = extractTextNodes(validEditorState);
      expect(textNodes).toHaveLength(2);
      expect(textNodes[0].text).toBe('Hello');
      expect(textNodes[1].text).toBe(' World');
    });

    it('중첩된 구조에서도 모든 텍스트 노드를 추출해야 합니다.', () => {
      const textNodes = extractTextNodes(nestedEditorState);
      expect(textNodes).toHaveLength(2);
      expect(textNodes[0].text).toBe('First');
      expect(textNodes[1].text).toBe('Nested');
    });

    it('유효하지 않은 에디터 상태는 빈 배열을 반환해야 합니다.', () => {
      expect(extractTextNodes('invalid-json')).toEqual([]);
      expect(extractTextNodes(JSON.stringify({ root: null }))).toEqual([]);
      expect(
        extractTextNodes(JSON.stringify({ root: { children: [] } })),
      ).toEqual([]);
    });

    it('텍스트 노드가 없는 경우 빈 배열을 반환해야 합니다.', () => {
      const noTextNodes = JSON.stringify({
        root: {
          children: [
            {
              children: [{ type: 'linebreak', version: 1 }],
              type: 'paragraph',
              version: 1,
            },
          ],
          type: 'root',
          version: 1,
        },
      });
      expect(extractTextNodes(noTextNodes)).toEqual([]);
    });

    it('children 속성이 없는 노드는 건너뛰어야 합니다.', () => {
      const noChildren = JSON.stringify({
        root: {
          children: [{ type: 'paragraph', version: 1 }],
          type: 'root',
          version: 1,
        },
      });
      expect(extractTextNodes(noChildren)).toEqual([]);
    });
  });
});
