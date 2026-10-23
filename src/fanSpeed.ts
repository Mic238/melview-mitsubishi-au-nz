import {Unit} from './data';
// Mitsubishi Wi-Fi Control's fanStageInfo table (https://app.melview.net/js/ex.js).
const stages: Record<number, number[]> = { 1: [5], 2: [2, 5], 3: [2, 3, 5], 4: [2, 3, 5, 6], 5: [1, 2, 3, 5, 6] };
export function fanCodes(device: Unit): number[] {
  const count = Number(device.capabilities?.fanstage ?? device.state!.fanstage);
  if (!stages[count]) {
    throw new Error('Unsupported Mitsubishi fan stage count: ' + count);
  }
  return stages[count];
}
export function toFanCode(value: number, device: Unit): number {
  value = Number(value);
  if (!Number.isFinite(value) || value < 0 || value > 100) {
    throw new Error('Invalid fan speed');
  }
  if (value === 0 && Number(device.capabilities?.hasautofan) === 1) {
    return 0;
  }
  const codes = fanCodes(device);
  return codes[codes.findIndex((code, index) => value <= Math.round((index + 1) * 100 / codes.length))];
}
export function toPercentage(device: Unit): number {
  const code = Number(device.state!.setfan);
  if (code === 0) {
    return 0;
  }
  const codes = fanCodes(device);
  const index = codes.indexOf(code);
  if (index < 0) {
    throw new Error('Unsupported Mitsubishi fan speed: ' + code);
  }
  return Math.round((index + 1) * 100 / codes.length);
}
