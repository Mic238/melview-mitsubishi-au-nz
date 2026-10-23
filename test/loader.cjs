const { test } = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const { pathToFileURL } = require('node:url');
const { homebridgeDirectory } = require('./support.js');
const root = path.join(__dirname, '..');
test('CommonJS and ESM package entries expose the same platform initializer', async () => {
    const name = require('../package.json').name;
    const cjs = require(name);
    const esm = await import(name);
    assert.equal(typeof cjs, 'function');
    assert.equal(esm.default, cjs);
});
test('real Homebridge loader supports discovery, cached accessories and mode/speed handlers', async () => {
    const { Plugin } = await import(pathToFileURL(path.join(homebridgeDirectory, 'plugin.js')));
    const { HomebridgeAPI } = await import(pathToFileURL(path.join(homebridgeDirectory, 'api.js')));
    const pluginPath = root;
    const pkg = JSON.parse(fs.readFileSync(path.join(pluginPath, 'package.json')));
    const api = new HomebridgeAPI();
    let Platform;
    api.on('registerPlatform', (name, constructor) => { assert.equal(name, 'MitsubishiAUNZ'); Platform = constructor; });
    const plugin = new Plugin(pkg.name, pluginPath, pkg);
    await plugin.load();
    plugin.initialize(api);
    assert.equal(typeof Platform, 'function');
    const errors = [];
    const log = { debug() { }, info() { }, warn() { }, error(...args) { errors.push(args.join(' ')); } };
    const capabilities = { adaptortype: 'test-adapter', fanstage: 2, hasautofan: 0, hasdrymode: 1, localip: '127.0.0.1' };
    const state = { power: 1, setmode: 8, setfan: 2, settemp: '25', roomtemp: '25.5', error: 'ok',
        max: { 1: { min: 17, max: 28 }, 3: { min: 19, max: 30 } } };
    const unit = { room: 'Compatibility AC', unitid: 'offline-unit' };
    const timers = [];
    const originalSetInterval = globalThis.setInterval;
    globalThis.setInterval = (...args) => { const timer = originalSetInterval(...args); timer.unref(); timers.push(timer); return timer; };
    const platform = new Platform(log, { platform: 'MitsubishiAUNZ', user: 'offline', password: 'offline', fan: true, dry: true }, api);
    platform.melviewService = { pendingCommands: 0, commandRevision: 0,
        async login() { }, async discover() { return [{ buildingid: 'offline', building: 'Offline', units: [unit] }]; },
        async capabilities() { return capabilities; }, async getStatus() { return { ...state }; },
        async command(...commands) { return commands.map(c => c.execute()).join(','); } };
    let accessory;
    api.on('registerPlatformAccessories', accessories => { [accessory] = accessories; });
    try {
        await platform.discoverDevices();
        assert.equal(errors.length, 0, errors.join('\n'));
        assert.ok(accessory instanceof api.platformAccessory);
        const C = api.hap.Characteristic, S = api.hap.Service;
        const heat = accessory.getService(S.HeaterCooler);
        assert.ok(heat);
        const fan = accessory.getServiceById(S.Switch, 'mitsubishi-fan-mode');
        const dry = accessory.getServiceById(S.Switch, 'mitsubishi-dry-mode');
        assert.ok(fan);
        assert.ok(dry);
        await fan.getCharacteristic(C.On).handleSetRequest(true);
        assert.equal(accessory.context.device.state.setmode, 7);
        await dry.getCharacteristic(C.On).handleSetRequest(true);
        assert.equal(accessory.context.device.state.setmode, 2);
        await heat.getCharacteristic(C.RotationSpeed).handleSetRequest(100);
        assert.equal(accessory.context.device.state.setfan, 5);
        assert.equal(accessory.context.device.state.setmode, 2);
        // Cache restoration uses the actual Homebridge PlatformAccessory implementation.
        const restored = new Platform(log, { platform: 'MitsubishiAUNZ', user: 'offline', password: 'offline', fan: false, dry: false }, api);
        restored.melviewService = platform.melviewService;
        restored.configureAccessory(accessory);
        await restored.discoverDevices();
        assert.equal(errors.length, 0, errors.join('\n'));
        assert.equal(accessory.getServiceById(S.Switch, 'mitsubishi-fan-mode'), undefined);
        assert.equal(accessory.getServiceById(S.Switch, 'mitsubishi-dry-mode'), undefined);
        assert.ok(accessory.getService(S.HeaterCooler).testCharacteristic(C.RotationSpeed));
        assert.ok(api.serverVersion);
    }
    finally {
        globalThis.setInterval = originalSetInterval;
        for (const timer of timers)
            clearInterval(timer);
    }
});
