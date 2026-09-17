import { resolve } from 'node:path';
import { generateOpenApi } from './generate-openapi';

generateOpenApi({
  outputPath: resolve('docs/openapi.json'),
});
