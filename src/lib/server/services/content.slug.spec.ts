import { generateSlug } from './content.slug';

describe('[Server/Service] Content Slug', () => {
  describe('generateSlug', () => {
    it('converts an ASCII title to a lowercase slug', () => {
      expect(generateSlug('Hello World')).toBe('hello-world');
    });

    it('preserves Unicode letters and numbers', () => {
      expect(generateSlug('안녕하세요 세계 2026')).toBe('안녕하세요-세계-2026');
    });

    it('normalizes Unicode characters before generating the slug', () => {
      expect(generateSlug('Ｈｅｌｌｏ Ｗｏｒｌｄ')).toBe('hello-world');
    });

    it('normalizes punctuation and repeated separators', () => {
      expect(generateSlug('Hello,   World!')).toBe('hello-world');
    });

    it('removes unnecessary leading and trailing separators', () => {
      expect(generateSlug('--- Hello World ---')).toBe('hello-world');
    });

    it('preserves explicitly allowlisted symbols', () => {
      expect(generateSlug('C++ Guide')).toBe('c++-guide');
    });

    it('removes slash delimiters', () => {
      expect(generateSlug('Hello/World')).toBe('helloworld');
    });

    it('removes question mark delimiters', () => {
      expect(generateSlug('Hello?World')).toBe('helloworld');
    });

    it('removes hash delimiters', () => {
      expect(generateSlug('Hello#World')).toBe('helloworld');
    });

    it('rejects a title when the normalized slug is empty', () => {
      expect(() => generateSlug('???')).toThrow();
    });
  });
});
