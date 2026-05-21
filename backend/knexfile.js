// SQLite is single-writer. A busy_timeout lets the migration CLI wait for the
// running app to release a lock instead of failing immediately with SQLITE_BUSY.
const sqlitePool = {
  min: 1,
  max: 1,
  afterCreate: (conn, done) => {
    conn.run('PRAGMA busy_timeout = 10000', (err) => done(err, conn));
  }
};

module.exports = {
  development: {
    client: 'sqlite3',
    connection: {
      filename: './database/jotihunt.db'
    },
    migrations: {
      directory: './database/migrations'
    },
    seeds: {
      directory: './database/seeds'
    },
    pool: sqlitePool,
    useNullAsDefault: true
  },

  production: {
    client: 'sqlite3',
    connection: {
      filename: './database/jotihunt.db'
    },
    migrations: {
      directory: './database/migrations'
    },
    pool: sqlitePool,
    useNullAsDefault: true
  }
};
