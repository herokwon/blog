import { readdirSync, readFileSync } from 'node:fs';
import { DatabaseSync, type SQLInputValue } from 'node:sqlite';

/** A SQL-behavior fixture, not a substitute for actual local D1 integration. */
export function createSqliteD1(): { binding: D1Database; dispose: () => void } {
  const database = new DatabaseSync(':memory:');
  const directory = new URL('../../drizzle/', import.meta.url);
  try {
    for (const file of readdirSync(directory)
      .filter(file => file.endsWith('.sql'))
      .sort())
      database.exec(readFileSync(new URL(file, directory), 'utf8'));
  } catch (error) {
    database.close();
    throw error;
  }
  const unsupported = () => {
    throw new Error('Unsupported D1 fixture method');
  };
  function prepare(
    sql: string,
    parameters: SQLInputValue[] = [],
  ): D1PreparedStatement {
    const statement = database.prepare(sql);
    return {
      bind: (...values: unknown[]) => prepare(sql, values as SQLInputValue[]),
      raw: async (options?: { columnNames?: boolean }) => {
        statement.setReturnArrays(true);
        const rows = statement.all(...parameters);
        return options?.columnNames
          ? [statement.columns().map(column => column.name), ...rows]
          : rows;
      },
      run: async () => {
        const result = statement.run(...parameters);
        return {
          success: true,
          results: [],
          meta: {
            duration: 0,
            size_after: 0,
            rows_read: 0,
            rows_written: Number(result.changes),
            last_row_id: Number(result.lastInsertRowid),
            changed_db: result.changes !== 0,
            changes: Number(result.changes),
          },
        };
      },
      all: unsupported,
      first: unsupported,
    } as D1PreparedStatement;
  }
  // Explicitly unsupported methods fail instead of pretending to behave like D1.
  const binding = {
    prepare,
    batch: unsupported,
    exec: unsupported,
    dump: unsupported,
    withSession: unsupported,
  } as unknown as D1Database;
  return { binding, dispose: () => database.close() };
}
