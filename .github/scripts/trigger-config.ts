import { readFileSync, writeFileSync } from 'node:fs';
import { dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import ts from 'typescript';

export function generateTriggerConfig(source: string, output: string) {
  source = resolve(source);
  output = resolve(output);
  if (source === output || dirname(source) !== dirname(output)) {
    throw new Error(
      'Trigger configuration must be a separate file beside the source',
    );
  }
  const parsed = ts.parseConfigFileTextToJson(
    source,
    readFileSync(source, 'utf8'),
  );
  if (parsed.error)
    throw new Error(
      ts.flattenDiagnosticMessageText(parsed.error.messageText, '\n'),
    );
  if (
    !parsed.config ||
    typeof parsed.config !== 'object' ||
    Array.isArray(parsed.config)
  ) {
    throw new Error('Wrangler configuration must be a JSON object');
  }
  const config = { ...parsed.config };
  delete config.assets;
  writeFileSync(output, JSON.stringify(config, null, 2) + '\n');
}

if (
  process.argv[1] &&
  fileURLToPath(import.meta.url) === resolve(process.argv[1])
) {
  generateTriggerConfig(
    resolve('wrangler.jsonc'),
    resolve('wrangler.trigger.json'),
  );
}
