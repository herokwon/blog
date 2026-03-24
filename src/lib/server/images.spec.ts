import { describe, expect, it, vi } from 'vitest';

import { createMockR2 } from '$lib/test-utils';

import {
  deleteImagesFromR2,
  extractImageKeysFromContent,
  getImageKeysToDelete,
} from './images';

describe('[Server/Images] extractImageKeysFromContent', () => {
  it('should extract single image key from markdown', () => {
    const content = '![image](/api/images/posts/images/test-123.png)';
    const result = extractImageKeysFromContent(content);

    expect(result).toEqual(['posts/images/test-123.png']);
  });

  it('should extract multiple image keys from markdown', () => {
    const content = `
      # Post Title
      ![img1](/api/images/posts/images/a.png)
      Some text here
      ![img2](/api/images/posts/images/b.jpg)
    `;
    const result = extractImageKeysFromContent(content);

    expect(result).toEqual(['posts/images/a.png', 'posts/images/b.jpg']);
  });

  it('should deduplicate duplicate images', () => {
    const content = `
      ![img](/api/images/posts/images/same.png)
      More content
      ![img again](/api/images/posts/images/same.png)
    `;
    const result = extractImageKeysFromContent(content);

    expect(result).toEqual(['posts/images/same.png']);
  });

  it('should ignore external image URLs', () => {
    const content = `
      ![local](/api/images/posts/images/local.png)
      ![external](https://example.com/image.png)
      ![https](https://cdn.example.com/photo.jpg)
      ![data](data:image/png;base64,iVBORw0KGgo...)
    `;
    const result = extractImageKeysFromContent(content);

    expect(result).toEqual(['posts/images/local.png']);
  });

  it('should ignore images not under posts/images prefix', () => {
    const content = `
      ![valid](/api/images/posts/images/valid.png)
      ![other](/api/images/other/path/invalid.png)
      ![assets](/api/images/assets/logo.png)
    `;
    const result = extractImageKeysFromContent(content);

    expect(result).toEqual(['posts/images/valid.png']);
  });

  it('should return empty array when no images found', () => {
    const content = `
      # Post Title
      Just text content with no images.
    `;
    const result = extractImageKeysFromContent(content);

    expect(result).toEqual([]);
  });

  it('should handle edge cases in markdown', () => {
    const content = `
      ![valid](/api/images/posts/images/valid.png)
      ![empty alt]()/api/images/posts/images/not-in-link.png)
      Text with /api/images/posts/images/not-in-markdown.png
      \`\`\`
      ![code block](/api/images/posts/images/in-code.png)
      \`\`\`
    `;
    const result = extractImageKeysFromContent(content);

    // Only properly formatted markdown images should be extracted
    // Code blocks and plain text URLs are ignored by the regex
    expect(result).toContain('posts/images/valid.png');
  });

  it('should handle empty content', () => {
    const result = extractImageKeysFromContent('');

    expect(result).toEqual([]);
  });
});

describe('[Server/Images] deleteImagesFromR2', () => {
  it('should delete all provided keys', async () => {
    const { bucket, spies } = createMockR2();
    spies.delete.mockResolvedValue(undefined);

    const keys = ['posts/images/a.png', 'posts/images/b.jpg'];
    await deleteImagesFromR2(bucket, keys);

    expect(spies.delete).toHaveBeenCalledTimes(2);
    expect(spies.delete).toHaveBeenCalledWith('posts/images/a.png');
    expect(spies.delete).toHaveBeenCalledWith('posts/images/b.jpg');
  });

  it('should call bucket.delete() for each key', async () => {
    const { bucket, spies } = createMockR2();
    spies.delete.mockResolvedValue(undefined);

    const keys = ['posts/images/test.png'];
    await deleteImagesFromR2(bucket, keys);

    expect(spies.delete).toHaveBeenCalledWith('posts/images/test.png');
  });

  it('should continue deleting even if one fails', async () => {
    const { bucket, spies } = createMockR2();

    // First deletion fails, second succeeds
    spies.delete
      .mockRejectedValueOnce(new Error('R2 error'))
      .mockResolvedValueOnce(undefined);

    const consoleError = vi
      .spyOn(console, 'error')
      .mockImplementation(() => {});

    const keys = ['posts/images/fail.png', 'posts/images/success.png'];
    await deleteImagesFromR2(bucket, keys);

    expect(spies.delete).toHaveBeenCalledTimes(2);
    expect(consoleError).toHaveBeenCalledWith(
      '[R2] Failed to delete image: posts/images/fail.png',
      expect.any(Error),
    );

    consoleError.mockRestore();
  });

  it('should handle empty keys array (no-op)', async () => {
    const { bucket, spies } = createMockR2();

    await deleteImagesFromR2(bucket, []);

    expect(spies.delete).not.toHaveBeenCalled();
  });

  it('should log errors but not throw', async () => {
    const { bucket, spies } = createMockR2();
    spies.delete.mockRejectedValue(new Error('R2 error'));

    const consoleError = vi
      .spyOn(console, 'error')
      .mockImplementation(() => {});

    await expect(
      deleteImagesFromR2(bucket, ['posts/images/test.png']),
    ).resolves.not.toThrow();

    expect(consoleError).toHaveBeenCalled();
    consoleError.mockRestore();
  });

  it('should log deletion attempt', async () => {
    const { bucket, spies } = createMockR2();
    spies.delete.mockResolvedValue(undefined);

    const consoleLog = vi.spyOn(console, 'log').mockImplementation(() => {});

    const keys = ['posts/images/a.png', 'posts/images/b.png'];
    await deleteImagesFromR2(bucket, keys);

    expect(consoleLog).toHaveBeenCalledWith('[R2] Deleting 2 image(s):', keys);

    consoleLog.mockRestore();
  });
});

describe('[Server/Images] getImageKeysToDelete', () => {
  it('should return keys that exist in old but not new', () => {
    const oldContent = `
      ![img1](/api/images/posts/images/a.png)
      ![img2](/api/images/posts/images/b.png)
    `;
    const newContent = `
      ![img1](/api/images/posts/images/a.png)
    `;
    const result = getImageKeysToDelete(oldContent, newContent);

    expect(result).toEqual(['posts/images/b.png']);
  });

  it('should return empty array when no images removed', () => {
    const content = `
      ![img1](/api/images/posts/images/a.png)
      ![img2](/api/images/posts/images/b.png)
    `;
    const result = getImageKeysToDelete(content, content);

    expect(result).toEqual([]);
  });

  it('should handle when new content has additional images', () => {
    const oldContent = `
      ![img1](/api/images/posts/images/a.png)
    `;
    const newContent = `
      ![img1](/api/images/posts/images/a.png)
      ![img2](/api/images/posts/images/b.png)
    `;
    const result = getImageKeysToDelete(oldContent, newContent);

    // No images were removed (a new one was added)
    expect(result).toEqual([]);
  });

  it('should handle complete content replacement', () => {
    const oldContent = `
      ![old1](/api/images/posts/images/old1.png)
      ![old2](/api/images/posts/images/old2.png)
    `;
    const newContent = `
      ![new1](/api/images/posts/images/new1.png)
      ![new2](/api/images/posts/images/new2.png)
    `;
    const result = getImageKeysToDelete(oldContent, newContent);

    expect(result).toContain('posts/images/old1.png');
    expect(result).toContain('posts/images/old2.png');
    expect(result).toHaveLength(2);
  });

  it('should handle empty old content', () => {
    const oldContent = '';
    const newContent = `
      ![img](/api/images/posts/images/new.png)
    `;
    const result = getImageKeysToDelete(oldContent, newContent);

    expect(result).toEqual([]);
  });

  it('should handle empty new content', () => {
    const oldContent = `
      ![img1](/api/images/posts/images/a.png)
      ![img2](/api/images/posts/images/b.png)
    `;
    const newContent = '';
    const result = getImageKeysToDelete(oldContent, newContent);

    expect(result).toContain('posts/images/a.png');
    expect(result).toContain('posts/images/b.png');
    expect(result).toHaveLength(2);
  });

  it('should handle mix of removed, kept, and added images', () => {
    const oldContent = `
      ![remove](/api/images/posts/images/remove.png)
      ![keep](/api/images/posts/images/keep.png)
    `;
    const newContent = `
      ![keep](/api/images/posts/images/keep.png)
      ![add](/api/images/posts/images/add.png)
    `;
    const result = getImageKeysToDelete(oldContent, newContent);

    expect(result).toEqual(['posts/images/remove.png']);
  });
});
