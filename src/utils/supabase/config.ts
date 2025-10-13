function getEnvVar(key: string): string {
  const value = process.env[key];

  if (!value) {
    throw new Error(`Missing environment variable: ${key}`);
  }

  return value;
}

const SUPABASE_URL = getEnvVar('NEXT_PUBLIC_SUPABASE_URL');
const SUPABASE_KEY = getEnvVar('NEXT_PUBLIC_SUPABASE_PUBLISHABLE_DEFAULT_KEY');

export const supabaseConfig = {
  url: SUPABASE_URL,
  key: SUPABASE_KEY,
} as const;
export type SupabaseConfig = typeof supabaseConfig;
