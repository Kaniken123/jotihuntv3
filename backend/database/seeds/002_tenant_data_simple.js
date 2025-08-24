exports.seed = async function(knex) {
  // Clean up any existing tenant data first
  await knex('user_roles').del();
  await knex('tenants').del();
  
  // Create tenants with simple approach
  await knex('tenants').insert([
    {
      id: 1,
      name: 'Global Organization',
      slug: 'global',
      description: 'Main global organization for super admins',
      is_active: true,
      settings: JSON.stringify({
        max_teams: 50,
        max_users: 1000,
        features: ['all']
      })
    },
    {
      id: 2,
      name: 'Region North',
      slug: 'region-north', 
      description: 'Northern regional game instance',
      is_active: true,
      settings: JSON.stringify({
        max_teams: 10,
        max_users: 100,
        features: ['basic', 'chat', 'hunting']
      })
    },
    {
      id: 3,
      name: 'Region South',
      slug: 'region-south',
      description: 'Southern regional game instance', 
      is_active: true,
      settings: JSON.stringify({
        max_teams: 8,
        max_users: 80,
        features: ['basic', 'chat', 'hunting', 'routes']
      })
    }
  ]);

  // Update existing users to belong to Global tenant
  await knex('users').update({ tenant_id: 1 });
  
  // Get existing users and create roles
  const existingUsers = await knex('users').select('id');
  
  // Create super admin roles for existing users in global tenant
  for (const user of existingUsers) {
    await knex('user_roles').insert({
      user_id: user.id,
      tenant_id: 1,
      role: 'super_admin',
      is_active: true
    });
  }

  // Create demo tenant admin users
  await knex('users').insert([
    {
      id: 100,  // Use high ID to avoid conflicts
      username: 'north_admin',
      email: 'north@example.com',
      password_hash: '$2b$10$YQlCPBLGhFZMaJhCkJJm0.vlCMhZGU1x7VKyFZnEHnQzTLjJgKQyq', // password: admin123
      first_name: 'North',
      last_name: 'Admin', 
      tenant_id: 2,
      is_active: true
    },
    {
      id: 101,
      username: 'south_admin',
      email: 'south@example.com', 
      password_hash: '$2b$10$YQlCPBLGhFZMaJhCkJJm0.vlCMhZGU1x7VKyFZnEHnQzTLjJgKQyq', // password: admin123
      first_name: 'South',
      last_name: 'Admin',
      tenant_id: 3,
      is_active: true
    }
  ]);

  // Assign tenant admin roles
  await knex('user_roles').insert([
    {
      user_id: 100,
      tenant_id: 2,
      role: 'tenant_admin',
      is_active: true
    },
    {
      user_id: 101, 
      tenant_id: 3,
      role: 'tenant_admin',
      is_active: true
    }
  ]);

  // Update existing data to belong to Global tenant
  await knex('teams').update({ tenant_id: 1 });
  await knex('areas').update({ tenant_id: 1 });
  
  // Update other tables if they have data
  const tablesWithTenantId = ['hunts', 'articles', 'user_locations', 'team_messages'];
  for (const table of tablesWithTenantId) {
    try {
      await knex(table).update({ tenant_id: 1 });
    } catch (error) {
      // Table might be empty, continue
      console.log(`Note: ${table} table might be empty or not exist yet`);
    }
  }

  console.log('✅ Multi-tenant seed data created successfully!');
  console.log('- Global tenant (ID: 1) - All existing data migrated here');
  console.log('- North tenant (ID: 2) - Username: north_admin, Password: admin123');
  console.log('- South tenant (ID: 3) - Username: south_admin, Password: admin123');
};