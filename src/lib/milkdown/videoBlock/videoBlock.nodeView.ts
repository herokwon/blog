import { $view } from '@milkdown/utils';
import { type NodeViewFactory } from '@prosemirror-adapter/svelte';

import { videoBlockSchema } from './videoBlock.schema';
import VideoBlockView from './VideoBlockView.svelte';

export const createVideoBlockNodeView = (nodeViewFactory: NodeViewFactory) =>
  $view(videoBlockSchema, () => nodeViewFactory({ component: VideoBlockView }));
