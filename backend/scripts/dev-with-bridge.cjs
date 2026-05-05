const { spawn } = require('child_process');

function run(name, args) {
  const child = spawn('node', args, {
    cwd: process.cwd(),
    env: process.env,
    stdio: 'inherit',
    shell: false,
  });
  child.on('error', (err) => {
    console.error(`[${name}] failed to start:`, err && err.message ? err.message : err);
  });
  return child;
}

const api = run('api', ['--watch', 'server.js']);
const bridge = run('bridge', ['--watch', 'worldline-bridge.js']);

let shuttingDown = false;
function shutdown(code = 0) {
  if (shuttingDown) return;
  shuttingDown = true;
  try { api.kill('SIGINT'); } catch {}
  try { bridge.kill('SIGINT'); } catch {}
  setTimeout(() => process.exit(code), 300);
}

api.on('exit', (code) => {
  if (!shuttingDown) {
    console.error(`[api] exited (${code ?? 0}), stopping bridge...`);
    shutdown(code ?? 0);
  }
});

bridge.on('exit', (code) => {
  if (!shuttingDown) {
    console.error(`[bridge] exited (${code ?? 0}), stopping api...`);
    shutdown(code ?? 0);
  }
});

process.on('SIGINT', () => shutdown(0));
process.on('SIGTERM', () => shutdown(0));

