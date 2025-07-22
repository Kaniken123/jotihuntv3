exports.up = function(knex) {
  return knex.schema.createTable('hint_solutions', function(table) {
    table.increments('id').primary();
    table.integer('team_id').notNullable();
    table.integer('user_id').notNullable();
    table.integer('article_id').notNullable(); // Reference to the hint/article
    table.text('solution').notNullable(); // The answer/solution provided
    table.decimal('rd_x', 10, 2); // Rijksdriehoek X coordinate
    table.decimal('rd_y', 10, 2); // Rijksdriehoek Y coordinate  
    table.decimal('lat', 10, 6); // Converted WGS84 latitude
    table.decimal('lng', 10, 6); // Converted WGS84 longitude
    table.string('fox_team').nullable(); // Which fox team this reveals (Alpha, Bravo, etc.)
    table.boolean('is_correct').defaultTo(false);
    table.boolean('reveals_fox_location').defaultTo(false);
    table.timestamps(true, true);
    
    // Foreign keys
    table.foreign('team_id').references('teams.id').onDelete('CASCADE');
    table.foreign('user_id').references('users.id').onDelete('CASCADE');
    table.foreign('article_id').references('articles.id').onDelete('CASCADE');
    
    // Indexes
    table.index(['team_id', 'article_id']);
    table.index(['is_correct']);
    table.index(['fox_team']);
  });
};

exports.down = function(knex) {
  return knex.schema.dropTable('hint_solutions');
};