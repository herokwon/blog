import { beforeAll, beforeEach, describe, expect, it, vi } from 'vitest';

import type { Node, NodeType } from '@milkdown/prose/model';
import type { $Node } from '@milkdown/utils';

import { videoBlockSchema } from './videoBlock.schema';

type NodeSchema = $Node['schema'];

type MarkdownNode = Parameters<NodeSchema['parseMarkdown']['match']>[0];
type ParseState = Parameters<NodeSchema['parseMarkdown']['runner']>[0];
type SerializerState = Parameters<NodeSchema['toMarkdown']['runner']>[0];

const captured = vi.hoisted(() => ({ def: null as NodeSchema | null }));

vi.mock('@milkdown/utils', () => ({
  $node: (_name: string, factory: () => $Node['schema']) => {
    captured.def = factory();
    return { key: 'video_blockNode' };
  },
}));

describe('[Milkdown] videoBlockSchema', () => {
  beforeAll(() => {
    void videoBlockSchema;
  });

  describe('parseDOM', () => {
    it('extracts all attributes from data-* attributes on a div', () => {
      const dom = {
        getAttribute: (name: string) => {
          const map: Record<string, string> = {
            'data-video-src': 'video.mp4',
            'data-mime-type': 'video/mp4',
            'data-poster': 'poster.jpg',
          };

          return map[name] ?? null;
        },
      } as HTMLElement;

      const attrs = captured.def?.parseDOM?.[0].getAttrs?.(dom);

      expect(attrs).toEqual({
        src: 'video.mp4',
        mimeType: 'video/mp4',
        poster: 'poster.jpg',
      });
    });

    it('falls back to empty strings when data-* attributes are absent', () => {
      const dom = {
        getAttribute: (name: string) => {
          const map: Record<string, string> = {};
          return map[name] ?? null;
        },
      } as HTMLElement;

      const attrs = captured.def?.parseDOM?.[0].getAttrs?.(dom);

      expect(attrs).toEqual({
        src: '',
        mimeType: 'video/mp4',
        poster: '',
      });
    });
  });

  describe('toDOM', () => {
    it('serializes node attributes to data-* attributes on a div', () => {
      const node = {
        attrs: {
          src: 'video.mp4',
          mimeType: 'video/mp4',
          poster: '',
        },
        type: { name: 'video_block' },
      } as unknown as Node;

      const [tag, attrs] = (captured.def?.toDOM?.(node) ?? []) as [
        string,
        Record<string, string>,
      ];

      expect(tag).toBe('div');
      expect(attrs).toEqual({
        'data-video-src': 'video.mp4',
        'data-mime-type': 'video/mp4',
        'data-poster': '',
      });
    });
  });

  describe('parseMarkdown', () => {
    describe('match', () => {
      it('returns true for a leafDirective named "video"', () => {
        expect(
          captured.def?.parseMarkdown.match({
            type: 'leafDirective',
            name: 'video',
          }),
        ).toBe(true);
      });

      it.each<[string, MarkdownNode]>([
        ['non-leafDirective type', { type: 'paragraph', name: 'video' }],
        [
          'leafDirective with wrong name',
          { type: 'leafDirective', name: 'image' },
        ],
      ])('returns false for %s', (_label, node) => {
        expect(captured.def?.parseMarkdown.match(node)).toBe(false);
      });
    });

    describe('runner', () => {
      let addNode: ReturnType<typeof vi.fn>;
      let type: NodeType;

      beforeEach(() => {
        addNode = vi.fn();
        type = {} as NodeType;
      });

      it('adds a node with all provided attributes', () => {
        captured.def?.parseMarkdown.runner(
          { addNode } as unknown as ParseState,
          {
            type: 'leafDirective',
            name: 'video',
            attributes: {
              src: 'video.mp4',
              mimeType: 'video/mp4',
              poster: '',
            },
          },
          type,
        );

        expect(addNode).toHaveBeenCalledWith(type, {
          src: 'video.mp4',
          mimeType: 'video/mp4',
          poster: '',
        });
      });

      it('falls back to empty strings when attributes are absent', () => {
        captured.def?.parseMarkdown.runner(
          { addNode } as unknown as ParseState,
          {
            type: 'leafDirective',
            name: 'video',
          },
          type,
        );

        expect(addNode).toHaveBeenCalledWith(type, {
          src: '',
          mimeType: 'video/mp4',
          poster: '',
        });
      });
    });
  });

  describe('toMarkdown', () => {
    describe('match', () => {
      it('returns true for a video_block node', () => {
        expect(
          captured.def?.toMarkdown.match({
            attrs: { src: '', mimeType: '', poster: '' },
            type: { name: 'video_block' },
          } as unknown as Node),
        ).toBe(true);
      });

      it('returns false for other node types', () => {
        expect(
          captured.def?.toMarkdown.match({
            attrs: { src: '', mimeType: '', poster: '' },
            type: { name: 'paragraph' },
          } as unknown as Node),
        ).toBe(false);
      });
    });

    describe('runner', () => {
      let addNode: ReturnType<typeof vi.fn>;

      beforeEach(() => {
        addNode = vi.fn();
      });

      it('includes poster in attributes when it is non-empty', () => {
        captured.def?.toMarkdown.runner(
          { addNode } as unknown as SerializerState,
          {
            attrs: {
              src: 'video.mp4',
              mimeType: 'video/mp4',
              poster: 'poster.jpg',
            },
            type: { name: 'video_block' },
          } as unknown as Node,
        );

        expect(addNode).toHaveBeenCalledWith(
          'leafDirective',
          undefined,
          undefined,
          {
            name: 'video',
            attributes: {
              src: 'video.mp4',
              mimeType: 'video/mp4',
              poster: 'poster.jpg',
            },
          },
        );
      });

      it('omits poster from attributes when it is empty', () => {
        captured.def?.toMarkdown.runner(
          { addNode } as unknown as SerializerState,
          {
            attrs: {
              src: 'video.mp4',
              mimeType: 'video/mp4',
              poster: '',
            },
            type: { name: 'video_block' },
          } as unknown as Node,
        );

        expect(addNode).toHaveBeenCalledWith(
          'leafDirective',
          undefined,
          undefined,
          {
            name: 'video',
            attributes: {
              src: 'video.mp4',
              mimeType: 'video/mp4',
            },
          },
        );
      });
    });
  });
});
