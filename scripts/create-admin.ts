import { exec } from 'child_process';
import { stdin as input, stdout as output } from 'process';
import readline from 'readline/promises';

import { hashPassword } from '../src/lib/server';
import type { LoginInput } from '../src/lib/types/auth';

type GenerateAdminSQLProps = LoginInput & {
  isLocal: boolean;
};

/**
 * Generates SQL to create an admin user in the database.
 * This function uses the `wrangler d1 execute` command to run an SQL statement that inserts a new admin user into the `users` table. The password is hashed before being stored in the database.
 * @param props.username - The username for the admin user.
 * @param props.password - The password for the admin user.
 * @param props.isLocal - Whether to execute the command locally or remotely.
 * @returns A promise that resolves when the SQL command has been executed.
 */
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
        process.exit(1);
      }

      if (stderr) {
        console.error(`❌ Stderr: ${stderr}`);
        process.exit(1);
      }

      console.log('✅ Admin user created successfully!');
      process.exit(0);
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
