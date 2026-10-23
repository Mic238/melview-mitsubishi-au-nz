
<p align="center">

<img src="https://github.com/Mic238/melview-mitsubishi-au-nz/raw/master/assets/Logo.png">

</p>

# Homebridge Melview AU/NZ Airconditioners

Fork of [aurc/melview-mitsubishi-au-nz](https://github.com/aurc/melview-mitsubishi-au-nz) with optional Fan/Dry switches and capability-based fan speeds.


[![npm](https://img.shields.io/npm/v/homebridge-airconditioner-mitsubishi-au-nz/latest?label=latest)](https://www.npmjs.com/package/homebridge-airconditioner-mitsubishi-au-nz)
[![GitHub release](https://img.shields.io/github/release/aurc/melview-mitsubishi-au-nz.svg)](https://github.com/Mic238/melview-mitsubishi-au-nz/releases)
[![npm](https://img.shields.io/npm/dt/homebridge-airconditioner-mitsubishi-au-nz)](https://www.npmjs.com/package/homebridge-airconditioner-mitsubishi-au-nz)

[![Github CI](https://github.com/Mic238/melview-mitsubishi-au-nz/actions/workflows/build.yml/badge.svg)](https://github.com/Mic238/melview-mitsubishi-au-nz/actions)
[![Github CD](https://github.com/Mic238/melview-mitsubishi-au-nz/actions/workflows/release.yml/badge.svg)](https://github.com/Mic238/melview-mitsubishi-au-nz/actions)
[![Hex.pm](https://img.shields.io/hexpm/l/plug)](https://www.apache.org/licenses/LICENSE-2.0)

Use this plugin to integrate your Mitsubishi Airconditioner appliances with Apple's HomeKit using Homebridge.

## Overview

This plugin allows you to control the basic functionalities of your AC units through the home app and Siri. The features include:
- Instant unit response - update the unit directly via LAN interface & cloud Melview.
- Automatically find all appliances linked to your account;
- Control power ON/OFF
- Set mode AUTO, HEAT, COOL
- Optional Fan Mode and Dry Mode switches, each disabled by default.
- Capability-based fan speed adjustment inside the existing air conditioner settings.
- Set desired temperature
- Obtain unit status, e.g. power, mode, room temperature and desired temperature.

This project is a hobby project and was created to address the need for a stable plugin
in AU/NZ to control Mitsubishi Air Conditioners. It was possible due to the great
reverse engineering effort done by these folks: [NovaGL/diy-melview](https://github.com/NovaGL/diy-melview).

Also note that the [Homebridge](https://homebridge.io/) put together excellent developer
documentation which made it possible to get up and running quickly (e.g.
[plugin-temeplate](https://github.com/homebridge/homebridge-plugin-template))!

## Compatibility & Pre-requisites

It should work with most modern Mitsubishi Electric Airconditioner units that are Wi-Fi capable.
This plugin has been developed and tested against the following products:
| Model                                                                                              | Wi-Fi Module                                    |
| -------------------------------------------------------------------------------------------------- | ----------------------------------------------- |
| [MSZ-GL71VGD](https://www.mitsubishielectric.com.au/assets/LEG/JG79A991H01-UM.pdf)                 | [MAC-568IF-E](https://www.mitsubishielectric.com.au/assets/LEG/MAC-568IF-E.pdf)   |
| [MSZ-GL35VGD](https://www.mitsubishielectric.com.au/assets/LEG/JG79A991H01-UM.pdf)                 | [MAC-568IF-E](https://www.mitsubishielectric.com.au/assets/LEG/MAC-568IF-E.pdf)   |
| [MSZ-AP25VGD](https://www.mitsubishielectric.com.au/assets/LEG/MSZ-AP-User-Manual-JG79Y333H01.pdf) | [MAC-568IF-E](https://www.mitsubishielectric.com.au/assets/LEG/MAC-568IF-E.pdf)   |

In a nutshell, if you were able to install the **[Wi-Fi Control App](https://apps.apple.com/au/app/mitsubishi-wi-fi-control/id796225889#?platform=iphone)** and operate the unit, this plugin is for you!

Netheless to say, you should have **[Homebridge](https://homebridge.io/)** running.

## Coming Soon
Some capabilities are not yet available and should be released soon:
- Swing;

## Known issues
- **Dry mode**: A unit may ignore fan-speed adjustments while drying; the indoor unit remains responsible for its dry-cycle behavior.
- **LAN access**: Still requires internet connection, as it authenticates the requests with Melview cloud. It still
operates way faster than Alexa and Goolge home integration as it has a fast follower command locally removing
the know lag.


## Installation

### Through Homebridge Config UI
Install this fork using the CLI command below, then configure it with the [Homebridge Config UI X](https://github.com/oznu/homebridge-config-ui-x).
1. Access the settings and configure the credentials as per the required fields.
2. Save and restart homebridge.
3. All units in your network should be automatically recognised. Open your Home App and allocate them to their respective rooms.

### Through CLI

You can install the package manually by issuing:
````
npm install -g git+https://github.com/Mic238/melview-mitsubishi-au-nz.git
````
and configuring the plugin file `config.json` as:
````
{
    "bridge": {
        //...
    },
    "accessories": [],
    "platforms": [
        {
            "user": "user@domain.com",
            "password": "yourpassword",
            "platform": "MitsubishiAUNZ",
            "fan": false,
            "dry": false
        }
    ]
}
````
where **user** is your user name, typically the email you used to register with the app
and **password** is your account password.

## Fan speed and optional modes

Fan speed remains on the original HeaterCooler service, inside the air conditioner's settings in Apple Home. This fork does not add a separate fan-speed tile. Speed changes preserve the current operating mode and power state.

Enable **Expose Fan Mode** (`fan: true`) or **Expose Dry Mode** (`dry: true`) in the plugin settings to show the corresponding HomeKit switch. Both default to off. Dry Mode is offered only when the unit reports dry-mode support. Disabling either option removes its cached HomeKit switch without changing the physical unit's mode or power. Apply changes with the Homebridge UI's child-bridge restart action or a full Homebridge restart.

The optional mode switches turn the unit on in the selected mode. Turning a switch off powers down only if that mode is still selected. Selecting Fan or Dry updates the other switch and the heating/cooling status. Apple's standard HeaterCooler selector supports Auto, Heat and Cool; Fan and Dry therefore use separate switches.

The fan mapping follows Mitsubishi Wi-Fi Control's [fanStageInfo table](https://app.melview.net/js/ex.js):

| Manual stages | Mitsubishi fan command values | HomeKit speeds |
| --- | --- | --- |
| 1 | 5 | 100% |
| 2 | 2, 5 | 50%, 100% |
| 3 | 2, 3, 5 | 33%, 67%, 100% |
| 4 | 2, 3, 5, 6 | 25%, 50%, 75%, 100% |
| 5 | 1, 2, 3, 5, 6 | 20%, 40%, 60%, 80%, 100% |

For a two-stage unit, 50% selects Low and 100% selects High. Zero selects automatic fan speed only when supported; otherwise it selects the lowest manual speed. Intermediate requests select a supported stage, and the polled state reports that stage's percentage.

Cloud writes are serialized and rejected commands report an error to HomeKit. Polls started before a write cannot overwrite its new state. Changes made in the Mitsubishi app update HomeKit on the five-second poll.

## Development

Use Node.js 18 or newer for the test runner (validated with Node.js 22). Install the locked dependencies and run:

```sh
npm ci
npm run lint
npm test
```

`npm test` compiles TypeScript and runs nine offline regression tests using the real HAP library. The tests cover fan stages, the original speed-control layout, Fan/Dry switching, optional-service removal and restoration, default-off config, app status synchronization, and failed/serialized writes. They require no account credentials and send no air-conditioner commands.

## Questions & Issues
If you have issues, found a bug or have a question, please open an issue **[here](https://github.com/Mic238/melview-mitsubishi-au-nz/issues)**.


