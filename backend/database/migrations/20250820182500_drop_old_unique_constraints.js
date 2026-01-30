exports.up = function(knex) {
  return knex.schema.raw(`
    -- Drop old unique constraint on subscriptions.external_id
    DROP INDEX IF EXISTS subscriptions_external_id_unique;
    
    -- Drop old unique constraint on articles.external_id  
    DROP INDEX IF EXISTS articles_external_id_unique;
  `);
};

exports.down = function(knex) {
  return knex.schema.raw(`
    -- Recreate old unique constraints (for rollback)
    CREATE UNIQUE INDEX IF NOT EXISTS subscriptions_external_id_unique ON subscriptions(external_id);
    CREATE UNIQUE INDEX IF NOT EXISTS articles_external_id_unique ON articles(external_id);
  `);
};