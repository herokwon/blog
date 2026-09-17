import { isUuidv7 } from './uuid';

describe('[Utils] UUID', () => {
  describe('isUuidv7', () => {
    it('returns true for a valid UUID v7', () => {
      expect(isUuidv7('0198f7b1-1234-7abc-8def-123456789abc')).toBe(true);
    });

    it('returns false for a valid UUIDv4', () => {
      expect(isUuidv7('0198f7b1-1234-4abc-8def-123456789abc')).toBe(false);
    });

    it('returns false for an invalid UUID', () => {
      expect(isUuidv7('not-a-uuid')).toBe(false);
    });
  });
});
