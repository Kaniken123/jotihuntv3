/**
 * Step 2c of the fox-prediction plan: cache table for computed predictions.
 * One latest row per (area, tenant); we keep history by inserting and reading the
 * newest by generated_at.
 *
 * @param { import("knex").Knex } knex
 * @returns { Promise<void> }
 */
exports.up = function (knex) {
  return knex.schema.createTable('fox_predictions', (table) => {
    table.increments('id').primary();
    table.integer('area_id').unsigned().notNullable();
    table.integer('tenant_id').unsigned().defaultTo(1);
    table.datetime('generated_at').notNullable().defaultTo(knex.fn.now());

    // Which input drove the prediction + when that input was observed.
    table.string('anchor_source'); // 'hunt' | 'hint' | 'manual' | 'api' | 'none'
    table.datetime('anchor_time');

    table.text('heatmap_geojson'); // weighted grid as GeoJSON FeatureCollection
    table.text('top_zones');       // JSON: [{ lat, lng, label, score }]
    table.float('confidence');     // 0..1

    table.foreign('area_id').references('areas.id').onDelete('CASCADE');
    table.index(['area_id', 'generated_at']);
    table.index(['tenant_id', 'generated_at']);
  });
};

/**
 * @param { import("knex").Knex } knex
 * @returns { Promise<void> }
 */
exports.down = function (knex) {
  return knex.schema.dropTableIfExists('fox_predictions');
};
