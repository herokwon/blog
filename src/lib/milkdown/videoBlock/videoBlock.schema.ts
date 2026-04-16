import { $node } from '@milkdown/utils';

export const videoBlockSchema = $node('video_block', () => ({
  group: 'block',
  atom: true,
  isolating: true,
  selectable: true,
  draggable: true,
  attrs: {
    src: { default: '' },
    mimeType: { default: 'video/mp4' },
    poster: { default: '' },
  },
  parseDOM: [
    {
      tag: 'div[data-video-src]',
      getAttrs: dom => ({
        src: (dom as HTMLElement).getAttribute('data-video-src') ?? '',
        mimeType:
          (dom as HTMLElement).getAttribute('data-mime-type') ?? 'video/mp4',
        poster: (dom as HTMLElement).getAttribute('data-poster') ?? '',
      }),
    },
  ],
  toDOM: node => [
    'div',
    {
      'data-video-src': node.attrs.src,
      'data-mime-type': node.attrs.mimeType,
      'data-poster': node.attrs.poster,
    },
  ],
  parseMarkdown: {
    match: node => node.type === 'leafDirective' && node.name === 'video',
    runner: (state, node, type) => {
      const attrs = (node.attributes ?? {}) as Record<string, string>;
      state.addNode(type, {
        src: attrs.src ?? '',
        mimeType: attrs.mimeType ?? 'video/mp4',
        poster: attrs.poster ?? '',
      });
    },
  },
  toMarkdown: {
    match: node => node.type.name === 'video_block',
    runner: (state, node) => {
      const { src, mimeType, poster } = node.attrs;

      const attributes: Record<string, string> = { src, mimeType };
      if (poster) attributes.poster = poster;

      state.addNode('leafDirective', undefined, undefined, {
        name: 'video',
        attributes,
      });
    },
  },
}));
