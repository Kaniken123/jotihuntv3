exports.seed = function(knex) {
  return knex('chat_channels').del()
    .then(function () {
      // Insert general channels for each tenant
      return knex('chat_channels').insert([
        {
          id: 1,
          name: 'General',
          type: 'general',
          description: 'General discussion for all team members',
          tenant_id: 1,
          is_active: true
        },
        {
          id: 2,
          name: 'General',
          type: 'general', 
          description: 'General discussion for all team members',
          tenant_id: 2,
          is_active: true
        },
        {
          id: 3,
          name: 'General',
          type: 'general',
          description: 'General discussion for all team members', 
          tenant_id: 3,
          is_active: true
        }
      ]);
    });
};