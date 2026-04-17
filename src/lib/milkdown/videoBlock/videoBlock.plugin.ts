import type { EditorAssetEventHandlers } from '$lib/components/editor';
import { ALLOWED_VIDEO_TYPES, MAX_VIDEO_SIZE_BYTES } from '$lib/constants';
import { Plugin, PluginKey } from '@milkdown/prose/state';
import type { EditorView } from '@milkdown/prose/view';
import { $prose } from '@milkdown/utils';

const VIDEO_BLOCK_PLUGIN_KEY = new PluginKey('video_block_plugin');

type VideoBlockInsertPluginOptions = Pick<
  EditorAssetEventHandlers,
  'onVideoAdd' | 'onVideoError'
>;

export const videoBlockInsertPlugin = (
  options: VideoBlockInsertPluginOptions,
) =>
  $prose(
    () =>
      new Plugin({
        key: VIDEO_BLOCK_PLUGIN_KEY,
        props: {
          handlePaste(view, event) {
            const items = event.clipboardData?.items;
            if (!items) return false;

            for (const item of items) {
              if (item.type.startsWith('video/')) {
                const file = item.getAsFile();
                if (file) {
                  const validationError = validateVideo(file);
                  if (validationError) {
                    options.onVideoError(validationError);
                    return true;
                  }

                  event.preventDefault();

                  const blobUrl = URL.createObjectURL(file);
                  options.onVideoAdd(file, blobUrl);
                  insertVideoAtCursorFromView(view, {
                    src: blobUrl,
                    mimeType: file.type,
                  });
                }

                return true;
              }
            }

            return false;
          },
          handleDrop(view, event) {
            const items = event.dataTransfer?.items;
            if (!items) return false;

            for (const item of items) {
              if (item.type.startsWith('video/')) {
                const file = item.getAsFile();
                if (file) {
                  const validationError = validateVideo(file);
                  if (validationError) {
                    options.onVideoError(validationError);
                    return true;
                  }

                  event.preventDefault();

                  const blobUrl = URL.createObjectURL(file);
                  options.onVideoAdd(file, blobUrl);
                  insertVideoAtCursorFromView(view, {
                    src: blobUrl,
                    mimeType: file.type,
                  });
                }

                return true;
              }
            }

            return false;
          },
        },
      }),
  );

function validateVideo(file: File): string | null {
  if (!ALLOWED_VIDEO_TYPES.some(type => type === file.type))
    return `File type "${file.type}" is not allowed. Allowed types: ${ALLOWED_VIDEO_TYPES.join(', ')}`;

  if (file.size === 0)
    return 'File is empty. Please select a valid video file.';

  if (file.size > MAX_VIDEO_SIZE_BYTES)
    return `File size exceeds the maximum allowed size of ${MAX_VIDEO_SIZE_BYTES / 1024 / 1024}MB`;

  return null;
}

function insertVideoAtCursorFromView(
  view: EditorView,
  { src, mimeType }: { src: string; mimeType: string },
): void {
  const { state, dispatch } = view;
  const nodeType = state.schema.nodes['video_block'];

  if (!nodeType) return;

  const videoBlockNode = nodeType.create({
    src,
    mimeType,
    poster: '',
  });
  const trans = state.tr.replaceSelectionWith(videoBlockNode);

  dispatch(trans);
}
