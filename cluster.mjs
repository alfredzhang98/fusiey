/**
 * Cluster launcher — forks N worker processes that SHARE port 3000, so one busy
 * worker (e.g. heavy image processing during a big upload) can't stall every
 * request. Each worker runs the TypeScript app via the tsx loader, so there is
 * NO build step — it's the same runtime as `npm run start:prod`.
 *
 * Run it:
 *   node --import tsx cluster.mjs
 * (PM2 does this via ecosystem.config.cjs.)
 *
 * Worker count: WEB_INSTANCES env (default 2). Keep it <= CPU cores (`nproc`);
 * on a box shared with PostgreSQL, leave ~1 core free.
 */
import cluster from 'node:cluster';
import os from 'node:os';

if (cluster.isPrimary) {
  const requested = Number(process.env.WEB_INSTANCES);
  const count = Number.isFinite(requested) && requested > 0
    ? requested
    : Math.min(2, os.cpus().length);
  console.log(`[Fusiey] cluster primary ${process.pid} → forking ${count} worker(s)`);
  for (let i = 0; i < count; i++) cluster.fork();
  // Keep the fleet alive: respawn a worker if one exits unexpectedly.
  cluster.on('exit', (worker, code, signal) => {
    console.error(`[Fusiey] worker ${worker.process.pid} exited (code ${code}, signal ${signal}) — restarting`);
    cluster.fork();
  });
} else {
  // Worker: boot the real app (listens on port 3000; the OS/cluster shares the
  // accept across workers). Inherits --import tsx from the primary's execArgv.
  await import('./server/src/app.ts');
}
