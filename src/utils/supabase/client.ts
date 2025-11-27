import { createBrowserClient } from '@supabase/ssr';

import { supabaseConfig } from './config';
import type { Database } from './database.types';

export function createClient() {
  return createBrowserClient<Database>(supabaseConfig.url, supabaseConfig.key);
}
