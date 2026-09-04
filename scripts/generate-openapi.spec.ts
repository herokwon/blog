import { readFile } from 'node:fs';
import { generateOpenApi } from './generate-openapi';

describe('[Script] OpenAPI Generation', () => {
  it('OpenAPI generation produces the expected artifact path', async () => {
    await generateOpenApi();

    let openApiSpec: string | undefined;

    readFile('docs/openapi.json', 'utf-8', (err, data) => {
      if (err) throw err;
      openApiSpec = data;
    });

    const document = JSON.parse(openApiSpec ?? '{}');

    expect(document.openapi).toBe(/^3\./);
    expect(document.paths).toBeDefined();
  });
});
