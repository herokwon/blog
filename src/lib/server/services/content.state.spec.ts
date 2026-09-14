import { assertCanArchive, assertCanPublish } from './content.state';

describe('[Server/Service] Content State Rules', () => {
  describe('assertCanPublish', () => {
    it('allows draft to transition to published', () => {
      expect(() => assertCanPublish('draft')).not.toThrow();
    });

    it('allows archived to transition to published', () => {
      expect(() => assertCanPublish('archived')).not.toThrow();
    });

    it('rejects published to transition to published', () => {
      expect(() => assertCanPublish('published')).toThrow();
    });
  });

  describe('assertCanArchive', () => {
    it('allows published to transition to archived', () => {
      expect(() => assertCanArchive('published')).not.toThrow();
    });

    it('rejects draft to transition to archived', () => {
      expect(() => assertCanArchive('draft')).toThrow();
    });

    it('rejects archived to transition to archived', () => {
      expect(() => assertCanArchive('archived')).toThrow();
    });
  });
});
