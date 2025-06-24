exports.up = function(knex) {
  return knex.schema
    .createTable('users', function (table) {
      table.increments('id').primary();
      table.string('username').unique().notNullable();
      table.string('email').unique().notNullable();
      table.string('password_hash').notNullable();
      table.string('first_name');
      table.string('last_name');
      table.enum('role', ['admin', 'user']).defaultTo('user');
      table.boolean('is_active').defaultTo(true);
      table.timestamps(true, true);
    })
    .createTable('teams', function (table) {
      table.increments('id').primary();
      table.string('name').unique().notNullable();
      table.string('description');
      table.enum('area', ['Alpha', 'Bravo', 'Charlie', 'Delta', 'Echo', 'Foxtrot']);
      table.decimal('base_lat', 10, 8);
      table.decimal('base_lng', 11, 8);
      table.boolean('is_active').defaultTo(true);
      table.timestamps(true, true);
    })
    .createTable('team_members', function (table) {
      table.increments('id').primary();
      table.integer('user_id').unsigned().references('id').inTable('users').onDelete('CASCADE');
      table.integer('team_id').unsigned().references('id').inTable('teams').onDelete('CASCADE');
      table.enum('role', ['leader', 'member']).defaultTo('member');
      table.timestamp('joined_at').defaultTo(knex.fn.now());
      table.unique(['user_id', 'team_id']);
    })
    .createTable('auth_tokens', function (table) {
      table.increments('id').primary();
      table.integer('user_id').unsigned().references('id').inTable('users').onDelete('CASCADE');
      table.string('token').notNullable();
      table.timestamp('expires_at').notNullable();
      table.boolean('is_revoked').defaultTo(false);
      table.timestamps(true, true);
    });
};

exports.down = function(knex) {
  return knex.schema
    .dropTableIfExists('auth_tokens')
    .dropTableIfExists('team_members')
    .dropTableIfExists('teams')
    .dropTableIfExists('users');
};