/**
 * Extracts R2 image keys from markdown content.
 * Only extracts images under the 'posts/images/' prefix.
 * External URLs (http://, https://, data:) are ignored.
 *
 * @param content - Markdown content containing image references
 * @returns Array of unique R2 image keys (e.g., ['posts/images/uuid.png'])
 */
export function extractImageKeysFromContent(content: string): string[] {
  const imagePattern = /!\[.*?\]\((\/api\/images\/(posts\/images\/[^)]+))\)/g;
  const keys = new Set<string>();

  let match;
  while ((match = imagePattern.exec(content)) !== null) {
    // Capture group 2 contains the R2 key path
    keys.add(match[2]);
  }

  return Array.from(keys);
}

/**
 * Deletes multiple images from R2 bucket.
 * This function is fail-safe: it logs errors but never throws.
 * Individual deletion failures don't stop other deletions.
 *
 * @param bucket - R2 bucket instance
 * @param keys - Array of R2 keys to delete
 */
export async function deleteImagesFromR2(
  bucket: R2Bucket,
  keys: string[],
): Promise<void> {
  if (keys.length === 0) return;

  const deletePromises = keys.map(async key => {
    try {
      await bucket.delete(key);
    } catch {
      // Ignore deletion errors
    }
  });

  await Promise.all(deletePromises);
}

/**
 * Calculates which images were removed by comparing old and new content.
 * Returns keys that exist in old content but not in new content.
 *
 * @param oldContent - Original markdown content
 * @param newContent - Updated markdown content
 * @returns Array of R2 keys that should be deleted
 */
export function getImageKeysToDelete(
  oldContent: string,
  newContent: string,
): string[] {
  const oldKeys = new Set(extractImageKeysFromContent(oldContent));
  const newKeys = new Set(extractImageKeysFromContent(newContent));

  const keysToDelete: string[] = [];
  for (const key of oldKeys) {
    if (!newKeys.has(key)) {
      keysToDelete.push(key);
    }
  }

  return keysToDelete;
}
