exports.seed = async function(knex) {
  // Create default tenants
  const [globalTenantId] = await knex('tenants').insert({
    name: 'Global Organization',
    slug: 'global',
    description: 'Main global organization for super admins',
    is_active: true,
    settings: JSON.stringify({
      max_teams: 50,
      max_users: 1000,
      features: ['all']
    })
  }).returning('id');

  const [northTenantId] = await knex('tenants').insert({
    name: 'Region North',
    slug: 'region-north', 
    description: 'Northern regional game instance',
    is_active: true,
    settings: JSON.stringify({
      max_teams: 10,
      max_users: 100,
      features: ['basic', 'chat', 'hunting']
    })
  }).returning('id');

  const [southTenantId] = await knex('tenants').insert({
    name: 'Region South',
    slug: 'region-south',
    description: 'Southern regional game instance', 
    is_active: true,
    settings: JSON.stringify({
      max_teams: 8,
      max_users: 80,
      features: ['basic', 'chat', 'hunting', 'routes']
    })
  }).returning('id');

  // Update existing users to belong to Global tenant and assign roles
  const existingUsers = await knex('users').select('id');
  
  // Assign all existing users to Global tenant
  await knex('users').update({ tenant_id: globalTenantId });
  
  // Create user roles for existing users
  for (const user of existingUsers) {
    await knex('user_roles').insert({
      user_id: user.id,
      tenant_id: globalTenantId,
      role: 'super_admin', // Make first users super admins
      is_active: true
    });
  }

  // Create some demo tenant admin users
  const [northAdminId] = await knex('users').insert({
    username: 'north_admin',
    email: 'north@example.com',
    password_hash: '$2b$10$example_hash_north',
    first_name: 'North',
    last_name: 'Admin', 
    tenant_id: northTenantId,
    is_active: true
  }).returning('id');

  const [southAdminId] = await knex('users').insert({
    username: 'south_admin',
    email: 'south@example.com', 
    password_hash: '$2b$10$example_hash_south',
    first_name: 'South',
    last_name: 'Admin',
    tenant_id: southTenantId,
    is_active: true
  }).returning('id');

  // Assign tenant admin roles
  await knex('user_roles').insert([
    {
      user_id: northAdminId,
      tenant_id: northTenantId,
      role: 'tenant_admin',
      is_active: true
    },
    {
      user_id: southAdminId, 
      tenant_id: southTenantId,
      role: 'tenant_admin',
      is_active: true
    }
  ]);

  // Update existing teams to belong to Global tenant
  await knex('teams').update({ tenant_id: globalTenantId });
  
  // Update existing areas to belong to Global tenant  
  await knex('areas').update({ tenant_id: globalTenantId });
  
  // Update existing hunts to belong to Global tenant
  await knex('hunts').update({ tenant_id: globalTenantId });
  
  // Update existing articles to belong to Global tenant
  await knex('articles').update({ tenant_id: globalTenantId });
  
  // Update existing user_locations to belong to Global tenant
  await knex('user_locations').update({ tenant_id: globalTenantId });
  
  // Update existing team_messages to belong to Global tenant
  await knex('team_messages').update({ tenant_id: globalTenantId });

  console.log('✅ Multi-tenant seed data created:');
  console.log(`- Global tenant (ID: ${globalTenantId})`);
  console.log(`- North tenant (ID: ${northTenantId}) with admin user ID: ${northAdminId}`);
  console.log(`- South tenant (ID: ${southTenantId}) with admin user ID: ${southAdminId}`);
};