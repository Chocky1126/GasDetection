export interface SimulatedDevice {
  id: number;
  code: string;
  name: string;
  areaIndex: number;
  baseStationIndex: number;
  lng: number;
  lat: number;
  depth: number;
  batteryLevel: number;
}

export function createDevices(count: number): SimulatedDevice[] {
  return Array.from({ length: count }, (_, itemIndex) => {
    const index = itemIndex + 1;
    const areaIndex = itemIndex % 5;
    const baseStationIndex = itemIndex % 10;
    return {
      id: index,
      code: `GAS-${String(index).padStart(4, '0')}`,
      name: `四合一气体检测仪 ${String(index).padStart(3, '0')}`,
      areaIndex,
      baseStationIndex,
      lng: round(112.93 + areaIndex * 0.002 + (itemIndex % 7) * 0.0002, 6),
      lat: round(28.23 + areaIndex * 0.002 + (itemIndex % 5) * 0.0002, 6),
      depth: -300 - baseStationIndex * 15 - (itemIndex % 8) * 3,
      batteryLevel: 70 + (itemIndex % 31),
    };
  });
}

function round(value: number, digits: number): number {
  const factor = 10 ** digits;
  return Math.round(value * factor) / factor;
}
