/**
 * PM2 config. The app self-clusters via cluster.mjs (forks WEB_INSTANCES workers
 * that share port 3000), so PM2 runs a single supervisor process here and we get
 * multi-worker resilience without compiling the TS server (it runs via tsx, same
 * as start:prod). Raise WEB_INSTANCES toward your CPU core count (`nproc`).
 *
 *   pm2 delete fusiey
 *   pm2 start ecosystem.config.cjs
 *   pm2 save
 */
module.exports = {
  apps: [
    {
      name: 'fusiey',
      script: 'cluster.mjs',
      cwd: '/www/wwwroot/fusiey',
      interpreter: 'node',
      interpreter_args: '--import tsx',
      instances: 1,        // cluster.mjs forks the workers itself
      exec_mode: 'fork',
      autorestart: true,
      watch: false,
      max_memory_restart: '1024M',
      env: {
        NODE_ENV: 'production',
        WEB_INSTANCES: '2', // bump to your core count (nproc); leave 1 core for Postgres
      },
    },
  ],
};
