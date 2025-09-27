exports.up = async function(knex) {
  // Add detailed subscription information from API
  await knex.schema.alterTable('subscriptions', function(table) {
    table.string('accomodation'); // Type of accommodation
    table.string('street'); // Street name
    table.integer('housenumber'); // House number
    table.string('housenumber_addition'); // House number addition (A, B, etc.)
    table.string('postcode'); // Postal code
    table.string('city'); // City name
  });

  console.log('✅ Added detailed subscription fields');
};

exports.down = async function(knex) {
  await knex.schema.alterTable('subscriptions', function(table) {
    table.dropColumn('accomodation');
    table.dropColumn('street');
    table.dropColumn('housenumber');
    table.dropColumn('housenumber_addition');
    table.dropColumn('postcode');
    table.dropColumn('city');
  });
  
  console.log('🗑️ Removed detailed subscription fields');
};