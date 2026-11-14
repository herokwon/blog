export function escapeXml(value: string) {
  const entities: Record<string, string> = {
    '&': '&amp;',
    '<': '&lt;',
    '>': '&gt;',
    '"': '&quot;',
    "'": '&apos;',
  };
  return value
    .replace(
      // eslint-disable-next-line no-control-regex -- XML 1.0 explicitly permits tab, LF and CR.
      /[^\u0009\u000A\u000D\u0020-\uD7FF\uE000-\uFFFD\u{10000}-\u{10FFFF}]/gu,
      '',
    )
    .replace(/[&<>"']/g, character => entities[character]);
}
