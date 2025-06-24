import { existsSync, readFileSync } from 'fs';
import { resolve } from 'path';

describe('Index 페이지', () => {
  const indexPath = resolve(__dirname, '../pages/index.astro');
  let content: string;

  beforeAll(() => {
    expect(existsSync(indexPath)).toBe(true);
    content = readFileSync(indexPath, 'utf-8');
  });

  it('HTML 구조에 필요한 구성 요소가 모두 있습니다.', () => {
    expect(content).toContain('<html lang="en">');
    expect(content).toContain('<head>');
    expect(content).toContain('<body>');
    expect(content).toContain('</html>');
  });

  it('메타 태그가 올바르게 설정되어 있습니다.', () => {
    expect(content).toContain('<meta charset="utf-8"');
    expect(content).toContain(
      '<meta name="viewport" content="width=device-width"',
    );
    expect(content).toContain(
      '<meta name="generator" content={Astro.generator}',
    );
  });

  it('파비콘이 설정되어 있습니다.', () => {
    expect(content).toContain(
      '<link rel="icon" type="image/svg+xml" href="/favicon.svg"',
    );
  });

  it('페이지 제목이 있습니다.', () => {
    expect(content).toContain('<title>Astro</title>');
  });

  it('메인 제목이 있습니다.', () => {
    expect(content).toContain('<h1>Astro</h1>');
  });

  it('전역 스타일시트를 불러옵니다.', () => {
    expect(content).toContain("import '@styles/globals.css';");
  });

  it('Astro 프런트매터가 있다', () => {
    expect(content).toMatch(/^---[\s\S]*?---/);
  });

  it('HTML 요소들이 올바른 순서로 배치되어 있습니다', () => {
    const htmlIndex = content.indexOf('<html');
    const headIndex = content.indexOf('<head>');
    const bodyIndex = content.indexOf('<body>');
    const titleIndex = content.indexOf('<title>');
    const h1Index = content.indexOf('<h1>');

    expect(htmlIndex).toBeLessThan(headIndex);
    expect(headIndex).toBeLessThan(bodyIndex);
    expect(headIndex).toBeLessThan(titleIndex);
    expect(bodyIndex).toBeLessThan(h1Index);
  });
});
