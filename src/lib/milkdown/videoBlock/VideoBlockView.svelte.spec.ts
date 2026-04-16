import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

import type { ALLOWED_VIDEO_TYPES } from '$lib/constants';
import { render } from 'vitest-browser-svelte';

import VideoBlockView from './VideoBlockView.svelte';

interface VideoBlockNodeAttributes {
  src: string;
  mimeType: (typeof ALLOWED_VIDEO_TYPES)[number];
  poster?: string;
}

type VideoBlockNodeValue = {
  attrs: VideoBlockNodeAttributes;
};

const stores = vi.hoisted(() => {
  function makeWritable<T>(initial: T) {
    let value = initial;
    const subscribers = new Set<(v: T) => void>();

    return {
      subscribe: (run: (v: T) => void) => {
        subscribers.add(run);
        run(value);

        return () => subscribers.delete(run);
      },
      set: (next: T) => {
        value = next;
        subscribers.forEach(fn => fn(next));
      },
      _clearSubscribers: () => subscribers.clear(),
    };
  }

  return {
    nodeStore: makeWritable<VideoBlockNodeValue>({
      attrs: {
        src: '',
        mimeType: 'video/mp4',
        poster: '',
      },
    }),
    selectedStore: makeWritable<boolean>(false),
  };
});

vi.mock('@prosemirror-adapter/svelte', () => ({
  useNodeViewContext: (key: string) => {
    if (key === 'node') return stores.nodeStore;
    return stores.selectedStore;
  },
}));

describe('[Milkdown] VideoBlockView', () => {
  beforeEach(() => {
    stores.nodeStore.set({
      attrs: {
        src: '',
        mimeType: 'video/mp4',
        poster: '',
      },
    });
    stores.selectedStore.set(false);
  });

  afterEach(() => {
    stores.nodeStore._clearSubscribers();
    stores.selectedStore._clearSubscribers();
  });

  it('renders a <video> with attributes from the node store', async () => {
    stores.nodeStore.set({
      attrs: {
        src: 'https://example.com/test.mp4',
        mimeType: 'video/mp4',
        poster: 'https://example.com/test.jpg',
      },
    });

    const { container } = await render(VideoBlockView);
    const video = container.querySelector('video');
    const videoSource = video?.querySelector('source');

    expect(video).not.toBeNull();
    expect(videoSource?.getAttribute('src')).toBe(
      'https://example.com/test.mp4',
    );
    expect(videoSource?.getAttribute('type')).toBe('video/mp4');
    expect(video?.getAttribute('poster')).toBe('https://example.com/test.jpg');
  });

  it('adds the "selected" class when the selected store is true', async () => {
    stores.selectedStore.set(true);

    const { container } = await render(VideoBlockView);
    const selectedVideoBlock = container.querySelector('.video-block.selected');

    expect(selectedVideoBlock).not.toBeNull();
  });

  it('does not add the "selected" class when the selected store is false', async () => {
    stores.selectedStore.set(false);

    const { container } = await render(VideoBlockView);
    const selectedVideoBlock = container.querySelector('.video-block.selected');

    expect(selectedVideoBlock).toBeNull();
  });

  it('renders video with controls and playsinline attributes', async () => {
    const { container } = await render(VideoBlockView);
    const video = container.querySelector('video');

    expect(video?.hasAttribute('controls')).toBe(true);
    expect(video?.hasAttribute('playsinline')).toBe(true);
  });

  it('does not set poster attribute when poster is empty', async () => {
    stores.nodeStore.set({
      attrs: {
        src: 'https://example.com/test.mp4',
        mimeType: 'video/mp4',
        poster: '',
      },
    });

    const { container } = await render(VideoBlockView);
    const video = container.querySelector('video');

    expect(video?.hasAttribute('poster')).toBe(false);
  });

  it('renders track element with captions kind attribute', async () => {
    const { container } = await render(VideoBlockView);
    const track = container.querySelector('track');

    expect(track).not.toBeNull();
    expect(track?.getAttribute('kind')).toBe('captions');
  });

  it('renders fallback text for unsupported browsers', async () => {
    const { container } = await render(VideoBlockView);
    const fallbackText = container.querySelector('video > p');

    expect(fallbackText).not.toBeNull();
    expect(fallbackText?.textContent).toBe(
      'Your browser does not support the video tag',
    );
  });

  it('renders video-block container div', async () => {
    const { container } = await render(VideoBlockView);
    const videoBlock = container.querySelector('.video-block');

    expect(videoBlock).not.toBeNull();
    expect(videoBlock?.querySelector('video')).not.toBeNull();
  });

  it('handles webm video format', async () => {
    stores.nodeStore.set({
      attrs: {
        src: 'https://example.com/test.webm',
        mimeType: 'video/webm',
        poster: undefined,
      },
    });

    const { container } = await render(VideoBlockView);
    const videoSource = container.querySelector('source');

    expect(videoSource?.getAttribute('type')).toBe('video/webm');
  });

  it('renders all child elements in correct order', async () => {
    stores.nodeStore.set({
      attrs: {
        src: 'https://example.com/test.mp4',
        mimeType: 'video/mp4',
        poster: 'https://example.com/test.jpg',
      },
    });

    const { container } = await render(VideoBlockView);
    const video = container.querySelector('video');
    const children = Array.from(video?.childNodes || []);

    expect(children.some(node => node.nodeName === 'SOURCE')).toBe(true);
    expect(children.some(node => node.nodeName === 'TRACK')).toBe(true);
    expect(children.some(node => node.nodeName === 'P')).toBe(true);
  });

  it('renders source element as first child of video', async () => {
    const { container } = await render(VideoBlockView);
    const video = container.querySelector('video');
    const firstChild = video?.querySelector(':scope > source');

    expect(firstChild).not.toBeNull();
    expect(firstChild?.tagName).toBe('SOURCE');
  });
});
