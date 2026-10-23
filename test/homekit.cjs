const { test } = require('node:test');
const assert = require('node:assert/strict');
const path = require('node:path');
const root = path.join(__dirname, '..');
const { Service, Characteristic: C, Accessory, uuid } = require('hap-nodejs');
const { HomeKitControls } = require(root + '/dist/services/homekitControls');
const { HeatCoolService } = require(root + '/dist/services/heatCoolService');
const { CommandRotationSpeed } = require(root + '/dist/melviewCommand');
const { toFanCode, toPercentage } = require(root + '/dist/fanSpeed');
function setup(dry = true) {
    const accessory = new Accessory('Air Conditioner', uuid.generate('mitsubishi-test'));
    accessory.context = {};
    accessory.context.device = {
        room: 'Air Conditioner', unitid: 'test',
        capabilities: { fanstage: 2, hasautofan: 0, hasdrymode: 1 },
        state: { power: 1, setmode: 8, setfan: 2, settemp: '25', roomtemp: '25.5',
            max: { 1: { min: 17, max: 28 }, 3: { min: 19, max: 30 } } },
    };
    const sent = [];
    const platform = { Service, Characteristic: C, api: { hap: { Characteristic: C } },
        config: { dry, fan: true }, log: { info() {}, debug() {}, warn() {} },
        melviewService: { async command(...commands) { sent.push(commands.map(c => c.execute()).join(',')); } } };
    const heat = new HeatCoolService(platform, accessory);
    const controls = new HomeKitControls(platform, accessory, heat);
    return { accessory, platform, controls, heat, sent, device: accessory.context.device };
}
test('Mitsubishi mappings match the app for one through five stages', () => {
    for (const [count, codes] of [[1,[5]], [2,[2,5]], [3,[2,3,5]], [4,[2,3,5,6]], [5,[1,2,3,5,6]]]) {
        const d = { capabilities: { fanstage: count, hasautofan: 0 }, state: {} };
        codes.forEach((code, i) => {
            const percentage = Math.round((i+1)*100/count);
            assert.equal(toFanCode(percentage, d), code);
            d.state.setfan = code;
            assert.equal(toPercentage(d), percentage);
        });
        assert.equal(toFanCode(0,d), codes[0]);
        d.capabilities.hasautofan = 1;
        assert.equal(toFanCode(0,d), 0);
        d.state.setfan = 0;
        assert.equal(toPercentage(d), 0);
    }
    assert.throws(() => toFanCode(NaN, setup().device));
});
test('HomeKit keeps speed in HeaterCooler and removes the old companion fan', async () => {
    const { accessory, platform, heat, controls } = setup();
    const ids = accessory.services.map(s => s.UUID + s.subtype);
    accessory.addService(Service.Fanv2, 'Air Conditioner Fan Speed', 'mitsubishi-fan-speed');
    new HomeKitControls(platform, accessory, heat);
    assert.deepEqual(accessory.services.map(s => s.UUID + s.subtype), ids);
    assert.equal(accessory.getService(Service.HumidifierDehumidifier), undefined);
    assert.equal(accessory.getService(Service.Fanv2), undefined);
    assert.equal(setup(false).controls.dryMode, undefined);
    await controls.sync();
    assert.equal(heat.getService().getCharacteristic(C.RotationSpeed).value, 50);
});
test('HomeKit writes select fan/dry, preserve speed and reject stale off writes', async () => {
    const { controls, sent, device } = setup();
    await controls.fanMode.getCharacteristic(C.On).handleSetRequest(true);
    assert.equal(sent.at(-1), 'MD7,PW1');
    assert.equal(device.state.setfan, 2);
    await controls.dryMode.getCharacteristic(C.On).handleSetRequest(true);
    assert.equal(sent.at(-1), 'MD2,PW1');
    const n = sent.length;
    await controls.fanMode.getCharacteristic(C.On).handleSetRequest(false);
    assert.equal(sent.length, n);
    assert.equal(controls.fanMode.getCharacteristic(C.On).value, false);
    await controls.dryMode.getCharacteristic(C.On).handleSetRequest(false);
    assert.equal(sent.at(-1), 'PW0');
    assert.equal(device.state.setmode, 2);
});
test('built-in speed preserves mode and power and uses only supported Low/High', async () => {
    const { controls, sent, device, heat } = setup();
    for (const mode of [1,2,3,7,8]) {
        device.state.setmode = mode;
        await heat.getService().getCharacteristic(C.RotationSpeed).handleSetRequest(50);
        assert.equal(sent.at(-1), 'FS2');
        await heat.getService().getCharacteristic(C.RotationSpeed).handleSetRequest(100);
        assert.equal(sent.at(-1), 'FS5');
        assert.equal(device.state.setmode, mode);
    }
    await heat.getService().getCharacteristic(C.RotationSpeed).handleSetRequest(0);
    assert.equal(sent.at(-1), 'FS2');
    assert.equal(device.state.power, 1);
    device.state.power = 0;
    await heat.getService().getCharacteristic(C.RotationSpeed).handleSetRequest(100);
    assert.equal(sent.at(-1), 'FS5');
    assert.equal(device.state.power, 0);
    assert.equal(await heat.getCurrentHeaterCoolerState(), C.CurrentHeaterCoolerState.INACTIVE);
});
test('heater resumes climate mode from fan/dry; Mitsubishi app changes update HomeKit', async () => {
    const { controls, heat, device, sent } = setup();
    device.state.setmode = 7;
    await controls.sync();
    await heat.setActive(0);
    assert.equal(sent.length, 0);
    await heat.setActive(1);
    assert.equal(device.state.setmode, 8);
    assert.equal(sent.at(-1), 'MD8,PW1');
    device.state = { ...device.state, setmode: 2, setfan: 5 };
    await controls.sync();
    assert.equal(controls.dryMode.getCharacteristic(C.On).value, true);
    assert.equal(controls.fanMode.getCharacteristic(C.On).value, false);
    assert.equal(heat.getService().getCharacteristic(C.RotationSpeed).value, 100);
    assert.equal(heat.getService().getCharacteristic(C.Active).value, C.Active.INACTIVE);
});
test('command errors propagate to the HomeKit write', async () => {
    const { controls, platform } = setup();
    platform.melviewService.command = async () => { throw new Error('cloud failure'); };
    await assert.rejects(controls.mode(7,true), /cloud failure/);
});
test('transport serializes writes and restores state after cloud rejection', async () => {
    const fetchPath = require.resolve('node-fetch', { paths: [root] });
    const requests = [];
    let reject = true;
    require.cache[fetchPath] = { id: fetchPath, filename: fetchPath, loaded: true,
        exports: async (url, options) => {
            requests.push(JSON.parse(options.body).commands);
            return { ok: true, json: async () => ({ error: reject ? 'invalid' : 'ok' }) };
        } };
    const { MelviewService } = require(root + '/dist/melviewService');
    const service = new MelviewService({ debug() {} }, {}, {});
    service.authWillExpire = () => false;
    service.populateHeaders = () => ({});
    const device = setup().device;
    await assert.rejects(service.command(new CommandRotationSpeed(100,device,{})), /rejected/);
    assert.equal(device.state.setfan, 2);
    assert.equal(service.pendingCommands, 0);
    reject = false;
    await Promise.all([service.command(new CommandRotationSpeed(100,device,{})),
        service.command(new CommandRotationSpeed(50,device,{}))]);
    assert.deepEqual(requests, ['FS5','FS5','FS2']);
    assert.equal(device.state.setfan, 2);
    assert.equal(service.pendingCommands, 0);
});

test('config toggles remove cached mode switches and can re-enable them without changing device state', async () => {
    const { accessory, platform, heat, device, sent } = setup();
    const before = { ...device.state };
    platform.config.fan = false;
    platform.config.dry = false;
    const disabled = new HomeKitControls(platform, accessory, heat);
    assert.equal(accessory.getServiceById(Service.Switch, 'mitsubishi-fan-mode'), undefined);
    assert.equal(accessory.getServiceById(Service.Switch, 'mitsubishi-dry-mode'), undefined);
    await disabled.sync();
    assert.deepEqual(device.state, before);
    assert.equal(sent.length, 0);
    assert.equal(heat.getService().testCharacteristic(C.RotationSpeed), true);
    platform.config.fan = true;
    platform.config.dry = true;
    new HomeKitControls(platform, accessory, heat);
    assert.ok(accessory.getServiceById(Service.Switch, 'mitsubishi-fan-mode'));
    assert.ok(accessory.getServiceById(Service.Switch, 'mitsubishi-dry-mode'));
});

test('optional Fan and Dry mode switches default off', async () => {
    const { accessory, platform, heat } = setup();
    delete platform.config.fan;
    delete platform.config.dry;
    const controls = new HomeKitControls(platform, accessory, heat);
    assert.equal(controls.fanMode, undefined);
    assert.equal(controls.dryMode, undefined);
    await controls.sync();
    const schema = require('../config.schema.json').schema.properties;
    assert.equal(schema.fan.default, false);
    assert.equal(schema.dry.default, false);
});
