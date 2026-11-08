import { error } from '@sveltejs/kit';
import type { LayoutServerLoad } from './$types';

export const load: LayoutServerLoad = ({ locals }) => {
  if (!locals.author) error(403, 'Administrator access denied.');
  return { author: locals.author };
};
