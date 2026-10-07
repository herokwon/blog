import { describe, expect, it } from 'vitest';
import { inspectMarkdown, isAllowedLink, readingMarkdown } from './policy';

describe('Markdown policy', () => {
  it('does not promote shadowed definitions into clickable reading links', () => {
    expect(
      readingMarkdown('[link][x]\n\n[x]: javascript:alert(1)\n[x]: /safe'),
    ).toBe('link\n');
    expect(
      readingMarkdown('> [ref]: javascript:alert(1)\n>\n> [link][ref]'),
    ).toBe('> link\n');
  });
  it('accepts every supported construct and unknown code languages', () => {
    const source =
      '# Heading\n\n**bold** *italic* ~~strike~~ `inline`\n\n> quote\n\n---\n\n1. ordered\n\n- bullet\n- [x] task\n\n[link](/posts)\n\n| A | B |\n| --- | --- |\n| a | b |\n\n```unknown-language\n<script>code only</script>\n```';
    expect(inspectMarkdown(source)).toEqual({ supported: true, reasons: [] });
  });
  it.each([
    ['> [ref]: javascript:alert(1)\n>\n> [link][ref]', 'links'],
    ['[link][x]\n\n[x]: javascript:alert(1)\n[x]: /safe', 'links'],
    ['paragraph ![image](/x) tail', 'images'],
    ['![reference][image]\n\n[image]: /x', 'images'],
    ['paragraph <img src=x onerror=alert(1)> tail', 'HTML'],
    ['<!-- hidden -->\n\nnormal', 'HTML'],
    ['text[^note]\n\n[^note]: footnote', 'footnotes'],
    ['[unsafe](javascript:alert%281%29)', 'links'],
    ['[unsafe][u]\n\n[u]: //evil.test', 'links'],
  ])('rejects mixed source %s', (source, reason) => {
    expect(inspectMarkdown(source).supported).toBe(false);
    expect(inspectMarkdown(source).reasons.join(' ')).toContain(reason);
  });
  it.each([
    'https://example.com/a',
    'http://example.com',
    'mailto:a@example.com',
    '/posts/x',
    '#section',
  ])('allows %s', url => {
    expect(isAllowedLink(url)).toBe(true);
  });
  it.each([
    '//evil.test',
    '/\\evil.test',
    '\\evil.test',
    ' javascript:alert(1)',
    'java\tscript:alert(1)',
    'https:\\evil.test',
    'https:evil.test',
    '/\nevil.test',
    'data:text/html,x',
    'file:///x',
    'relative/path',
    '',
    ' JAVASCRIPT&#58;alert(1)',
  ])('rejects URL bypass %s', url => {
    expect(isAllowedLink(url)).toBe(false);
  });
});
