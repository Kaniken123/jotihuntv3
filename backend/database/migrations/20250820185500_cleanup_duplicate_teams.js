exports.up = function(knex) {
  return knex.transaction(async (trx) => {
    // Get all areas
    const areas = ['Alpha', 'Bravo', 'Charlie', 'Delta', 'Echo', 'Foxtrot', 'Golf', 'Hotel'];
    const tenants = await trx('tenants').select('id').where('is_active', true);
    
    for (const tenant of tenants) {
      for (const area of areas) {
        // Find all teams for this area in this tenant
        const teams = await trx('teams')
          .where('area', area)
          .where('tenant_id', tenant.id)
          .orderBy('id');
        
        if (teams.length > 1) {
          // Keep the first team, move all members to it, then delete the rest
          const keepTeam = teams[0];
          const deleteTeams = teams.slice(1);
          
          console.log(`Tenant ${tenant.id}, Area ${area}: Keeping team ${keepTeam.id} (${keepTeam.name}), removing ${deleteTeams.length} duplicates`);
          
          // Move all team members from duplicate teams to the keep team
          for (const deleteTeam of deleteTeams) {
            // Get members from this team
            const members = await trx('team_members')
              .where('team_id', deleteTeam.id);
            
            // Move them to the keep team (avoiding duplicates)
            for (const member of members) {
              // Check if member is already in the keep team
              const existing = await trx('team_members')
                .where('user_id', member.user_id)
                .where('team_id', keepTeam.id)
                .first();
              
              if (!existing) {
                // Update the team_id to the keep team
                await trx('team_members')
                  .where('id', member.id)
                  .update('team_id', keepTeam.id);
              } else {
                // Delete the duplicate membership
                await trx('team_members').where('id', member.id).del();
              }
            }
            
            // Delete the duplicate team
            await trx('teams').where('id', deleteTeam.id).del();
          }
          
          // Update the kept team name to just the area name
          await trx('teams')
            .where('id', keepTeam.id)
            .update({
              name: area,
              description: `${area} team`,
              updated_at: new Date()
            });
        } else if (teams.length === 1) {
          // Update single team name to just the area name
          await trx('teams')
            .where('id', teams[0].id)
            .update({
              name: area,
              description: `${area} team`,
              updated_at: new Date()
            });
        }
      }
    }
    
    console.log('Team cleanup completed');
  });
};

exports.down = function(knex) {
  // This migration is not easily reversible
  return Promise.resolve();
};