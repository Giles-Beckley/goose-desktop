const { spawn } = require('child_process');
const electronPath = require('electron');

// Remove ELECTRON_RUN_AS_NODE from the environment
// so Electron runs as a real Electron app, not a Node.js process
const env = { ...process.env };
delete env.ELECTRON_RUN_AS_NODE;

const child = spawn(electronPath, ['.'], {
  stdio: 'inherit',
  env,
  cwd: process.cwd(),
});

child.on('close', (code) => {
  process.exit(code ?? 0);
});

child.on('error', (err) => {
  console.error('Failed to start Electron:', err);
  process.exit(1);
});
