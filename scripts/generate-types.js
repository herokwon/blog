import { exec } from 'child_process';
import dotenv from 'dotenv';
import fs from 'fs';

const generatedPath = 'src/utils/supabase/database.types.ts';

const envFiles = [
  '.env.local',
  `.env.${process.env.NODE_ENV === 'production' ? 'production' : 'development'}`,
  '.env',
];

for (const envFile of envFiles) {
  if (fs.existsSync(envFile)) {
    dotenv.config({ path: envFile });
    console.log(`✅ Loaded environment variables from: ${envFile}`);
    break;
  }
}

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL ?? '';

if (supabaseUrl.length === 0) {
  console.error('⚠️ Missing NEXT_PUBLIC_SUPABASE_URL');
  process.exit(1);
}

const supabaseProjectId =
  supabaseUrl.match(/^https:\/\/([^.]+)\.supabase\.co$/)?.[1] ?? '';

if (supabaseProjectId.length === 0) {
  console.error('❌ Invalid NEXT_PUBLIC_SUPABASE_URL');
  process.exit(1);
}

exec(
  `pnpm dlx supabase gen types typescript --project-id ${supabaseProjectId} --schema public > ${generatedPath}`,
  (error, _, stderr) => {
    if (error) {
      console.error(`❌ Error generating types: ${error.message}`);
      return;
    }

    if (stderr) {
      console.error(`❌ Stderr: ${stderr}`);
      return;
    }

    console.log(`✅ Generated types successfully!`);
  },
);
