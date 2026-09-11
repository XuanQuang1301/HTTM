const { spawn } = require('child_process');
const path = require('path');
const fs = require('fs');

const rootDir = path.resolve(__dirname, '..');
const venvPy = path.join(rootDir, 'venv', 'Scripts', 'python.exe');
const pyExec = fs.existsSync(venvPy) ? venvPy : 'python';

console.log(`[Backend Monorepo] Starting FastAPI server using Python: ${pyExec}`);

const child = spawn(pyExec, ['-m', 'uvicorn', 'backend.app:app', '--reload', '--port', '8000'], {
  cwd: rootDir,
  stdio: 'inherit'
});

child.on('exit', (code) => {
  process.exit(code || 0);
});
