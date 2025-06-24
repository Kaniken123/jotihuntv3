exports.up = function(knex) {
  return knex.schema
    .createTable('areas', function (table) {
      table.increments('id').primary();
      table.string('name').unique().notNullable(); // Alpha, Bravo, Charlie, etc.
      table.string('fox_team_name');
      table.enum('status', ['active', 'inactive', 'hunted']).defaultTo('active');
      table.decimal('lat', 10, 8);
      table.decimal('lng', 11, 8);
      table.integer('points').defaultTo(0);
      table.timestamp('last_seen');
      table.timestamps(true, true);
    })
    .createTable('area_locations', function (table) {
      table.increments('id').primary();
      table.integer('area_id').unsigned().references('id').inTable('areas').onDelete('CASCADE');
      table.decimal('lat', 10, 8).notNullable();
      table.decimal('lng', 11, 8).notNullable();
      table.timestamp('recorded_at').defaultTo(knex.fn.now());
      table.string('source').defaultTo('api'); // api, manual
    })
    .createTable('articles', function (table) {
      table.increments('id').primary();
      table.string('title').notNullable();
      table.text('content').notNullable();
      table.enum('type', ['hint', 'assignment', 'news']).notNullable();
      table.string('area'); // Alpha, Bravo, etc. or null for general
      table.timestamp('published_at').defaultTo(knex.fn.now());
      table.boolean('is_active').defaultTo(true);
      table.timestamps(true, true);
    })
    .createTable('subscriptions', function (table) {
      table.increments('id').primary();
      table.string('team_name').notNullable();
      table.string('area');
      table.boolean('is_participating').defaultTo(true);
      table.timestamps(true, true);
    })
    .createTable('subscription_locations', function (table) {
      table.increments('id').primary();
      table.integer('subscription_id').unsigned().references('id').inTable('subscriptions').onDelete('CASCADE');
      table.decimal('lat', 10, 8).notNullable();
      table.decimal('lng', 11, 8).notNullable();
      table.timestamp('recorded_at').defaultTo(knex.fn.now());
    });
};

exports.down = function(knex) {
  return knex.schema
    .dropTableIfExists('subscription_locations')
    .dropTableIfExists('subscriptions')
    .dropTableIfExists('articles')
    .dropTableIfExists('area_locations')
    .dropTableIfExists('areas');
};