import knex from 'knex';
import path from 'path';

const knexConfig = {
  client: 'sqlite3',
  connection: {
    filename: path.join(__dirname, '../../database/jotihunt.db')
  },
  migrations: {
    directory: path.join(__dirname, '../../database/migrations')
  },
  seeds: {
    directory: path.join(__dirname, '../../database/seeds')
  },
  // SQLite is single-writer: more than one connection to the same file causes
  // SQLITE_BUSY under concurrent writes. Use a single connection and let queries
  // serialize through it. busy_timeout makes any remaining lock wait instead of
  // failing instantly; WAL mode allows reads to proceed during a write.
  pool: {
    min: 1,
    max: 1,
    afterCreate: (conn: any, done: (err: Error | null, conn: any) => void) => {
      conn.run('PRAGMA busy_timeout = 10000', (err: Error | null) => {
        if (err) return done(err, conn);
        conn.run('PRAGMA journal_mode = WAL', (err2: Error | null) => {
          done(err2, conn);
        });
      });
    }
  },
  acquireConnectionTimeout: 30000,
  useNullAsDefault: true
};

export const db = knex(knexConfig);

/**
 * Normalize knex `.insert(...).returning('id')` results.
 *
 * Knex 3 on SQLite returns `[{ id: N }]`; older versions/drivers sometimes
 * returned `[N]`. Callers that did `const [id] = await ...returning('id')`
 * silently ended up with `{id: N}` as the "id" — every later `where('id', id)`
 * lookup then failed, producing empty responses (see chat send bug).
 */
export function extractInsertId(result: any[]): number {
  const first = result?.[0];
  if (first == null) throw new Error('Insert returned no id');
  return typeof first === 'object' && 'id' in first ? first.id : first;
}

export const initializeDatabase = async () => {
  try {
    await db.migrate.latest();
    console.log('Database migrations completed');
    
    const hasData = await db('users').select('id').limit(1);
    if (hasData.length === 0) {
      await db.seed.run();
      console.log('Database seeded with initial data');
    }
  } catch (error) {
    console.error('Database initialization failed:', error);
    throw error;
  }
};