import { afterEach, describe, expect, it, vi } from 'vitest';

import type {
  createMilkdownEditor,
  EditorAssetEventHandlers,
} from '$lib/components/editor';
import {
  clearDraftImages,
  loadDraftImages,
  saveDraftImages,
} from '$lib/services';
import {
  clearDraftVideos,
  loadDraftVideos,
  saveDraftVideos,
} from '$lib/services/draft-storage';
import {
  createMockPendingImage,
  createMockPendingVideo,
  createMockPost,
  stubGlobalFetch,
} from '$lib/test-utils';
import type { CreatePostApiResponse } from '$lib/types/api';
import { render } from 'vitest-browser-svelte';
import { page } from 'vitest/browser';

import Page from './+page.svelte';

const { gotoMock, mockImageManager, mockVideoManager } = vi.hoisted(() => ({
  gotoMock: vi.fn(),
  mockImageManager: {
    registerImage: vi.fn(),
    getPendingImages: vi.fn().mockReturnValue([]),
    hasPending: false,
    uploadAll: vi.fn().mockResolvedValue(new Map()),
    cleanup: vi.fn(),
  },
  mockVideoManager: {
    queueVideo: vi.fn(),
    getPendingVideos: vi.fn().mockReturnValue([]),
    hasPending: false,
    uploadAll: vi.fn().mockResolvedValue(new Map()),
    cleanup: vi.fn(),
  },
}));

vi.mock('$app/navigation', () => ({
  goto: gotoMock,
}));

vi.mock('$lib/services/image-manager', () => ({
  createImageManager: vi.fn(() => mockImageManager),
}));

vi.mock('$lib/services/video-manager', () => ({
  createVideoManager: vi.fn(() => mockVideoManager),
}));

vi.mock('$lib/services/draft-storage', () => ({
  saveDraftImages: vi.fn().mockResolvedValue(undefined),
  loadDraftImages: vi.fn().mockResolvedValue([]),
  clearDraftImages: vi.fn().mockResolvedValue(undefined),
  saveDraftVideos: vi.fn().mockResolvedValue(undefined),
  loadDraftVideos: vi.fn().mockResolvedValue([]),
  clearDraftVideos: vi.fn().mockResolvedValue(undefined),
  extractBlobUrlsFromContent: vi.fn().mockReturnValue(new Set()),
  cleanupOrphanedVideos: vi.fn().mockResolvedValue(undefined),
}));

let capturedOnImageAdd: EditorAssetEventHandlers['onImageAdd'] | undefined;
let capturedOnImageError: EditorAssetEventHandlers['onImageError'] | undefined;
let capturedOnVideoAdd: EditorAssetEventHandlers['onVideoAdd'] | undefined;
let capturedOnVideoError: EditorAssetEventHandlers['onVideoError'] | undefined;

vi.mock('$lib/components/editor/config', () => ({
  createMilkdownEditor: vi.fn(
    async (options: Parameters<typeof createMilkdownEditor>[0]) => {
      capturedOnImageAdd = options.onImageAdd;
      capturedOnImageError = options.onImageError;
      capturedOnVideoAdd = options.onVideoAdd;
      capturedOnVideoError = options.onVideoError;

      const editable = document.createElement('div');
      editable.setAttribute('contenteditable', 'true');
      editable.setAttribute('role', 'textbox');
      editable.textContent = options.defaultValue ?? '';
      options.root.appendChild(editable);
      options.onChange?.(options.defaultValue ?? '');
      return {};
    },
  ),
}));

const mockPost = createMockPost();

describe('[Page] /admin/posts/new', () => {
  afterEach(() => {
    vi.unstubAllGlobals();
    localStorage.clear();
    gotoMock.mockReset();

    mockImageManager.registerImage.mockClear();
    mockImageManager.getPendingImages.mockReset().mockReturnValue([]);
    mockImageManager.hasPending = false;
    mockImageManager.uploadAll.mockReset().mockResolvedValue(new Map());
    mockImageManager.cleanup.mockClear();

    mockVideoManager.queueVideo.mockClear();
    mockVideoManager.getPendingVideos.mockReset().mockReturnValue([]);
    mockVideoManager.hasPending = false;
    mockVideoManager.uploadAll.mockReset().mockResolvedValue(new Map());
    mockVideoManager.cleanup.mockClear();

    capturedOnImageAdd = undefined;
    capturedOnImageError = undefined;
    capturedOnVideoAdd = undefined;
    capturedOnVideoError = undefined;

    vi.mocked(loadDraftImages).mockReset().mockResolvedValue([]);
    vi.mocked(saveDraftImages).mockReset().mockResolvedValue(undefined);
    vi.mocked(clearDraftImages).mockReset().mockResolvedValue(undefined);
    vi.mocked(loadDraftVideos).mockReset().mockResolvedValue([]);
    vi.mocked(saveDraftVideos).mockReset().mockResolvedValue(undefined);
    vi.mocked(clearDraftVideos).mockReset().mockResolvedValue(undefined);
  });

  describe('Form rendering and draft management', () => {
    it('should render form elements', async () => {
      await render(Page);

      await Promise.all([
        expect
          .element(page.getByRole('textbox', { name: 'Title' }))
          .toBeInTheDocument(),
        expect
          .element(page.getByRole('textbox', { name: 'Content' }))
          .toBeInTheDocument(),
        expect
          .element(page.getByRole('button', { name: 'Save draft' }))
          .toBeInTheDocument(),
        expect
          .element(page.getByRole('button', { name: 'Submit' }))
          .toBeInTheDocument(),
      ]);
    });

    it('should restore draft from localStorage on mount', async () => {
      localStorage.setItem(
        'DRAFT_POST',
        JSON.stringify({
          title: 'Draft Title',
          content: 'Draft Content',
        }),
      );
      await render(Page);

      await expect
        .element(page.getByRole('textbox', { name: 'Title' }))
        .toHaveValue('Draft Title');
      await expect
        .element(page.getByRole('textbox', { name: /content/i }))
        .toHaveTextContent('Draft Content');
    });

    it('should not save draft when title and content are both empty', async () => {
      await render(Page);
      await expect
        .element(page.getByRole('button', { name: 'Save draft' }))
        .toBeDisabled();

      const setItemSpy = vi.spyOn(Storage.prototype, 'setItem');

      const button = document.querySelector(
        'button[type="button"]',
      ) as HTMLButtonElement;
      button.disabled = false;
      button.click();

      expect(setItemSpy).not.toHaveBeenCalled();
    });

    it('should save draft to localStorage', async () => {
      await render(Page);

      await page.getByRole('textbox', { name: 'Title' }).fill('Hello');
      await page.getByRole('button', { name: 'Save draft' }).click();

      expect(localStorage.getItem('DRAFT_POST')).toBe(
        JSON.stringify({ title: 'Hello', content: '' }),
      );
      expect(saveDraftImages).not.toHaveBeenCalled();
      expect(clearDraftImages).toHaveBeenCalled();
      expect(saveDraftVideos).not.toHaveBeenCalled();
      expect(clearDraftVideos).toHaveBeenCalled();
    });

    it('should navigate to post detail on successful submission', async () => {
      stubGlobalFetch<CreatePostApiResponse>({
        response: {
          success: true,
          data: mockPost,
          error: null,
        },
      });
      localStorage.setItem(
        'DRAFT_POST',
        JSON.stringify({ title: 'A', content: 'B' }),
      );
      await render(Page);

      await submitForm();

      expect(gotoMock).toHaveBeenCalledWith(`/posts/${mockPost.id}`);
      expect(localStorage.getItem('DRAFT_POST')).toBeNull();
      expect(clearDraftImages).toHaveBeenCalled();
      expect(clearDraftVideos).toHaveBeenCalled();
    });

    it('should handle corrupted localStorage data gracefully', async () => {
      localStorage.setItem('DRAFT_POST', 'not-valid-json');
      const consoleErrorSpy = vi
        .spyOn(console, 'error')
        .mockImplementation(() => {});
      await render(Page);

      await expect
        .element(page.getByRole('textbox', { name: 'Title' }))
        .toHaveValue('');
      expect(consoleErrorSpy).toHaveBeenCalledWith(
        'Failed to load draft post from localStorage or IndexedDB:',
        expect.any(Error),
      );
    });

    it('should not navigate on API error response', async () => {
      localStorage.setItem(
        'DRAFT_POST',
        JSON.stringify({ title: 'Draft Title', content: 'Draft Content' }),
      );
      stubGlobalFetch<CreatePostApiResponse>({
        response: {
          success: false,
          data: null,
          error: {
            code: 'INVALID_REQUEST',
            message: 'Invalid input data.',
            details: null,
          },
        },
        options: { status: 400 },
      });
      await render(Page);

      await submitForm();

      expect(gotoMock).not.toHaveBeenCalled();
    });
  });

  describe('Image handling', () => {
    it('should register image and clear error when handleImageAdd is called', async () => {
      await render(Page);

      await vi.waitFor(() => {
        expect(capturedOnImageAdd).toBeDefined();
      });

      const mockFile = new File(['test'], 'test.png', { type: 'image/png' });
      const blobUrl = 'blob:http://localhost/test-image';

      capturedOnImageAdd?.(mockFile, blobUrl);

      expect(mockImageManager.registerImage).toHaveBeenCalledWith(
        mockFile,
        blobUrl,
      );
    });

    it('should display image error when handleImageError is called', async () => {
      await render(Page);

      await vi.waitFor(() => {
        expect(capturedOnImageError).toBeDefined();
      });

      capturedOnImageError?.('Failed to upload image');

      await expect
        .element(page.getByText('Failed to upload image'))
        .toBeInTheDocument();
    });

    it('should save pending images to draft when saving draft with images', async () => {
      const pendingImages = [
        createMockPendingImage('blob:http://localhost/image1'),
      ];
      mockImageManager.getPendingImages.mockReturnValue(pendingImages);

      await render(Page);

      await page.getByRole('textbox', { name: 'Title' }).fill('Hello');
      await page.getByRole('button', { name: 'Save draft' }).click();

      expect(saveDraftImages).toHaveBeenCalledWith(pendingImages);
    });

    it('should warn when saving draft images fails', async () => {
      const pendingImages = [
        createMockPendingImage('blob:http://localhost/image1'),
      ];
      mockImageManager.getPendingImages.mockReturnValue(pendingImages);
      vi.mocked(saveDraftImages).mockRejectedValue(
        new Error('IndexedDB error'),
      );
      const consoleWarnSpy = vi
        .spyOn(console, 'warn')
        .mockImplementation(() => {});

      await render(Page);

      await page.getByRole('textbox', { name: 'Title' }).fill('Hello');
      await page.getByRole('button', { name: 'Save draft' }).click();

      expect(consoleWarnSpy).toHaveBeenCalledWith(
        'Failed to save draft images:',
        expect.any(Error),
      );
    });

    it('should upload images and replace URLs on submit when pending images exist', async () => {
      const urlMap = new Map([
        ['blob:http://localhost/image1', 'https://r2.example.com/image1.png'],
      ]);
      mockImageManager.hasPending = true;
      mockImageManager.uploadAll.mockResolvedValue(urlMap);

      localStorage.setItem(
        'DRAFT_POST',
        JSON.stringify({
          title: 'Test',
          content: '![image](blob:http://localhost/image1)',
        }),
      );

      stubGlobalFetch<CreatePostApiResponse>({
        response: {
          success: true,
          data: mockPost,
          error: null,
        },
      });
      await render(Page);

      await submitForm();

      expect(mockImageManager.uploadAll).toHaveBeenCalled();
      expect(gotoMock).toHaveBeenCalledWith(`/posts/${mockPost.id}`);
    });

    it('should warn when clearing draft images after submit fails', async () => {
      vi.mocked(clearDraftImages).mockRejectedValue(
        new Error('Failed to clear'),
      );
      const consoleWarnSpy = vi
        .spyOn(console, 'warn')
        .mockImplementation(() => {});

      stubGlobalFetch<CreatePostApiResponse>({
        response: {
          success: true,
          data: mockPost,
          error: null,
        },
      });
      localStorage.setItem(
        'DRAFT_POST',
        JSON.stringify({ title: 'A', content: 'B' }),
      );
      await render(Page);

      await submitForm();

      expect(consoleWarnSpy).toHaveBeenCalledWith(
        'Failed to clear draft images or videos after submit:',
        expect.any(Error),
      );
      expect(gotoMock).toHaveBeenCalledWith(`/posts/${mockPost.id}`);
    });

    it('should restore saved images from IndexedDB on mount', async () => {
      const savedImage = {
        blobUrl: 'blob:http://localhost/old-image',
        file: new File(['test'], 'saved.png', { type: 'image/png' }),
      };
      vi.mocked(loadDraftImages).mockResolvedValue([savedImage]);

      const pendingImages = [
        createMockPendingImage('blob:http://localhost/image1'),
      ];
      mockImageManager.getPendingImages.mockReturnValue(pendingImages);

      vi.stubGlobal(
        'URL',
        Object.assign({}, URL, {
          createObjectURL: vi.fn(() => 'blob:http://localhost/new-image'),
        }),
      );

      localStorage.setItem(
        'DRAFT_POST',
        JSON.stringify({
          title: 'Draft',
          content: '![image](blob:http://localhost/old-image)',
        }),
      );

      await render(Page);

      await vi.waitFor(() => {
        expect(mockImageManager.registerImage).toHaveBeenCalledWith(
          savedImage.file,
          'blob:http://localhost/new-image',
        );
      });

      expect(localStorage.getItem('DRAFT_POST')).toContain(
        'blob:http://localhost/new-image',
      );
      expect(clearDraftImages).toHaveBeenCalled();
      expect(saveDraftImages).toHaveBeenCalledWith(pendingImages);
    });

    it('should clear draft images when no saved images exist', async () => {
      vi.mocked(loadDraftImages).mockResolvedValue([]);

      await render(Page);

      await vi.waitFor(() => {
        expect(clearDraftImages).toHaveBeenCalled();
      });
    });

    it('should not save draft images when restored images result in empty pending list', async () => {
      const savedImage = {
        blobUrl: 'blob:http://localhost/old-image',
        file: new File(['test'], 'saved.png', { type: 'image/png' }),
      };
      vi.mocked(loadDraftImages).mockResolvedValue([savedImage]);
      mockImageManager.getPendingImages.mockReturnValue([]);

      vi.stubGlobal(
        'URL',
        Object.assign({}, URL, {
          createObjectURL: vi.fn(() => 'blob:http://localhost/new-image'),
        }),
      );

      localStorage.setItem(
        'DRAFT_POST',
        JSON.stringify({
          title: 'Draft',
          content: '![image](blob:http://localhost/old-image)',
        }),
      );

      await render(Page);

      await vi.waitFor(() => {
        expect(mockImageManager.registerImage).toHaveBeenCalled();
      });

      expect(saveDraftImages).not.toHaveBeenCalled();
    });
  });

  describe('Video handling', () => {
    it('should register video and clear error when handleVideoAdd is called', async () => {
      await render(Page);

      await vi.waitFor(() => {
        expect(capturedOnVideoAdd).toBeDefined();
      });

      const mockFile = new File(['test'], 'test.mp4', { type: 'video/mp4' });
      const blobUrl = 'blob:http://localhost/test-video';

      capturedOnVideoAdd?.(mockFile, blobUrl);

      expect(mockVideoManager.queueVideo).toHaveBeenCalledWith(
        mockFile,
        blobUrl,
      );
    });

    it('should display video error when handleVideoError is called', async () => {
      await render(Page);

      await vi.waitFor(() => {
        expect(capturedOnVideoError).toBeDefined();
      });

      capturedOnVideoError?.('Failed to upload video');

      await expect
        .element(page.getByText('Failed to upload video'))
        .toBeInTheDocument();
    });

    it('should save pending videos to draft when saving draft with videos', async () => {
      const pendingVideos = [
        createMockPendingVideo('blob:http://localhost/video1'),
      ];
      mockVideoManager.getPendingVideos.mockReturnValue(pendingVideos);

      await render(Page);

      await page.getByRole('textbox', { name: 'Title' }).fill('Hello');
      await page.getByRole('button', { name: 'Save draft' }).click();

      expect(saveDraftVideos).toHaveBeenCalledWith(pendingVideos);
    });

    it('should warn when saving draft videos fails', async () => {
      const pendingVideos = [
        createMockPendingVideo('blob:http://localhost/video1'),
      ];
      mockVideoManager.getPendingVideos.mockReturnValue(pendingVideos);
      vi.mocked(saveDraftVideos).mockRejectedValue(
        new Error('IndexedDB error'),
      );
      const consoleWarnSpy = vi
        .spyOn(console, 'warn')
        .mockImplementation(() => {});

      await render(Page);

      await page.getByRole('textbox', { name: 'Title' }).fill('Hello');
      await page.getByRole('button', { name: 'Save draft' }).click();

      expect(consoleWarnSpy).toHaveBeenCalledWith(
        'Failed to save draft videos:',
        expect.any(Error),
      );
    });

    it('should upload videos and replace URLs on submit when pending videos exist', async () => {
      const urlMap = new Map([
        ['blob:http://localhost/video1', 'https://r2.example.com/video1.mp4'],
      ]);
      mockVideoManager.hasPending = true;
      mockVideoManager.uploadAll.mockResolvedValue(urlMap);

      localStorage.setItem(
        'DRAFT_POST',
        JSON.stringify({
          title: 'Test',
          content: '![video](blob:http://localhost/video1)',
        }),
      );

      stubGlobalFetch<CreatePostApiResponse>({
        response: {
          success: true,
          data: mockPost,
          error: null,
        },
      });
      await render(Page);

      await submitForm();

      expect(mockVideoManager.uploadAll).toHaveBeenCalled();
      expect(gotoMock).toHaveBeenCalledWith(`/posts/${mockPost.id}`);
    });

    it('should warn when clearing draft videos after submit fails', async () => {
      vi.mocked(clearDraftVideos).mockRejectedValue(
        new Error('Failed to clear'),
      );
      const consoleWarnSpy = vi
        .spyOn(console, 'warn')
        .mockImplementation(() => {});

      stubGlobalFetch<CreatePostApiResponse>({
        response: {
          success: true,
          data: mockPost,
          error: null,
        },
      });
      localStorage.setItem(
        'DRAFT_POST',
        JSON.stringify({ title: 'A', content: 'B' }),
      );
      await render(Page);

      await submitForm();

      expect(consoleWarnSpy).toHaveBeenCalledWith(
        'Failed to clear draft images or videos after submit:',
        expect.any(Error),
      );
      expect(gotoMock).toHaveBeenCalledWith(`/posts/${mockPost.id}`);
    });

    it('should restore saved videos from IndexedDB on mount', async () => {
      const savedVideo = {
        blobUrl: 'blob:http://localhost/old-video',
        file: new File(['test'], 'saved.mp4', { type: 'video/mp4' }),
      };
      vi.mocked(loadDraftVideos).mockResolvedValue([savedVideo]);

      const pendingVideos = [
        createMockPendingVideo('blob:http://localhost/video1'),
      ];
      mockVideoManager.getPendingVideos.mockReturnValue(pendingVideos);

      vi.stubGlobal(
        'URL',
        Object.assign({}, URL, {
          createObjectURL: vi.fn(() => 'blob:http://localhost/new-video'),
        }),
      );

      localStorage.setItem(
        'DRAFT_POST',
        JSON.stringify({
          title: 'Draft',
          content: '![video](blob:http://localhost/old-video)',
        }),
      );

      await render(Page);

      await vi.waitFor(() => {
        expect(mockVideoManager.queueVideo).toHaveBeenCalledWith(
          savedVideo.file,
          'blob:http://localhost/new-video',
        );
      });

      expect(localStorage.getItem('DRAFT_POST')).toContain(
        'blob:http://localhost/new-video',
      );
      expect(clearDraftVideos).toHaveBeenCalled();
      expect(saveDraftVideos).toHaveBeenCalledWith(pendingVideos);
    });

    it('should clear draft videos when no saved videos exist', async () => {
      vi.mocked(loadDraftVideos).mockResolvedValue([]);

      await render(Page);

      await vi.waitFor(() => {
        expect(clearDraftVideos).toHaveBeenCalled();
      });
    });

    it('should not save draft videos when restored videos result in empty pending list', async () => {
      const savedVideo = {
        blobUrl: 'blob:http://localhost/old-video',
        file: new File(['test'], 'saved.mp4', { type: 'video/mp4' }),
      };
      vi.mocked(loadDraftVideos).mockResolvedValue([savedVideo]);
      mockVideoManager.getPendingVideos.mockReturnValue([]);

      vi.stubGlobal(
        'URL',
        Object.assign({}, URL, {
          createObjectURL: vi.fn(() => 'blob:http://localhost/new-video'),
        }),
      );

      localStorage.setItem(
        'DRAFT_POST',
        JSON.stringify({
          title: 'Draft',
          content: '![video](blob:http://localhost/old-video)',
        }),
      );

      await render(Page);

      await vi.waitFor(() => {
        expect(mockVideoManager.queueVideo).toHaveBeenCalled();
      });

      expect(saveDraftVideos).not.toHaveBeenCalled();
    });
  });
});

async function submitForm(): Promise<void> {
  await page.getByRole('textbox', { name: 'Title' }).fill('Hello');
  await page.getByRole('button', { name: 'Submit' }).click();
}
