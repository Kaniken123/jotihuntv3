/**
 * @param { import("knex").Knex } knex
 * @returns { Promise<void> }
 */
exports.up = function(knex) {
  return knex.transaction(async (trx) => {
    // First, get all existing team data
    const existingTeams = await trx.select('*').from('teams');
    
    // Drop and recreate the teams table with updated enum
    await trx.schema.dropTable('teams');
    
    await trx.schema.createTable('teams', function (table) {
      table.increments('id').primary();
      table.string('name').unique().notNullable();
      table.string('description');
      table.enum('area', ['Alpha', 'Bravo', 'Charlie', 'Delta', 'Echo', 'Foxtrot', 'Hotel', 'Golf']);
      table.decimal('base_lat', 10, 8);
      table.decimal('base_lng', 11, 8);
      table.boolean('is_active').defaultTo(true);
      table.timestamps(true, true);
    });
    
    // Restore existing teams
    if (existingTeams.length > 0) {
      await trx('teams').insert(existingTeams);
    }
    
    // Insert Hotel and Golf areas only if they don't exist
    const existingAreas = await trx('areas').whereIn('name', ['Hotel', 'Golf']).select('name');
    const existingAreaNames = existingAreas.map(area => area.name);
    
    const areasToInsert = [];
    if (!existingAreaNames.includes('Hotel')) {
      areasToInsert.push({
        name: 'Hotel',
        fox_team_name: 'Hotel Fox',
        status: 'active',
        lat: null,
        lng: null,
        points: 0,
        last_seen: null,
        created_at: new Date(),
        updated_at: new Date()
      });
    }
    if (!existingAreaNames.includes('Golf')) {
      areasToInsert.push({
        name: 'Golf',
        fox_team_name: 'Golf Fox',
        status: 'active',
        lat: null,
        lng: null,
        points: 0,
        last_seen: null,
        created_at: new Date(),
        updated_at: new Date()
      });
    }
    
    if (areasToInsert.length > 0) {
      await trx('areas').insert(areasToInsert);
    }
    
    // Insert Hotel and Golf teams only if they don't exist
    const existingTeamsCheck = await trx('teams').whereIn('area', ['Hotel', 'Golf']).select('area');
    const existingTeamAreas = existingTeamsCheck.map(team => team.area);
    
    const teamsToInsert = [];
    if (!existingTeamAreas.includes('Hotel')) {
      teamsToInsert.push({
        name: 'Hunters Hotel',
        description: 'Hotel area hunting team',
        area: 'Hotel',
        base_lat: null,
        base_lng: null,
        is_active: true,
        created_at: new Date(),
        updated_at: new Date()
      });
    }
    if (!existingTeamAreas.includes('Golf')) {
      teamsToInsert.push({
        name: 'Hunters Golf',
        description: 'Golf area hunting team',
        area: 'Golf',
        base_lat: null,
        base_lng: null,
        is_active: true,
        created_at: new Date(),
        updated_at: new Date()
      });
    }
    
    if (teamsToInsert.length > 0) {
      await trx('teams').insert(teamsToInsert);
    }
  });
};

/**
 * @param { import("knex").Knex } knex
 * @returns { Promise<void> }
 */
exports.down = function(knex) {
  return knex('teams')
    .whereIn('area', ['Hotel', 'Golf'])
    .del()
    .then(() => {
      return knex('areas')
        .whereIn('name', ['Hotel', 'Golf'])
        .del();
    });
};
