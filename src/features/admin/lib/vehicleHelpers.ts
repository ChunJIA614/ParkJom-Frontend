import { parseTimestamp, displayDateOptions } from '@/lib/dateTime';
import type { AdminVehicleDto } from '../types';
import { validateVehiclePlate } from '@/features/commuter/lib/plateValidation';

export interface VehicleTableSort {
  column: 'id' | 'plate' | 'brand' | 'model' | 'color' | 'owner' | 'created' | 'updated';
  direction: 'asc' | 'desc';
}

export interface VehicleFilterState {
  searchQuery: string;
  brandFilter: string;
  ownerFilter: string;
  sort: VehicleTableSort;
  currentUserEmail?: string | null;
}

export interface VehicleFormValues {
  numberPlate: string;
  vehicleBrand: string;
  vehicleModel: string;
  vehicleColor: string;
}

export const VEHICLE_COLOR_SUGGESTIONS = [
  'White',
  'Silver',
  'Black',
  'Grey',
  'Blue',
  'Red',
  'Gold',
  'Brown',
] as const;

const COLOR_SWATCH_MAP: Record<string, string> = {
  white: '#F8FAFC',
  pearl: '#F1F5F9',
  silver: '#CBD5E1',
  grey: '#64748B',
  gray: '#64748B',
  black: '#18181B',
  blue: '#2563EB',
  navy: '#1E3A8A',
  red: '#DC2626',
  maroon: '#881337',
  gold: '#D97706',
  yellow: '#EAB308',
  orange: '#EA580C',
  green: '#16A34A',
  brown: '#78350F',
  bronze: '#92400E',
  beige: '#D6D3D1',
  purple: '#7C3AED',
};

export function getVehicleColorSwatch(color: string): string {
  const normalized = color.trim().toLowerCase();
  if (!normalized) return '#94A3B8';
  for (const [key, hex] of Object.entries(COLOR_SWATCH_MAP)) {
    if (normalized.includes(key)) return hex;
  }
  return '#94A3B8';
}

export function formatVehicleDate(value: string): string {
  const date = parseTimestamp(value);
  return Number.isNaN(date.getTime())
    ? value || '—'
    : date.toLocaleString([], displayDateOptions({
        year: 'numeric',
        month: 'short',
        day: '2-digit',
        hour: '2-digit',
        minute: '2-digit',
      }));
}

export function getVehicleOwnerKey(vehicle: AdminVehicleDto): string {
  if (vehicle.ownerEmail?.trim()) return vehicle.ownerEmail.trim().toLowerCase();
  if (vehicle.ownerName?.trim()) return `name:${vehicle.ownerName.trim().toLowerCase()}`;
  return `unknown:${vehicle.vehicleId}`;
}

export function isVehicleOwnedByUser(
  vehicle: Pick<AdminVehicleDto, 'ownerEmail'>,
  userEmail?: string | null,
): boolean {
  const normalizedOwner = vehicle.ownerEmail?.trim().toLowerCase();
  const normalizedUser = userEmail?.trim().toLowerCase();
  return Boolean(normalizedOwner && normalizedUser && normalizedOwner === normalizedUser);
}

export function extractVehicleFilterOptions(vehicles: AdminVehicleDto[]): {
  brands: string[];
  owners: { key: string; label: string }[];
} {
  const brandMap = new Map<string, string>();
  const ownerMap = new Map<string, string>();

  for (const vehicle of vehicles) {
    const brand = vehicle.vehicleBrand.trim();
    if (brand && !brandMap.has(brand.toLowerCase())) {
      brandMap.set(brand.toLowerCase(), brand);
    }

    const ownerKey = getVehicleOwnerKey(vehicle);
    if (!ownerMap.has(ownerKey)) {
      const label = vehicle.ownerName && vehicle.ownerEmail
        ? `${vehicle.ownerName} (${vehicle.ownerEmail})`
        : vehicle.ownerName || vehicle.ownerEmail || `Owner #${vehicle.vehicleId}`;
      ownerMap.set(ownerKey, label);
    }
  }

  return {
    brands: [...brandMap.values()].sort((a, b) => a.localeCompare(b)),
    owners: [...ownerMap.entries()]
      .map(([key, label]) => ({ key, label }))
      .sort((a, b) => a.label.localeCompare(b.label)),
  };
}

const toTimestamp = (value: string): number | undefined => {
  const time = parseTimestamp(value).getTime();
  return Number.isFinite(time) ? time : undefined;
};

const textOrder = new Intl.Collator(undefined, { numeric: true, sensitivity: 'base' });
const sortValue: Record<VehicleTableSort['column'], (vehicle: AdminVehicleDto) => string | number | undefined> = {
  id: vehicle => vehicle.vehicleId,
  plate: vehicle => vehicle.numberPlate || undefined,
  brand: vehicle => vehicle.vehicleBrand || undefined,
  model: vehicle => vehicle.vehicleModel || undefined,
  color: vehicle => vehicle.vehicleColor || undefined,
  owner: vehicle => vehicle.ownerName || vehicle.ownerEmail || undefined,
  created: vehicle => toTimestamp(vehicle.createdAt),
  updated: vehicle => toTimestamp(vehicle.updatedAt || vehicle.createdAt),
};

export function filterAndSortVehicles(
  vehicles: AdminVehicleDto[],
  { searchQuery, brandFilter, ownerFilter, sort, currentUserEmail }: VehicleFilterState,
): AdminVehicleDto[] {
  const normalizedSearch = searchQuery.trim().toLowerCase();
  const normalizedBrand = brandFilter.trim().toLowerCase();

  const filtered = vehicles.filter((vehicle) => {
    if (normalizedBrand && vehicle.vehicleBrand.trim().toLowerCase() !== normalizedBrand) {
      return false;
    }

    if (ownerFilter === '__mine__') {
      if (!isVehicleOwnedByUser(vehicle, currentUserEmail)) return false;
    } else if (ownerFilter && getVehicleOwnerKey(vehicle) !== ownerFilter) {
      return false;
    }

    if (!normalizedSearch) return true;

    return [
      vehicle.numberPlate,
      vehicle.vehicleBrand,
      vehicle.vehicleModel,
      vehicle.vehicleColor,
      vehicle.ownerName,
      vehicle.ownerEmail,
      `#${vehicle.vehicleId}`,
      vehicle.vehicleId,
    ].some((value) => String(value ?? '').toLowerCase().includes(normalizedSearch));
  });

  const direction = sort.direction === 'asc' ? 1 : -1;
  return filtered.map(vehicle => ({ vehicle, value: sortValue[sort.column](vehicle) })).sort((left, right) => {
    const byId = left.vehicle.vehicleId - right.vehicle.vehicleId;
    if (left.value === undefined || right.value === undefined) {
      return Number(left.value === undefined) - Number(right.value === undefined) || byId;
    }
    const order = typeof left.value === 'number' && typeof right.value === 'number'
      ? left.value - right.value
      : textOrder.compare(String(left.value), String(right.value));
    return direction * (order || byId);
  }).map(({ vehicle }) => vehicle);
}

export function validateVehicleForm(values: VehicleFormValues): string | null {
  const plateError = validateVehiclePlate(values.numberPlate);
  if (plateError) return plateError;

  const brand = values.vehicleBrand.trim();
  const model = values.vehicleModel.trim();
  const color = values.vehicleColor.trim();

  if (!brand) return 'Vehicle brand is required.';
  if (brand.length > 50) return 'Vehicle brand must be 50 characters or fewer.';
  if (!model) return 'Vehicle model is required.';
  if (model.length > 50) return 'Vehicle model must be 50 characters or fewer.';
  if (!color) return 'Vehicle color is required.';
  if (color.length > 30) return 'Vehicle color must be 30 characters or fewer.';
  return null;
}
