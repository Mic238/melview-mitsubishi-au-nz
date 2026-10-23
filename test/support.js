const {createRequire} = require('node:module');
const path = require('node:path');
const entry = require.resolve('homebridge');
const homebridgeRequire = createRequire(entry);
// Resolve through the installed Homebridge package so its own HAP copy is used.
let hap;
try {
  hap = homebridgeRequire('@homebridge/hap-nodejs');
} catch (error) {
  if (error.code !== 'MODULE_NOT_FOUND') throw error;
  hap = homebridgeRequire('hap-nodejs');
}
module.exports = {hap, homebridgeDirectory: path.dirname(entry)};
