import { afterEach, describe, expect, it, vi } from 'vitest';

import {
  clearDraftImages,
  loadDraftImages,
  saveDraftImages,
} from '$lib/services';
import {
  createMockPendingImage,
  createMockPost,
  stubGlobalFetch,
} from '$lib/test-utils';
import type { CreatePostApiResponse } from '$lib/types/api';
import { render } from 'vitest-browser-svelte';
import { page } from 'vitest/browser';

import Page from './+page.svelte';

const { gotoMock, mockImageManager } = vi.hoisted(() => ({
  gotoMock: vi.fn(),
  mockImageManager: {
    registerImage: vi.fn(),
    getPendingImages: vi.fn().mockReturnValue([]),
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

vi.mock('$lib/services/draft-storage', () => ({
  saveDraftImages: vi.fn().mockResolvedValue(undefined),
  loadDraftImages: vi.fn().mockResolvedValue([]),
  clearDraftImages: vi.fn().mockResolvedValue(undefined),
}));

let capturedOnImageAdd: ((file: File, blobUrl: string) => void) | undefined;
let capturedOnImageError: ((error: string) => void) | undefined;

vi.mock('$lib/components/editor/config', () => ({
  createMilkdownEditor: vi.fn(
    async (options: {
      root: HTMLElement;
      defaultValue: string;
      onChange?: (markdown: string) => void;
      readOnly?: boolean;
      onImageAdd?: (file: File, blobUrl: string) => void;
      onImageError?: (error: string) => void;
    }) => {
      capturedOnImageAdd = options.onImageAdd;
      capturedOnImageError = options.onImageError;

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
    capturedOnImageAdd = undefined;
    capturedOnImageError = undefined;
    vi.mocked(loadDraftImages).mockReset().mockResolvedValue([]);
    vi.mocked(saveDraftImages).mockReset().mockResolvedValue(undefined);
    vi.mocked(clearDraftImages).mockReset().mockResolvedValue(undefined);
  });

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

  it('should register image and clear error when handleImageAdd is called', async () => {
    await render(Page);

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
    vi.mocked(saveDraftImages).mockRejectedValue(new Error('IndexedDB error'));
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
    vi.mocked(clearDraftImages).mockRejectedValue(new Error('Failed to clear'));
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
      'Failed to clear draft images after submit:',
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

async function submitForm(): Promise<void> {
  await page.getByRole('textbox', { name: 'Title' }).fill('Hello');
  await page.getByRole('button', { name: 'Submit' }).click();
}
