const bcrypt = require('bcryptjs');

exports.seed = async function(knex) {
  // Clear existing entries (skip tenants - let 002_tenant_data.js handle that)
  await knex('team_members').del();
  await knex('teams').del();
  await knex('user_roles').del();
  await knex('users').del();
  await knex('areas').del();

  // Insert admin user
  const adminPassword = await bcrypt.hash('admin123', 10);
  const adminIds = await knex('users').insert({
    username: 'admin',
    email: 'admin@jotihunt.com',
    password_hash: adminPassword,
    first_name: 'Admin',
    last_name: 'User',
    tenant_id: 1
  }, 'id');
  const adminId = adminIds[0];

  // Insert game areas (fox teams)
  await knex('areas').insert([
    { name: 'Alpha', fox_team_name: 'Alpha Team', status: 'active' },
    { name: 'Bravo', fox_team_name: 'Bravo Team', status: 'active' },
    { name: 'Charlie', fox_team_name: 'Charlie Team', status: 'active' },
    { name: 'Delta', fox_team_name: 'Delta Team', status: 'active' },
    { name: 'Echo', fox_team_name: 'Echo Team', status: 'active' },
    { name: 'Foxtrot', fox_team_name: 'Foxtrot Team', status: 'active' }
  ]);

  // Insert sample teams
  await knex('teams').insert([
    {
      name: 'Hunters Alpha',
      description: 'Alpha area hunting team',
      area: 'Alpha',
      base_lat: 52.0907374,
      base_lng: 5.1214201,
      tenant_id: 1
    },
    {
      name: 'Hunters Bravo',
      description: 'Bravo area hunting team',
      area: 'Bravo',
      base_lat: 52.0805,
      base_lng: 5.1305,
      tenant_id: 1
    },
    {
      name: 'admin',
      description: 'Admin team for hunt submissions',
      area: 'Alpha',
      base_lat: 52.0907374,
      base_lng: 5.1214201,
      tenant_id: 1
    }
  ]);

  // Insert sample users
  const userPassword = await bcrypt.hash('password123', 10);
  const chrisPassword = await bcrypt.hash('#J0t1h4ntw8w00rd!', 10);
  
  await knex('users').insert({
    id: 1,
    username: 'chris.ruhlmann',
    email: 'chris@jotihunt.com',
    password_hash: chrisPassword,
    first_name: 'Chris',
    last_name: 'Ruhlmann',
    tenant_id: 1
  });
  
  await knex('users').insert({
    username: 'hunter1',
    email: 'hunter1@jotihunt.com',
    password_hash: userPassword,
    first_name: 'Hunter',
    last_name: 'One',
    tenant_id: 1
  });
  
  await knex('users').insert({
    username: 'hunter2',
    email: 'hunter2@jotihunt.com',
    password_hash: userPassword,
    first_name: 'Hunter',
    last_name: 'Two',
    tenant_id: 1
  });

  // Get IDs for team assignments
  const team1 = await knex('teams').where('name', 'Hunters Alpha').first();
  const team2 = await knex('teams').where('name', 'Hunters Bravo').first();
  const adminTeam = await knex('teams').where('name', 'admin').first();
  const user1 = await knex('users').where('username', 'hunter1').first();
  const user2 = await knex('users').where('username', 'hunter2').first();
  const chrisUser = await knex('users').where('username', 'chris.ruhlmann').first();

  // Create user roles
  await knex('user_roles').insert([
    { user_id: adminId, role: 'super_admin', tenant_id: 1 },
    { user_id: 1, role: 'super_admin', tenant_id: 1 },
    { user_id: user1.id, role: 'user', tenant_id: 1 },
    { user_id: user2.id, role: 'user', tenant_id: 1 }
  ]);

  // Add users to teams
  await knex('team_members').insert([
    { user_id: user1.id, team_id: team1.id, role: 'leader' },
    { user_id: user2.id, team_id: team2.id, role: 'leader' },
    { user_id: 1, team_id: adminTeam.id, role: 'leader' }
  ]);

  // Insert sample articles
  await knex('articles').insert([
    {
      title: 'Welcome to Jotihunt 2024',
      content: 'Welcome to this year\'s Jotihunt! Good luck to all teams.',
      type: 'news',
      tenant_id: 1
    },
    {
      title: 'Alpha Team Spotted',
      content: 'Alpha team was last seen near the main square.',
      type: 'hint',
      area: 'Alpha',
      tenant_id: 1
    },
    {
      title: 'Photo Assignment',
      content: 'Take a photo of your team at the windmill.',
      type: 'assignment',
      tenant_id: 1
    }
  ]);
};