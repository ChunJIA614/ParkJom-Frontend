/**
 * vehicleStorage.ts
 * Read-through cache for the commuter's vehicles.
 *
 * `GET /api/vehicle/my-vehicle` is the single source of truth. This module only
 * mirrors the last successful response so the vehicle switcher can paint
 * instantly on reload instead of flashing an empty state.
 *
 * It must never invent a vehicle: an empty or unreadable cache resolves to `[]`
 * and the UI shows its "no vehicles yet" state. A fabricated placeholder here
 * would leak a car the commuter does not own into booking confirmation.
 */

import type { VehicleApiData } from '../api/vehicleApi';
import type { Vehicle } from '../types';

export type { Vehicle };

/**
 * v2 intentionally drops the pre-API cache. The old key could hold a
 * hard-coded demo vehicle, and the persistence effect would have saved it back
 * to storage for any user who opened the Vehicles tab.
 */
const CACHE_KEY = (userId: number) => `parkjom.vehicles.v2.${userId}`;
const LEGACY_CACHE_KEY = (userId: number) => `parkjom.vehicles.${userId}`;

/** Map a backend vehicle onto the UI shape. */
export function mapApiVehicleToVehicle(data: VehicleApiData, active = false): Vehicle {
  return {
    vehicleId: data.vehicleId,
    plate: data.numberPlate.trim().toUpperCase(),
    brand: data.vehicleBrand.trim(),
    model: data.vehicleModel.trim(),
    color: data.vehicleColor.trim(),
    active,
  };
}

/**
 * Apply the commuter's active selection to a fresh list, falling back to the
 * first vehicle when the previous selection no longer exists.
 */
export function applyActiveVehicle(
  vehicles: Vehicle[],
  activeVehicleId: number | null,
): Vehicle[] {
  if (vehicles.length === 0) return [];
  const matchedIndex = vehicles.findIndex((vehicle) => vehicle.vehicleId === activeVehicleId);
  const resolvedIndex = matchedIndex >= 0 ? matchedIndex : 0;
  return vehicles.map((vehicle, index) => ({ ...vehicle, active: index === resolvedIndex }));
}

function readCache(userId: number): Vehicle[] {
  try {
    const rawVehicles = localStorage.getItem(CACHE_KEY(userId));
    if (!rawVehicles) return [];

    const parsed = JSON.parse(rawVehicles) as unknown;
    if (!Array.isArray(parsed)) return [];

    const vehicles = parsed.filter((value): value is Vehicle => {
      if (!value || typeof value !== 'object') return false;
      const vehicle = value as Partial<Vehicle>;
      return (
        typeof vehicle.vehicleId === 'number'
        && Number.isFinite(vehicle.vehicleId)
        && vehicle.vehicleId > 0
        && typeof vehicle.plate === 'string'
        && Boolean(vehicle.plate.trim())
        && typeof vehicle.brand === 'string'
        && typeof vehicle.model === 'string'
        && typeof vehicle.color === 'string'
        && typeof vehicle.active === 'boolean'
      );
    });

    if (vehicles.length === 0) return [];

    const activeIndex = vehicles.findIndex((vehicle) => vehicle.active);
    const selectedIndex = activeIndex >= 0 ? activeIndex : 0;

    return vehicles.map((vehicle, index) => ({
      ...vehicle,
      plate: vehicle.plate.trim().toUpperCase(),
      brand: vehicle.brand.trim(),
      model: vehicle.model.trim(),
      color: vehicle.color.trim(),
      active: index === selectedIndex,
    }));
  } catch {
    return [];
  }
}

/** Remove the pre-API cache so a stale placeholder can never resurface. */
function purgeLegacyCache(userId: number) {
  try {
    localStorage.removeItem(LEGACY_CACHE_KEY(userId));
  } catch {
    // Ignore disabled or quota-exhausted storage.
  }
}

export const loadCachedVehicles = (userId: number): Vehicle[] => {
  purgeLegacyCache(userId);
  return readCache(userId);
};

export const saveCachedVehicles = (userId: number, vehicles: Vehicle[]) => {
  try {
    if (vehicles.length === 0) {
      localStorage.removeItem(CACHE_KEY(userId));
      return;
    }
    localStorage.setItem(CACHE_KEY(userId), JSON.stringify(vehicles));
  } catch {
    // Ignore storage quota or disabled storage failures.
  }
};
