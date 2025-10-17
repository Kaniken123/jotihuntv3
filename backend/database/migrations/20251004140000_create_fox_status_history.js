/**
 * @param { import("knex").Knex } knex
 * @returns { Promise<void> }
 */
exports.up = function(knex) {
  return knex.schema.createTable('fox_status_history', table => {
    table.increments('id').primary();
    table.integer('area_id').unsigned().notNullable();
    table.string('api_status').notNullable(); // 'green', 'orange', 'red' from API
    table.string('db_status').notNullable(); // 'active', 'inactive', 'hunted' in DB
    table.string('fox_team_name');
    table.float('lat');
    table.float('lng');
    table.datetime('started_at').notNullable();
    table.datetime('ended_at');
    table.integer('duration_seconds'); // Calculated when status changes
    table.integer('tenant_id').unsigned().defaultTo(1);
    table.datetime('created_at').notNullable().defaultTo(knex.fn.now());

    // Foreign keys
    table.foreign('area_id').references('areas.id').onDelete('CASCADE');
    table.foreign('tenant_id').references('tenants.id').onDelete('CASCADE');

    // Indexes for efficient queries
    table.index(['area_id', 'started_at']);
    table.index(['api_status', 'started_at']);
    table.index(['tenant_id', 'started_at']);
  });
};

/**
 * @param { import("knex").Knex } knex
 * @returns { Promise<void> }
 */
exports.down = function(knex) {
  return knex.schema.dropTableIfExists('fox_status_history');
};
