exports.up = async function(knex) {
  // Add fox_team mapping and coordinates to subscriptions table
  await knex.schema.alterTable('subscriptions', function(table) {
    table.string('fox_team_name'); // Which fox team is responsible for this subscription
    table.decimal('lat', 10, 8); // Latitude for group location
    table.decimal('lng', 11, 8); // Longitude for group location
  });

  // Create subscription_visits table to track which fox teams visited which groups
  await knex.schema.createTable('subscription_visits', function(table) {
    table.increments('id').primary();
    table.integer('subscription_id').unsigned().references('id').inTable('subscriptions').onDelete('CASCADE');
    table.integer('area_id').unsigned().references('id').inTable('areas').onDelete('CASCADE'); // Fox team area
    table.string('fox_team_name').notNullable(); // Fox team name for easy querying
    table.decimal('visit_lat', 10, 8); // Where the visit was recorded
    table.decimal('visit_lng', 11, 8); // Where the visit was recorded
    table.integer('user_id').unsigned().references('id').inTable('users').onDelete('CASCADE'); // Who recorded the visit
    table.text('notes'); // Optional notes about the visit
    table.timestamps(true, true);
    table.integer('tenant_id').unsigned().references('id').inTable('tenants').onDelete('CASCADE');

    // Prevent duplicate visits from same fox team to same subscription
    table.unique(['subscription_id', 'area_id', 'tenant_id'], 'subscription_visits_unique');
  });

  console.log('✅ Added subscription-fox mapping and visit tracking tables');
};

exports.down = async function(knex) {
  await knex.schema.dropTableIfExists('subscription_visits');
  
  await knex.schema.alterTable('subscriptions', function(table) {
    table.dropColumn('fox_team_name');
    table.dropColumn('lat');
    table.dropColumn('lng');
  });
  
  console.log('🗑️ Removed subscription-fox mapping and visit tracking tables');
};