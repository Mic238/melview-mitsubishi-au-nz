const fs = require('node:fs');
const path = require('node:path');
const {spawnSync} = require('node:child_process');
const root = path.join(__dirname, '..');
fs.rmSync(path.join(root, 'dist'), {recursive: true, force: true});
const result = spawnSync(process.execPath, [require.resolve('typescript/bin/tsc')], {cwd: root, stdio: 'inherit'});
if (result.error) throw result.error;
if (result.status !== 0) process.exit(result.status || 1);
// Homebridge 1 can require the CJS initializer; Homebridge 2 can import the ESM entry.
fs.writeFileSync(path.join(root, 'dist/index.mjs'), "import initialize from './index.js';\nexport default initialize;\n");
