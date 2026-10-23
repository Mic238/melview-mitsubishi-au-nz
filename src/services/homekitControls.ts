import type {CharacteristicValue, PlatformAccessory, Service} from 'homebridge';
import type {WithUUID} from 'homebridge';
import {Unit, WorkMode} from '../data';
import {AbstractCommand, CommandPower, Command} from '../melviewCommand';
import {MelviewMitsubishiHomebridgePlatform} from '../platform';
import {HeatCoolService} from './heatCoolService';

export class ModeCommand extends AbstractCommand {
  execute() {
    const mode = Number(this.value);
    if (![WorkMode.FAN, WorkMode.DRY].includes(mode)) {
      throw new Error('Invalid mode');
    }
    this.device.state!.setmode = mode;
    return 'MD' + mode;
  }
}

export class HomeKitControls {
  private readonly device: Unit;
  public readonly fanMode?: Service;
  public readonly dryMode?: Service;

  constructor(
    private readonly platform: MelviewMitsubishiHomebridgePlatform,
    private readonly accessory: PlatformAccessory,
    private readonly heatCool: HeatCoolService,
  ) {
    this.device = accessory.context.device;
    const {Service: S, Characteristic: C} = platform;
    const add = (name: string, subtype: string): Service => {
      const service = accessory.getServiceById(S.Switch, subtype) || accessory.addService(S.Switch, name, subtype);
      service.setCharacteristic(C.Name, name);
      if (!service.testCharacteristic(C.ConfiguredName)) {
        service.addOptionalCharacteristic(C.ConfiguredName);
      }
      service.setCharacteristic(C.ConfiguredName, name);
      return service;
    };
    const remove = (type: WithUUID<typeof Service>, subtype?: string) => {
      const service = subtype ? accessory.getServiceById(type, subtype) : accessory.getService(type);
      if (service) {
        accessory.removeService(service);
      }
    };

    // Speed remains on HeaterCooler; migrate cached companion fans from earlier patches.
    remove(S.Fanv2, 'mitsubishi-fan-speed');
    if (platform.config.fan === true) {
      this.fanMode = add(this.device.room + ' Fan Mode', 'mitsubishi-fan-mode');
      this.fanMode.getCharacteristic(C.On).onGet(() => this.isMode(WorkMode.FAN))
        .onSet(value => this.mode(WorkMode.FAN, value));
    } else {
      remove(S.Switch, 'mitsubishi-fan-mode');
    }
    if (platform.config.dry === true && Number(this.device.capabilities!.hasdrymode) === 1) {
      this.dryMode = add(this.device.room + ' Dry Mode', 'mitsubishi-dry-mode');
      this.dryMode.getCharacteristic(C.On).onGet(() => this.isMode(WorkMode.DRY))
        .onSet(value => this.mode(WorkMode.DRY, value));
    } else {
      remove(S.Switch, 'mitsubishi-dry-mode');
    }
    // The original dehumidifier service had no humidity measurement; use the mode switch instead.
    remove(S.HumidifierDehumidifier);
    platform.log.info('HomeKit built-in fan speed' + (this.fanMode ? ', Fan Mode' : '') +
      (this.dryMode ? ', Dry Mode' : '') + ':', this.device.room);
  }

  isMode(mode: WorkMode) {
    return Number(this.device.state!.power) === 1 && Number(this.device.state!.setmode) === mode;
  }

  async send(...commands: Command[]) {
    await this.platform.melviewService!.command(commands[0], ...commands.slice(1));
    await this.sync();
  }

  async mode(mode: WorkMode, on: CharacteristicValue) {
    if (on) {
      await this.send(new ModeCommand(mode, this.device, this.platform),
        new CommandPower(1, this.device, this.platform));
    } else if (this.isMode(mode)) {
      // A stale OFF for the other mode must not power down the selected mode.
      await this.send(new CommandPower(0, this.device, this.platform));
    }
  }

  async sync() {
    const C = this.platform.Characteristic;
    if (this.fanMode) {
      this.fanMode.updateCharacteristic(C.On, this.isMode(WorkMode.FAN));
    }
    if (this.dryMode) {
      this.dryMode.updateCharacteristic(C.On, this.isMode(WorkMode.DRY));
    }
    const service = this.heatCool.getService();
    for (const [characteristic, getter] of [
      [C.Active, () => this.heatCool.getActive()],
      [C.CurrentHeaterCoolerState, () => this.heatCool.getCurrentHeaterCoolerState()],
      [C.TargetHeaterCoolerState, () => this.heatCool.getTargetHeaterCoolerState()],
      [C.CurrentTemperature, () => this.heatCool.getCurrentTemperature()],
      [C.RotationSpeed, () => this.heatCool.getRotationSpeed()],
      [C.CoolingThresholdTemperature, () => this.heatCool.getCoolingThresholdTemperature()],
      [C.HeatingThresholdTemperature, () => this.heatCool.getHeatingThresholdTemperature()],
    ] as const) {
      service.updateCharacteristic(characteristic, await getter());
    }
  }
}
