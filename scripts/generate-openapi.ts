import { generateOpenApiDocument } from '$lib/api/openapi/document';
import { writeFileSync } from 'node:fs';

import packageJson from '../package.json';

type GenerateOpenApiOptions = {
  outputPath: string;
};

export function generateOpenApi({ outputPath }: GenerateOpenApiOptions) {
  const document = generateOpenApiDocument({
    version: packageJson.version,
  });

  writeFileSync(outputPath, JSON.stringify(document, null, 2));

  return document;
}
