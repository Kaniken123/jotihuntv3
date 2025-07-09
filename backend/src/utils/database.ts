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
  pool: {
    min: 2,
    max: 10,
    acquireTimeoutMillis: 30000,
    createTimeoutMillis: 30000,
    destroyTimeoutMillis: 5000,
    idleTimeoutMillis: 30000,
    reapIntervalMillis: 1000,
    createRetryIntervalMillis: 200
  },
  acquireConnectionTimeout: 30000,
  useNullAsDefault: true
};

export const db = knex(knexConfig);

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