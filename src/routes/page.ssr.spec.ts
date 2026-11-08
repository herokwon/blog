import { render } from 'svelte/server';
import { describe, expect, it } from 'vitest';
import Page from './+page.svelte';

describe('homepage server rendering', () => {
  it('includes the page heading in server-rendered HTML', () => {
    const { body } = render(Page, {
      props: {
        params: {},
        form: null,
        data: {
          posts: [
            {
              title: '<script>title</script>',
              slug: 'safe-title',
              category: 'Notes',
              publishedAt: '2026-11-08T00:00:00.000Z',
            },
          ],
          page: 1,
          hasNext: false,
        },
      },
    });
    expect(body).toContain('<h1>Personal Blog</h1>');
    expect(body).toContain('/posts/safe-title');
    expect(body).toContain('&lt;script>title&lt;/script>');
  });
});
