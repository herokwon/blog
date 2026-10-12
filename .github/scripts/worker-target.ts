import { appendFileSync, readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import ts from 'typescript';

export interface WorkerTarget {
  name: string;
  databaseName: string;
  databaseId: string;
  adminOrigin: string;
}

function object(value: unknown): Record<string, unknown> {
  if (!value || typeof value !== 'object' || Array.isArray(value)) {
    throw new Error('Worker configuration must contain explicit objects');
  }
  return value as Record<string, unknown>;
}

function string(value: unknown): string {
  if (typeof value !== 'string' || !value.trim() || value !== value.trim()) {
    throw new Error('Worker target settings must be nonempty strings');
  }
  return value;
}

function readTarget(
  config: Record<string, unknown>,
  name: string,
): WorkerTarget {
  if (config.name !== name) throw new Error(`Expected Worker ${name}`);
  const vars = object(config.vars);
  const origin = string(vars.ADMIN_ORIGIN);
  const url = new URL(origin);
  if (url.protocol !== 'https:' || url.origin !== origin) {
    throw new Error('ADMIN_ORIGIN must be an exact HTTPS origin');
  }
  if (!Array.isArray(config.d1_databases))
    throw new Error('Missing D1 bindings');
  const bindings = config.d1_databases
    .map(object)
    .filter(db => db.binding === 'DB');
  if (bindings.length !== 1) throw new Error('Expected exactly one DB binding');
  const db = bindings[0];
  if (db.database_name !== name) throw new Error(`Expected database ${name}`);
  if (vars.APP_ENVIRONMENT !== (name === 'blog' ? 'production' : 'preview')) {
    throw new Error('APP_ENVIRONMENT must match the Worker target');
  }
  string(vars.ACCESS_AUDIENCE);
  return {
    name,
    databaseName: name,
    databaseId: string(db.database_id),
    adminOrigin: origin,
  };
}

export function resolveWorkerTarget(
  configPath: string,
  target: 'production' | 'preview',
): WorkerTarget {
  const parsed = ts.parseConfigFileTextToJson(
    configPath,
    readFileSync(configPath, 'utf8'),
  );
  if (parsed.error)
    throw new Error(
      ts.flattenDiagnosticMessageText(parsed.error.messageText, '\n'),
    );
  const config = object(parsed.config);
  const previewConfig = object(object(config.env).preview);
  const production = readTarget(config, 'blog');
  const preview = readTarget(previewConfig, 'blog-preview');
  const previewVars = object(previewConfig.vars);
  const productionBindings = (config.d1_databases as unknown[]).map(object);
  const previewBindings = (previewConfig.d1_databases as unknown[]).map(object);
  const overlaps = previewBindings.some(db =>
    productionBindings.some(
      other =>
        string(db.database_id) === string(other.database_id) ||
        string(db.database_name) === string(other.database_name),
    ),
  );
  if (
    overlaps ||
    !Array.isArray(previewConfig.routes) ||
    previewConfig.routes.length !== 0 ||
    previewConfig.workers_dev !== true ||
    previewConfig.preview_urls !== true ||
    !/^https:\/\/blog-preview\.[a-z0-9-]+\.workers\.dev$/.test(
      preview.adminOrigin,
    ) ||
    previewVars.PREVIEW_ORIGIN !== preview.adminOrigin ||
    previewVars.ACCESS_AUDIENCE === object(config.vars).ACCESS_AUDIENCE
  ) {
    throw new Error(
      'Preview must use isolated D1, Access audience and default Worker origin without routes',
    );
  }
  if (target !== 'production' && target !== 'preview')
    throw new Error('Unknown Worker target');
  return target === 'production' ? production : preview;
}

if (
  process.argv[1] &&
  fileURLToPath(import.meta.url) === resolve(process.argv[1])
) {
  const target = process.argv[2];
  if (target !== 'production' && target !== 'preview')
    throw new Error('Usage: worker-target.ts <production|preview>');
  const value = resolveWorkerTarget('wrangler.jsonc', target);
  const output = `name=${value.name}\ndatabase-name=${value.databaseName}\ndatabase-id=${value.databaseId}\nadmin-origin=${value.adminOrigin}\n`;
  if (process.env.GITHUB_OUTPUT)
    appendFileSync(process.env.GITHUB_OUTPUT, output);
  else process.stdout.write(output);
}
