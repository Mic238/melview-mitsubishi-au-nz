import type {PlatformAccessory} from 'homebridge';

import {MelviewMitsubishiHomebridgePlatform} from './platform';
import {Unit} from './data';
import {HeatCoolService} from './services/heatCoolService';
import {HomeKitControls} from './services/homekitControls';

/**
 * Platform Accessory
 * An instance of this class is created for each accessory your platform registers
 * Each accessory may expose multiple services of different service types.
 */
export class MelviewMitsubishiPlatformAccessory {
  private controls: HomeKitControls;
  private acService: HeatCoolService;
  constructor(
        private readonly platform: MelviewMitsubishiHomebridgePlatform,
        private readonly accessory: PlatformAccessory,
  ) {
    const device: Unit = accessory.context.device;
        // set accessory information
        this.accessory.getService(this.platform.Service.AccessoryInformation)!
          .setCharacteristic(this.platform.Characteristic.Manufacturer, 'Mitsubishi Electric')
          .setCharacteristic(this.platform.Characteristic.Model, device.capabilities!.adaptortype)
          .setCharacteristic(this.platform.Characteristic.SerialNumber, device.unitid);

        /*********************************************************
         * HEATER & Cooler Capability
         * see https://developers.homebridge.io/#/service/HeaterCooler
         *********************************************************/
        this.acService = new HeatCoolService(this.platform, this.accessory);
        this.platform.log.info('HEAT/COOL Capability:', device.room, ' [COMPLETED]');

        /*********************************************************
         * Dehumidifier Capability
         * https://developers.homebridge.io/#/service/HumidifierDehumidifier
         *********************************************************/
        this.controls = new HomeKitControls(this.platform, this.accessory, this.acService);
        this.accessory.context.dry = this.platform.config.dry === true;

        /*********************************************************
         * Polling for state change
         *********************************************************/

        setInterval(() => {
          const service = this.platform.melviewService;
          if (!service || service.pendingCommands) {
            return;
          }
          const revision = service.commandRevision;
          this.platform.melviewService?.getStatus(
            this.accessory.context.device.unitid)
            .then(async s => {
              // this.platform.log.debug('Updating Accessory State:',
              //   this.accessory.context.device.unitid);
              if (service.pendingCommands || revision !== service.commandRevision) {
                return;
              }
              if (s.error !== 'ok') {
                throw new Error('Mitsubishi status error: ' + s.error);
              }
              this.accessory.context.device.state = s;
              await this.controls.sync();
            })
            .catch(e => {
              this.platform.log.error('Unable to find accessory status. Check the network');
              this.platform.log.debug(e);
            });
        }, 5000);
  }
}
