exports.seed = function(knex) {
  return knex.transaction(async (trx) => {
    // Get all areas with their tenants
    const areas = await trx('areas')
      .select('id', 'name', 'tenant_id')
      .whereNotNull('tenant_id');
    
    console.log(`Found ${areas.length} areas to sync with teams`);
    
    for (const area of areas) {
      // Check if a team already exists for this area in this tenant
      const existingTeam = await trx('teams')
        .where('area', area.name)
        .where('tenant_id', area.tenant_id)
        .first();
      
      if (!existingTeam) {
        // Create a team for this area
        const teamName = `Team ${area.name}`;
        
        await trx('teams').insert({
          name: teamName,
          area: area.name,
          tenant_id: area.tenant_id,
          description: `Team for ${area.name} area`,
          is_active: true,
          created_at: new Date(),
          updated_at: new Date()
        });
        
        console.log(`Created team "${teamName}" for area "${area.name}" in tenant ${area.tenant_id}`);
      } else {
        console.log(`Team already exists for area "${area.name}" in tenant ${area.tenant_id}`);
      }
    }
  });
};