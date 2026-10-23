<p align="center">
  <img src="assets/Logo.png" alt="Mitsubishi Homebridge plugin">
</p>

# Mitsubishi Electric AU/NZ Homebridge plugin

Control Mitsubishi Electric air conditioners registered in the AU/NZ **Mitsubishi Wi-Fi Control** app through Apple Home and Siri.

This is a fork of [aurc/melview-mitsubishi-au-nz](https://github.com/aurc/melview-mitsubishi-au-nz). It adds optional Fan Mode and Dry Mode switches, fixes the dry-mode configuration bug, and maps fan speeds to each unit's supported stages.

[![Build and lint](https://github.com/Mic238/melview-mitsubishi-au-nz/actions/workflows/build.yml/badge.svg)](https://github.com/Mic238/melview-mitsubishi-au-nz/actions/workflows/build.yml)

## Features

- Automatic discovery of units linked to your Mitsubishi account.
- Power, Auto/Heat/Cool mode, target temperature and room-temperature readings.
- Fan speed inside the existing air conditioner's settings in Apple Home.
- Optional **Fan Mode** and **Dry Mode** HomeKit switches, both **off by default**.
- Fan-speed mapping based on the unit's reported capabilities, from one to five manual stages.
- Status updates from the Mitsubishi app through a five-second poll.
- Cloud commands with direct LAN delivery when the adapter is reachable.
- Serialized writes and error reporting to HomeKit when Mitsubishi rejects a command.

## Supported Homebridge versions

Version 1.3.0 supports **Homebridge 1.3+ and Homebridge 2.x** on **Node.js 22.12+ within v22, or Node.js 24.x**. The package provides CommonJS and ESM entry points and imports HAP types through Homebridge's public API. Its runtime uses the HAP instance supplied by the running Homebridge version.

Upgrading the plugin preserves the platform identifier and device UUIDs. Fan Mode and Dry Mode remain off by default, and fan speed stays inside the existing AC settings.

## Install this fork

Install from this repository to get these changes:

```sh
npm install -g git+https://github.com/Mic238/melview-mitsubishi-au-nz.git
```

Use the Node.js installation and npm context that your Homebridge service uses. The GitHub installation builds the TypeScript source automatically. The package name remains `homebridge-airconditioner-mitsubishi-au-nz`.

In Homebridge Config UI, open the plugin settings, enter your Mitsubishi Wi-Fi Control credentials, save, and restart Homebridge. Discovered units appear in Apple Home through the existing Homebridge pairing.

To update this fork, run the same installation command again and restart Homebridge.

## Configuration

Add this platform entry to the `platforms` array in your Homebridge `config.json`, or use the plugin settings UI:

```json
{
  "platform": "MitsubishiAUNZ",
  "user": "user@example.com",
  "password": "your-mitsubishi-password",
  "fan": false,
  "dry": false
}
```

| Setting | Default | Effect |
| --- | --- | --- |
| `user` | Required | Mitsubishi Wi-Fi Control username. |
| `password` | Required | Mitsubishi Wi-Fi Control password. |
| `fan` / **Expose Fan Mode** | `false` | Show a switch that selects fan-only mode. |
| `dry` / **Expose Dry Mode** | `false` | Show a switch that selects drying, when the unit supports it. |

Apply configuration changes using the Homebridge UI's **child-bridge restart** action or a full Homebridge restart. Disabling an exposure setting removes its HomeKit switch without changing the air conditioner's physical mode or power.

Both optional mode switches remain available in the plugin config when their HomeKit exposure is off. Fan-speed adjustment remains available with either option disabled.

## Apple Home controls

### Fan speed

Fan speed stays on the original HeaterCooler service, inside the air conditioner's settings. There is no separate Fan Speed tile.

For a two-speed unit:

- **50% = Low**.
- **100% = High**.

Changing fan speed preserves the selected operating mode and power state. Intermediate percentages select a supported stage; the next status refresh reports that stage's percentage. A zero request selects automatic fan speed only on units that support it; otherwise it selects the lowest manual speed.

### Optional Fan Mode and Dry Mode switches

Enable either option in the plugin config to expose its switch in Apple Home.

- Turning a mode switch **on** selects that mode and powers the unit on.
- Turning it **off** powers the unit down only if that mode is still selected.
- Selecting Fan or Dry updates the other switch and the heating/cooling status.
- Turning the original heating/cooling control on from Fan or Dry returns to its displayed climate mode.

Apple's standard HeaterCooler mode selector supports Auto, Heat and Cool. Fan and Dry use separate switches because they cannot be added to that selector. The Dry switch does not invent a humidity reading or expose a humidity target.

## Compatibility and verification

The plugin uses the AU/NZ Melview service used by the Mitsubishi Wi-Fi Control app. Units must be linked to that account, and Homebridge must be able to reach the Mitsubishi service. Direct LAN delivery additionally requires access to the unit's Wi-Fi adapter.

| Indoor unit | Wi-Fi adapter | Verification |
| --- | --- | --- |
| PEA-RP140GAA | MAC-578 (`mac578`) | This fork: live Fan, Dry, Low and High commands confirmed, with original settings restored afterward. |
| MSZ-GL71VGD | MAC-568IF-E | Reported by the original project. |
| MSZ-GL35VGD | MAC-568IF-E | Reported by the original project. |
| MSZ-AP25VGD | MAC-568IF-E | Reported by the original project. |

Live AC integration was checked with Homebridge 1.11.4. The source types and installed package are regression-tested against Homebridge **1.3.1, 1.11.4, 2.0.0 and 2.4.0**. Homebridge 2 checks are offline; the running AC installation was not upgraded for these tests.

## Fan-speed mapping

The mapping follows Mitsubishi Wi-Fi Control's [`fanStageInfo` table](https://app.melview.net/js/ex.js):

| Manual stages | Mitsubishi command values | HomeKit speeds |
| --- | --- | --- |
| 1 | 5 | 100% |
| 2 | 2, 5 | 50%, 100% |
| 3 | 2, 3, 5 | 33%, 67%, 100% |
| 4 | 2, 3, 5, 6 | 25%, 50%, 75%, 100% |
| 5 | 1, 2, 3, 5, 6 | 20%, 40%, 60%, 80%, 100% |

## Limitations

- An internet connection is required for authentication and cloud commands, including when direct LAN delivery is available.
- Swing controls are not implemented.
- A unit may ignore fan-speed adjustments during its dry cycle.
- The five-second polling interval means Mitsubishi app changes can take a few seconds to appear in Apple Home.

## Development

Use Node.js 22.12+ within v22, or Node.js 24.x. Development dependencies target Homebridge 2; the compatibility matrix checks Homebridge 1 as well.

```sh
npm ci
npm run lint
npm test
npm run test:compat
```

`npm test` builds the TypeScript source and runs eleven offline regression tests using the real HAP library. They cover fan-stage mappings, the original speed-control layout, mode switching, default-off config, cached service removal and restoration, status synchronization, and failed/serialized writes. The additional loader tests exercise both module entry points and the real Homebridge plugin loader, accessory registration and cache restoration. They require no credentials and send no air-conditioner commands.

`npm run test:compat` installs the packed plugin in temporary fixtures for all four Homebridge versions, type-checks the source against each version, and runs all eleven tests. CI runs the matrix on Node.js 22.12.0 and 24.x. You can check one version with `npm run test:compat -- 1.11.4`. The fixtures are removed afterward.

`npm run build` generates `dist`, including a CommonJS initializer and an ESM wrapper. The package includes the compiled runtime; source code and development tests remain in the Git repository.

## Credits and support

Thanks to [aurc](https://github.com/aurc/melview-mitsubishi-au-nz) for the original plugin, [NovaGL/diy-melview](https://github.com/NovaGL/diy-melview) for the Melview protocol work, and [Homebridge](https://homebridge.io/) for its platform and documentation.

Report issues with this fork in [Mic238/melview-mitsubishi-au-nz](https://github.com/Mic238/melview-mitsubishi-au-nz/issues).

Licensed under [Apache-2.0](LICENSE).
