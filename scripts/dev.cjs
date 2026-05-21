const { spawn } = require('child_process')

// Some environments set ELECTRON_RUN_AS_NODE=1 which causes Electron
// to run in Node.js mode instead of Electron mode. We must ensure
// this variable is fully removed before starting electron-vite.
delete process.env.ELECTRON_RUN_AS_NODE

const child = spawn(process.argv[2], process.argv.slice(3), {
  stdio: 'inherit',
  shell: true
})

child.on('close', code => {
  process.exit(code ?? 1)
})
