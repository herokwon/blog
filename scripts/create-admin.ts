import { exec } from 'child_process';
import { stdin as input, stdout as output } from 'process';
import readline from 'readline/promises';

import { hashPassword } from '../src/lib/server';
import type { LoginInput } from '../src/lib/types';

type GenerateAdminSQLProps = LoginInput & {
  isLocal: boolean;
};

async function generateAdminSQL({
  username,
  password,
  isLocal = true,
}: GenerateAdminSQLProps) {
  const id = crypto.randomUUID();
  const hashedPassword = await hashPassword(password);

  console.log('Inserting admin user into the database...');
  exec(
    `pnpm wrangler d1 execute blog-db --${isLocal ? 'local' : 'remote'} --command "INSERT INTO users (id, username, password_hash, role) VALUES ('${id}', '${username}', '${hashedPassword}', 'admin');"`,
    (error, _, stderr) => {
      if (error) {
        console.error(`❌ Error: ${error.message}`);
        return;
      }

      if (stderr) {
        console.error(`❌ Stderr: ${stderr}`);
        return;
      }

      console.log('✅ Admin user created successfully!');
    },
  );
}

const rl = readline.createInterface({ input, output });

const shouldExit = (value: string) => {
  const v = value.trim().toLowerCase();
  return v === 'q' || v === 'quit';
};
const safeExit = () => {
  rl.close();
  process.exit(0);
};

const ask = async (q: string) => {
  try {
    const answer = await rl.question(`${q}: `);
    if (shouldExit(answer)) safeExit();

    return answer.trim();
  } catch (error) {
    if (error instanceof Error && error.name === 'AbortError') safeExit();
    throw error;
  }
};

const isLocal =
  (await ask('Is this a local environment? (y/n)')).trim().toLowerCase() ===
  'y';
const username = await ask('Enter the admin username');
const password = await ask('Enter the admin password');
const passwordConfirm = await ask('Confirm the admin password');

if (password !== passwordConfirm) {
  console.log('⚠️ Passwords do not match. Please run the script again.');
  safeExit();
}

await generateAdminSQL({ username, password, isLocal });
