import { readdirSync, readFileSync } from 'node:fs';
import { DatabaseSync } from 'node:sqlite';
import { expect, test } from 'vitest';

test('post-owned migration preserves attached legacy names and independent ordered rows', () => {
  const db = new DatabaseSync(':memory:');
  try {
    db.exec('PRAGMA foreign_keys = ON');
    const files = readdirSync('drizzle')
      .filter(name => name.endsWith('.sql'))
      .sort();
    for (const file of files.slice(0, 2))
      db.exec(readFileSync(`drizzle/${file}`, 'utf8'));
    db.exec(
      "INSERT INTO posts(id, revision) VALUES ('a','r'), ('b','r'); INSERT INTO tags(id,name) VALUES ('one','Svelte'), ('two','Legacy tag'), ('orphan','Unused'); INSERT INTO post_tags VALUES ('a','one'), ('a','two'), ('b','one')",
    );
    for (const file of files.slice(2))
      db.exec(readFileSync(`drizzle/${file}`, 'utf8'));
    expect(
      db.prepare('SELECT * FROM post_tags ORDER BY post_id, position').all(),
    ).toEqual([
      { post_id: 'a', name: 'Legacy tag', position: 0 },
      { post_id: 'a', name: 'Svelte', position: 1 },
      { post_id: 'b', name: 'Svelte', position: 0 },
    ]);
    db.exec(
      "UPDATE post_tags SET name = 'SvelteKit' WHERE post_id = 'a' AND name = 'Svelte'",
    );
    expect(
      db.prepare("SELECT name FROM post_tags WHERE post_id = 'b'").all(),
    ).toEqual([{ name: 'Svelte' }]);
    expect(() =>
      db.exec("INSERT INTO post_tags VALUES ('b','Svelte',1)"),
    ).toThrow();
    expect(db.prepare('PRAGMA foreign_key_check').all()).toEqual([]);
  } finally {
    db.close();
  }
});
