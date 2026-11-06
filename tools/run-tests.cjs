/** Run each suite in a fresh process so prototype installers and worker mocks stay isolated. */
const fs = require('node:fs');
const path = require('node:path');
const { spawnSync } = require('node:child_process');
const root = path.resolve(__dirname, '..');
const includeWorld = process.argv.includes('--world');
const files = fs
  .readdirSync(path.join(root, 'tests'))
  .filter(
    (file) => file.endsWith('.test.cjs') && (includeWorld || file !== 'world-reference.test.cjs'),
  )
  .sort();
for (const file of files) {
  console.log(`\n${file}`);
  const result = spawnSync(process.execPath, [path.join(root, 'tests', file)], {
    cwd: root,
    stdio: 'inherit',
  });
  if (result.status !== 0) process.exit(result.status || 1);
}
console.log(`\nPassed ${files.length} suites.`);
