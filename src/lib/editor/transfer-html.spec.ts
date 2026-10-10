import { describe, expect, it } from 'vitest';
import { validatedTransferHtml } from './transfer-html';

describe('clipboard HTML validation', () => {
  it.each([
    ['list_item', { listType: ['bullet'] }],
    ['list_item', { listType: {} }],
    ['blockquote', { onload: 'alert(1)' }],
    ['bullet_list', { spread: 'false' }],
    ['ordered_list', { order: -1 }],
  ])('rejects invalid context values: %j', (type, attrs) => {
    const context = JSON.stringify([type, attrs]);
    expect(
      validatedTransferHtml(`<p data-pm-slice='1 1 ${context}'>safe</p>`),
    ).toBeNull();
  });
  it.each([
    '<p>safe<frame src="https://evil.test"></p>',
    '<p>safe<frame src="https://evil.test">tail</p>',
    '<p>safe</frame>tail</p>',
    '<svg><a href="https://evil.test">unsafe</a></svg><p>safe</p>',
    '<math><mtext>unsafe</mtext></math><p>safe</p>',
    '<template><img src=x></template><p>safe</p>',
    '<p><a href="java&#x73;cript:alert(1)">unsafe</a></p>',
    '<p><a href="/safe" href="javascript:alert(1)">unsafe</a></p>',
    '<p style="color:red">safe</p>',
    '<p name="location">safe</p>',
    '<p><a href="/safe" target="_blank">safe</a></p>',
    '<p><code class="language-js evil">safe</code></p>',
    '<td>discarded cell</td>',
    '<table><tr><td style="text-align:left;background:url(https://evil.test)">safe</td></tr></table>',
    '<pre data-language="javascript onload=x">safe</pre>',
    '<html><head></head><body><p>safe</p></body></html><body onload=x>',
  ])('rejects the entire unsupported transfer: %s', html => {
    expect(validatedTransferHtml(html)).toBeNull();
  });

  it('canonicalizes supported documents and escaped text without root markup', () => {
    expect(
      validatedTransferHtml(
        '<!DOCTYPE html><html><head></head><body><P><B>bold</B> &lt;script&gt; &amp; <a href="/posts?a=1&amp;b=2" title="link">link</a></P></body></html>',
      ),
    ).toBe(
      '<p><b>bold</b> &lt;script&gt; &amp; <a href="/posts?a=1&amp;b=2" title="link">link</a></p>',
    );
  });

  it('preserves table structure, numeric attributes, list start and literal code', () => {
    expect(
      validatedTransferHtml(
        '<ol start="3"><li>item</li></ol><table><tr><th colspan="2" align="center">header</th></tr><tr><td>x</td><td>y</td></tr></table><pre><code class="language-ts">&lt;script&gt;</code></pre>',
      ),
    ).toBe(
      '<ol start="3"><li>item</li></ol><table><tbody><tr><th colspan="2" align="center">header</th></tr><tr><td>x</td><td>y</td></tr></tbody></table><pre><code class="language-ts">&lt;script&gt;</code></pre>',
    );
  });

  it('does not forward untrusted ProseMirror context metadata', () => {
    expect(
      validatedTransferHtml(
        '<p data-pm-slice=\'1 1 ["html",{"value":"unsafe"}]\'>safe</p>',
      ),
    ).toBeNull();
  });
});
