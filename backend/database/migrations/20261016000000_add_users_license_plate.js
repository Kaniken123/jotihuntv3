// Hunters can record their vehicle licence plate (kenteken). Set by the hunter
// themselves on the site, or by an admin in User Management.
exports.up = async function (knex) {
  const has = await knex.schema.hasColumn('users', 'license_plate');
  if (!has) {
    await knex.schema.alterTable('users', (t) => {
      t.string('license_plate').nullable();
    });
  }
};

exports.down = async function (knex) {
  const has = await knex.schema.hasColumn('users', 'license_plate');
  if (has) {
    await knex.schema.alterTable('users', (t) => t.dropColumn('license_plate'));
  }
};
