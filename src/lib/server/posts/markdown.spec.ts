import { expect, it } from 'vitest';

import { renderPostMarkdown, renderPublicPostMarkdown } from './markdown';

it('reserves h1 for the public post title while keeping the Markdown heading hierarchy', () => {
  const html = renderPublicPostMarkdown('# Section\n\n## Subsection');
  expect(html).toContain('<h2>Section</h2>');
  expect(html).toContain('<h3>Subsection</h3>');
  expect(renderPublicPostMarkdown('## First heading')).toContain(
    '<h2>First heading</h2>',
  );
});

it('renders editor Markdown including a GFM table and escaped code', () => {
  const html = renderPostMarkdown(
    [
      '# 제목',
      '',
      '| Name | Value |',
      '| --- | --- |',
      '| **Bold** | ~~old~~ |',
      '',
      '- [x] Done',
      '',
      '```html',
      '<strong>code</strong>',
      '```',
    ].join('\n'),
  );
  expect(html).toContain('<h1>제목</h1>');
  expect(html).toContain('<table>');
  expect(html).toContain('<del>old</del>');
  expect(html).toContain('type="checkbox"');
  expect(html).toMatch(
    /<code class="language-html">(?:&lt;|&#x3C;)strong>code(?:&lt;|&#x3C;)\/strong>/i,
  );
});

it('keeps generated footnote references and destinations in sync', () => {
  const html = renderPostMarkdown('Note[^one]\n\n[^one]: Footnote');
  expect(html).toContain('href="#user-content-fn-one"');
  expect(html).toContain('id="user-content-fn-one"');
  expect(html).toContain('href="#user-content-fnref-one"');
  expect(html).toContain('id="user-content-fnref-one"');
});

it('drops raw HTML and disallowed URL schemes while keeping safe links', () => {
  const html = renderPostMarkdown(
    [
      '<div id="editor">raw block</div>',
      '',
      'Inline <span onclick="noop()">text</span>',
      '',
      '[Unsafe](javascript:void%280%29) and [Safe](https://example.com)',
      '',
      '![Unsafe image](data:image/png;base64,AA)',
    ].join('\n'),
  );
  expect(html).not.toMatch(/<div|<span|onclick|javascript:|data:image/);
  expect(html).toContain('<a href="https://example.com">Safe</a>');
  expect(html).toContain('Inline text');
});
