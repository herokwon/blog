import type { getDb } from '$lib/server/db';
import type { SQLiteTable, TableConfig } from 'drizzle-orm/sqlite-core';

type TestTable = SQLiteTable<TableConfig>;

export async function resetTestDb(
  db: ReturnType<typeof getDb>,
  tableOrTables: TestTable | TestTable[],
) {
  const tables = Array.isArray(tableOrTables) ? tableOrTables : [tableOrTables];

  for (const table of tables) {
    await db.delete(table);
  }
}
