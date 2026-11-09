import { error, fail, type RequestEvent } from '@sveltejs/kit';
import { env } from 'cloudflare:workers';
import { createCategory } from './db/categories.js';

export async function createEditorCategory({ request, locals }: RequestEvent) {
  if (!locals.author) error(403, 'Administrator access denied.');
  const data = await request.formData();
  const value = data.get('name');
  const name = typeof value === 'string' ? value : '';
  try {
    const result = await createCategory(env.DB, name);
    return result.ok
      ? { operation: 'createCategory' as const, ...result }
      : fail(result.status, {
          operation: 'createCategory' as const,
          ...result,
        });
  } catch {
    console.error('Inline category creation failed');
    return fail(503, {
      operation: 'createCategory' as const,
      ok: false as const,
      message:
        'The category could not be created. Your input has been kept. Please retry.',
    });
  }
}
