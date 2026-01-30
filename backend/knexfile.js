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
    useNullAsDefault: true
  }
};