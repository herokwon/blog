import { createTestContent } from './content';

describe('[Test/Fixtures] createTestContent', () => {
  it('creates content with default values', () => {
    const content = createTestContent();

    expect(content).toMatchObject({
      status: 'draft',
      slug: null,
      title: 'Test Content',
      body: '# Test Content',
      publishedAt: null,
      deletedAt: null,
    });
  });

  it('generates a unique UUIDv7 for each content', () => {
    const first = createTestContent();
    const second = createTestContent();

    expect(first.id).not.toBe(second.id);
  });

  it('creates content with the provided overrides', () => {
    const content = createTestContent({
      status: 'published',
      slug: 'test-content',
      title: 'Overridden title',
    });

    expect(content.status).toBe('published');
    expect(content.slug).toBe('test-content');
    expect(content.title).toBe('Overridden title');
  });
});
