/**
 * vehicleStorage.ts
 * Manages commuter vehicle data locally in the browser (localStorage)
 * without making unnecessary network requests to /api/vehicle/my-vehicle.
 */

export interface Vehicle {
  vehicleId: number | null;
  plate: string;
  brand: string;
  model: string;
  color: string;
  active: boolean;
}

const VEHICLE_CACHE_KEY = (userId: number) => `parkjom.vehicles.${userId}`;

export const loadCachedVehicles = (userId: number): Vehicle[] => {
  try {
    const rawVehicles = localStorage.getItem(VEHICLE_CACHE_KEY(userId));
    if (!rawVehicles) {
      return [
        {
          vehicleId: 1,
          plate: 'WXY 8899',
          brand: 'Perodua',
          model: 'Myvi',
          color: 'White',
          active: true,
        },
      ];
    }

    const parsed = JSON.parse(rawVehicles) as unknown;
    if (!Array.isArray(parsed) || parsed.length === 0) {
      return [
        {
          vehicleId: 1,
          plate: 'WXY 8899',
          brand: 'Perodua',
          model: 'Myvi',
          color: 'White',
          active: true,
        },
      ];
    }

    const vehicles = parsed.filter((value): value is Vehicle => {
      if (!value || typeof value !== 'object') return false;
      const vehicle = value as Partial<Vehicle>;
      return (
        typeof vehicle.vehicleId === 'number' &&
        Number.isFinite(vehicle.vehicleId) &&
        vehicle.vehicleId > 0 &&
        typeof vehicle.plate === 'string' &&
        Boolean(vehicle.plate.trim()) &&
        typeof vehicle.brand === 'string' &&
        typeof vehicle.model === 'string' &&
        typeof vehicle.color === 'string' &&
        typeof vehicle.active === 'boolean'
      );
    });

    const activeIndex = vehicles.findIndex((vehicle) => vehicle.active);
    const selectedIndex = activeIndex >= 0 ? activeIndex : vehicles.length > 0 ? 0 : -1;

    return vehicles.map((vehicle, index) => ({
      ...vehicle,
      plate: vehicle.plate.trim().toUpperCase(),
      brand: vehicle.brand.trim(),
      model: vehicle.model.trim(),
      color: vehicle.color.trim(),
      active: index === selectedIndex,
    }));
  } catch {
    return [
      {
        vehicleId: 1,
        plate: 'WXY 8899',
        brand: 'Perodua',
        model: 'Myvi',
        color: 'White',
        active: true,
      },
    ];
  }
};

export const saveCachedVehicles = (userId: number, vehicles: Vehicle[]) => {
  try {
    localStorage.setItem(VEHICLE_CACHE_KEY(userId), JSON.stringify(vehicles));
  } catch {
    // Ignore storage quota or disabled storage failures.
  }
};
