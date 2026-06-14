module.exports = {
  apps: [
    {
      name: 'fusiey',
      script: 'npm',
      args: 'run start:prod',
      cwd: '/www/wwwroot/fusiey',
      interpreter: 'none',
      instances: 1,
      autorestart: true,
      watch: false,
      max_memory_restart: '1024M',
      env: {
        NODE_ENV: 'production',
      },
    },
  ],
};
