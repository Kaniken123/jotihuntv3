exports.up = function(knex) {
  return knex.schema
    .createTable('user_article_reads', function (table) {
      table.increments('id').primary();
      table.integer('user_id').unsigned().references('id').inTable('users').onDelete('CASCADE');
      table.integer('article_id').unsigned().references('id').inTable('articles').onDelete('CASCADE');
      table.timestamp('read_at').defaultTo(knex.fn.now());
      table.unique(['user_id', 'article_id']);
    })
    .createTable('user_assignment_completions', function (table) {
      table.increments('id').primary();
      table.integer('user_id').unsigned().references('id').inTable('users').onDelete('CASCADE');
      table.integer('article_id').unsigned().references('id').inTable('articles').onDelete('CASCADE');
      table.boolean('is_completed').defaultTo(false);
      table.text('completion_notes');
      table.timestamp('completed_at');
      table.timestamps(true, true);
      table.unique(['user_id', 'article_id']);
    });
};

exports.down = function(knex) {
  return knex.schema
    .dropTableIfExists('user_assignment_completions')
    .dropTableIfExists('user_article_reads');
};