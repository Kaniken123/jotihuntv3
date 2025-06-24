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