exports.up = function(knex) {
  return knex.schema
    .createTable('location_settings', function (table) {
      table.increments('id').primary();
      table.integer('user_id').unsigned().references('id').inTable('users').onDelete('CASCADE');
      table.integer('tracking_interval').defaultTo(60); // seconds
      table.integer('offline_threshold').defaultTo(300); // seconds
      table.boolean('location_sharing_enabled').defaultTo(true);
      table.boolean('privacy_mode').defaultTo(false);
      table.timestamps(true, true);
    })
    .createTable('user_locations', function (table) {
      table.increments('id').primary();
      table.integer('user_id').unsigned().references('id').inTable('users').onDelete('CASCADE');
      table.decimal('lat', 10, 8).notNullable();
      table.decimal('lng', 11, 8).notNullable();
      table.decimal('accuracy', 8, 2);
      table.timestamp('recorded_at').defaultTo(knex.fn.now());
      table.string('source').defaultTo('gps'); // gps, manual
      table.index(['user_id', 'recorded_at']);
    })
    .createTable('team_locations', function (table) {
      table.increments('id').primary();
      table.integer('team_id').unsigned().references('id').inTable('teams').onDelete('CASCADE');
      table.integer('submitted_by').unsigned().references('id').inTable('users').onDelete('CASCADE');
      table.decimal('lat', 10, 8).notNullable();
      table.decimal('lng', 11, 8).notNullable();
      table.string('description');
      table.timestamp('submitted_at').defaultTo(knex.fn.now());
    });
};

exports.down = function(knex) {
  return knex.schema
    .dropTableIfExists('team_locations')
    .dropTableIfExists('user_locations')
    .dropTableIfExists('location_settings');
};