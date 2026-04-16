export interface EditorAssetEventHandlers {
  onImageAdd: (file: File, blobUrl: string) => void;
  onImageError: (error: string) => void;
  onVideoAdd: (file: File, blobUrl: string) => void;
  onVideoError: (error: string) => void;
}
