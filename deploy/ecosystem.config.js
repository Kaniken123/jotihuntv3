module.exports = {
  apps: [{
    name: 'jotihunt-backend',
    script: 'dist/server.js',
    cwd: '/var/www/jotihunt/backend',
    instances: 1,
    autorestart: true,
    watch: false,
    max_memory_restart: '512M',
    env: {
      NODE_ENV: 'production',
      PORT: 3001,
    },
  }],
};
