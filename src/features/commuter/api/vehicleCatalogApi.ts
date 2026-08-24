import { apiRequest, readApiError } from '@/services/apiClient';
import {
  VEHICLE_CATALOG_FALLBACK,
  type VehicleCatalogEntry,
} from '../data/vehicleCatalog';

export type { VehicleCatalogEntry } from '../data/vehicleCatalog';

export interface VehicleCatalogResponse {
  data: VehicleCatalogEntry[];
  updatedAt?: string;
  source?: string;
}

type VehicleCatalogWireEntry = {
  brand?: unknown;
  Brand?: unknown;
  name?: unknown;
  Name?: unknown;
  models?: unknown;
  Models?: unknown;
};

type VehicleCatalogWireResponse = {
  data?: unknown;
  Data?: unknown;
  brands?: unknown;
  Brands?: unknown;
  updatedAt?: unknown;
  UpdatedAt?: unknown;
  source?: unknown;
  Source?: unknown;
};

const normalizeCatalog = (value: unknown): VehicleCatalogEntry[] => {
  if (!Array.isArray(value)) return [];

  const entries = value
    .map((rawEntry) => {
      if (!rawEntry || typeof rawEntry !== 'object') return null;
      const entry = rawEntry as VehicleCatalogWireEntry;
      const brandValue = entry.brand ?? entry.Brand ?? entry.name ?? entry.Name;
      const modelsValue = entry.models ?? entry.Models;
      if (typeof brandValue !== 'string' || !Array.isArray(modelsValue)) return null;

      const brand = brandValue.trim();
      const models = modelsValue
        .filter((model): model is string => typeof model === 'string')
        .map((model) => model.trim())
        .filter(Boolean);
      if (!brand || models.length === 0) return null;

      return { brand, models: Array.from(new Set(models)) };
    })
    .filter((entry): entry is VehicleCatalogEntry => Boolean(entry));

  const seenBrands = new Set<string>();
  return entries.filter((entry) => {
    const key = entry.brand.toLocaleLowerCase();
    if (seenBrands.has(key)) return false;
    seenBrands.add(key);
    return true;
  });
};

/**
 * Loads the server-owned catalog. A local fallback keeps vehicle management
 * usable while the catalog endpoint is unavailable or being introduced.
 */
export async function getVehicleCatalog(signal?: AbortSignal): Promise<VehicleCatalogResponse> {
  try {
    const response = await apiRequest('/vehicle/catalog', {
      method: 'GET',
      headers: { Accept: 'application/json' },
      signal,
    });

    if (!response.ok) {
      throw new Error(await readApiError(response, 'Unable to load the vehicle catalog.'));
    }

    const payload = await response.json().catch(() => null) as VehicleCatalogWireResponse | null;
    const data = normalizeCatalog(payload?.data ?? payload?.Data ?? payload?.brands ?? payload?.Brands);
    if (data.length === 0) throw new Error('The vehicle catalog was empty.');

    return {
      data,
      updatedAt: typeof (payload?.updatedAt ?? payload?.UpdatedAt) === 'string'
        ? (payload?.updatedAt ?? payload?.UpdatedAt) as string
        : undefined,
      source: typeof (payload?.source ?? payload?.Source) === 'string'
        ? (payload?.source ?? payload?.Source) as string
        : undefined,
    };
  } catch (error) {
    if (signal?.aborted) throw error;
    return {
      data: VEHICLE_CATALOG_FALLBACK,
      source: 'local-fallback',
    };
  }
}
