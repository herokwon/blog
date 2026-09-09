import { existsSync, mkdtempSync, readFileSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import packageJson from '../package.json';
import { generateOpenApi } from './generate-openapi';

describe('[Script] OpenAPI Generation', () => {
  const tmpDirs: string[] = [];

  afterEach(() => {
    for (const dir of tmpDirs) {
      rmSync(dir, { recursive: true, force: true });
    }

    tmpDirs.length = 0;
  });

  it('uses the package version for the OpenAPI document', () => {
    const outputDir = mkdtempSync(join(tmpdir(), 'openapi-'));
    tmpDirs.push(outputDir);

    const outputPath = join(outputDir, 'openapi.json');
    const document = generateOpenApi({ outputPath });

    expect(document.info.version).toBe(packageJson.version);
  });

  it('generates an OpenAPI document file at the specified path', () => {
    const outputDir = mkdtempSync(join(tmpdir(), 'openapi-'));
    tmpDirs.push(outputDir);

    const outputPath = join(outputDir, 'openapi.json');

    generateOpenApi({ outputPath });

    expect(existsSync(outputPath)).toBe(true);
  });

  it('writes the generated OpenAPI document as JSON', () => {
    const outputDir = mkdtempSync(join(tmpdir(), 'openapi-'));
    tmpDirs.push(outputDir);

    const outputPath = join(outputDir, 'openapi.json');

    generateOpenApi({ outputPath });

    const document = JSON.parse(readFileSync(outputPath, 'utf8'));

    expect(document).toMatchObject({
      openapi: '3.1.0',
      info: {
        title: 'Blog API',
        version: packageJson.version,
      },
    });
  });
});
