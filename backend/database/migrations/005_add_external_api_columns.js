exports.up = function(knex) {
  return knex.schema
    .alterTable('areas', function (table) {
      table.integer('external_id').unique();
      table.timestamp('synced_at');
    })
    .alterTable('articles', function (table) {
      table.integer('external_id').unique();
      table.timestamp('synced_at');
    })
    .alterTable('subscriptions', function (table) {
      table.integer('external_id').unique();
      table.timestamp('synced_at');
    });
};

exports.down = function(knex) {
  return knex.schema
    .alterTable('subscriptions', function (table) {
      table.dropColumn('synced_at');
      table.dropColumn('external_id');
    })
    .alterTable('articles', function (table) {
      table.dropColumn('synced_at');
      table.dropColumn('external_id');
    })
    .alterTable('areas', function (table) {
      table.dropColumn('synced_at');
      table.dropColumn('external_id');
    });
};