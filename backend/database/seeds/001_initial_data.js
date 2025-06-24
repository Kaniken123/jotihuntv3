const bcrypt = require('bcryptjs');

exports.seed = async function(knex) {
  // Clear existing entries
  await knex('team_members').del();
  await knex('teams').del();
  await knex('users').del();
  await knex('areas').del();

  // Insert admin user
  const adminPassword = await bcrypt.hash('admin123', 10);
  await knex('users').insert({
    username: 'admin',
    email: 'admin@jotihunt.com',
    password_hash: adminPassword,
    first_name: 'Admin',
    last_name: 'User',
    role: 'admin'
  });

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
      base_lng: 5.1214201
    },
    {
      name: 'Hunters Bravo',
      description: 'Bravo area hunting team',
      area: 'Bravo',
      base_lat: 52.0805,
      base_lng: 5.1305
    }
  ]);

  // Insert sample users
  const userPassword = await bcrypt.hash('password123', 10);
  await knex('users').insert([
    {
      username: 'hunter1',
      email: 'hunter1@jotihunt.com',
      password_hash: userPassword,
      first_name: 'Hunter',
      last_name: 'One',
      role: 'user'
    },
    {
      username: 'hunter2',
      email: 'hunter2@jotihunt.com',
      password_hash: userPassword,
      first_name: 'Hunter',
      last_name: 'Two',
      role: 'user'
    }
  ]);

  // Get IDs for team assignments
  const team1 = await knex('teams').where('name', 'Hunters Alpha').first();
  const team2 = await knex('teams').where('name', 'Hunters Bravo').first();
  const user1 = await knex('users').where('username', 'hunter1').first();
  const user2 = await knex('users').where('username', 'hunter2').first();

  // Add users to teams
  await knex('team_members').insert([
    { user_id: user1.id, team_id: team1.id, role: 'leader' },
    { user_id: user2.id, team_id: team2.id, role: 'leader' }
  ]);

  // Insert sample articles
  await knex('articles').insert([
    {
      title: 'Welcome to Jotihunt 2024',
      content: 'Welcome to this year\'s Jotihunt! Good luck to all teams.',
      type: 'news'
    },
    {
      title: 'Alpha Team Spotted',
      content: 'Alpha team was last seen near the main square.',
      type: 'hint',
      area: 'Alpha'
    },
    {
      title: 'Photo Assignment',
      content: 'Take a photo of your team at the windmill.',
      type: 'assignment'
    }
  ]);
};