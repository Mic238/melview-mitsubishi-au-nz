const fs = require('node:fs');
const os = require('node:os');
const path = require('node:path');
const {spawnSync} = require('node:child_process');
const root = path.join(__dirname, '..');
const versions = process.argv.slice(2).length ? process.argv.slice(2) : ['1.3.1', '1.11.4', '2.0.0', '2.4.0'];
const temporary = fs.mkdtempSync(path.join(os.tmpdir(), 'mitsubishi-homebridge-compat-'));
const npm = process.env.npm_execpath;
const cache = path.join(temporary, 'npm-cache');
if (!npm) throw new Error('Run this script with npm run test:compat');
function run(command, args, cwd, capture = false) {
  const result = spawnSync(command, args, {cwd, encoding: 'utf8', stdio: capture ? 'pipe' : 'inherit'});
  if (result.error) throw result.error;
  if (result.status !== 0) {
    if (capture) process.stderr.write((result.stdout || '') + (result.stderr || ''));
    throw new Error(command + ' exited with ' + result.status);
  }
  return result.stdout;
}
try {
  run(process.execPath, [path.join(root, 'scripts/build.cjs')], root);
  const pack = JSON.parse(run(process.execPath,
    [npm, 'pack', '--json', '--ignore-scripts', '--cache', cache, '--pack-destination', temporary], root, true))[0];
  const archive = path.join(temporary, pack.filename);
  const name = require('../package.json').name;
  for (const version of versions) {
    console.log('\nChecking Homebridge ' + version + ' on ' + process.version);
    const fixture = path.join(temporary, version);
    fs.mkdirSync(fixture);
    fs.writeFileSync(path.join(fixture, 'package.json'), JSON.stringify({private: true}));
    run(process.execPath, [npm, 'install', '--ignore-scripts', '--no-audit', '--no-fund',
      '--cache', cache, 'homebridge@' + version, archive], fixture);
    const installed = path.join(fixture, 'node_modules', name);
    fs.cpSync(path.join(root, 'test'), path.join(installed, 'test'), {recursive: true});
    // Type-check the source against this exact Homebridge version, not just our default dev version.
    const source = path.join(fixture, 'source');
    fs.mkdirSync(source);
    fs.cpSync(path.join(root, 'src'), path.join(source, 'src'), {recursive: true});
    fs.copyFileSync(path.join(root, 'tsconfig.json'), path.join(source, 'tsconfig.json'));
    run(process.execPath, [require.resolve('typescript/bin/tsc'), '--noEmit', '-p', source], fixture);
    run(process.execPath, ['--test', 'test/homekit.cjs', 'test/loader.cjs'], installed);
    console.log('PASS Homebridge ' + version + ': source types, installed package, CJS/ESM entries and HomeKit controls.');
  }
} finally {
  fs.rmSync(temporary, {recursive: true, force: true});
}
