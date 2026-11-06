const path = require('node:path');
const { spawnSync } = require('node:child_process');
const result = spawnSync('python', ['-B', path.join(__dirname, 'tools_test.py')], {
  stdio: 'inherit',
});
if (result.status !== 0) process.exit(result.status || 1);
