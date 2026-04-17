import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

import type { NodeViewConstructor } from '@milkdown/prose/view';
import type { $Node } from '@milkdown/utils';
import type { NodeViewFactory } from '@prosemirror-adapter/svelte';

import { createVideoBlockNodeView } from './videoBlock.nodeView';

interface ViewCapture {
  schema: $Node | null;
  factory: (() => NodeViewConstructor) | null;
}

const captured = vi.hoisted(
  (): ViewCapture => ({ schema: null, factory: null }),
);

vi.mock('@milkdown/utils', () => ({
  $view: (schema: $Node, factory: () => NodeViewConstructor) => {
    captured.schema = schema;
    captured.factory = factory;

    return { key: 'view' };
  },
}));

vi.mock('./videoBlock.schema', () => ({
  videoBlockSchema: { key: 'video_blockNode' },
}));

vi.mock('./VideoBlockView.svelte', () => ({
  default: { name: 'VideoBlockView' },
}));

describe('[Milkdown] createVideoBlockNodeView', () => {
  let nodeViewFactory: NodeViewFactory;

  beforeEach(() => {
    nodeViewFactory = vi
      .fn<NodeViewFactory>()
      .mockReturnValue({} as NodeViewConstructor);
  });

  afterEach(() => {
    vi.clearAllMocks();
    captured.schema = null;
    captured.factory = null;
  });

  it('passes videoBlockSchema as the first argument to $view', () => {
    createVideoBlockNodeView(nodeViewFactory);
    captured.factory?.();

    expect(captured.schema).toEqual({
      key: 'video_blockNode',
    });
  });

  it('factory calls nodeViewFactory with VideoBlockView as the component', () => {
    createVideoBlockNodeView(nodeViewFactory);
    captured.factory?.();

    expect(nodeViewFactory).toHaveBeenCalledWith({
      component: { name: 'VideoBlockView' },
    });
  });

  it('returns the result of $view invocation', () => {
    const result = createVideoBlockNodeView(nodeViewFactory);

    expect(result).toEqual({ key: 'view' });
  });

  it('factory can be invoked multiple times independently', () => {
    createVideoBlockNodeView(nodeViewFactory);

    const factory = captured.factory;
    expect(factory).toBeDefined();

    factory?.();
    expect(nodeViewFactory).toHaveBeenCalledTimes(1);

    factory?.();
    expect(nodeViewFactory).toHaveBeenCalledTimes(2);

    expect(nodeViewFactory).toHaveBeenCalledWith({
      component: { name: 'VideoBlockView' },
    });
  });

  it('creates independent factories for multiple invocations', () => {
    const factory1 = captured.factory;
    createVideoBlockNodeView(nodeViewFactory);
    const factory2 = captured.factory;

    expect(factory1).not.toBe(factory2);
  });
});
