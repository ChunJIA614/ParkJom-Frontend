import { apiRequest, authorizationHeaders, readApiError } from '@/services/apiClient';
import { normalizeVehiclePlate, validateVehiclePlate } from '@/features/commuter/lib/plateValidation';
import type { AdminVehicleDto } from '../types';

export interface AdminVehiclePayload {
  numberPlate: string;
  vehicleBrand: string;
  vehicleModel: string;
  vehicleColor: string;
}

export interface AdminUpdateVehicleRequest extends AdminVehiclePayload {
  vehicleId: number;
}

interface VehicleWireData {
  vehicleId?: number;
  VehicleId?: number;
  numberPlate?: string | null;
  NumberPlate?: string | null;
  plateNumber?: string | null;
  PlateNumber?: string | null;
  licensePlate?: string | null;
  LicensePlate?: string | null;
  vehicleBrand?: string | null;
  VehicleBrand?: string | null;
  vehicleModel?: string | null;
  VehicleModel?: string | null;
  vehicleColor?: string | null;
  VehicleColor?: string | null;
  createdAt?: string | null;
  CreatedAt?: string | null;
  updatedAt?: string | null;
  UpdatedAt?: string | null;
  ownerEmail?: string | null;
  OwnerEmail?: string | null;
  ownerName?: string | null;
  OwnerName?: string | null;
}

interface VehicleWireEnvelope<TData> {
  code?: number;
  Code?: number;
  success?: boolean;
  Success?: boolean;
  message?: string;
  Message?: string;
  data?: TData;
  Data?: TData;
}

export interface AdminVehicleListResponse {
  code: number;
  success: boolean;
  message: string;
  data: AdminVehicleDto[];
}

export interface AdminVehicleMutationResponse {
  code: number;
  success: boolean;
  message: string;
  data: AdminVehicleDto | null;
}

export interface AdminDeleteVehicleResponse {
  code: number;
  success: boolean;
  message: string;
}

const normalizeVehicle = (value: VehicleWireData | null | undefined): AdminVehicleDto | null => {
  if (!value || typeof value !== 'object') return null;

  const vehicleId = value.vehicleId ?? value.VehicleId;
  if (typeof vehicleId !== 'number' || !Number.isFinite(vehicleId) || vehicleId <= 0) return null;

  const rawPlate =
    value.numberPlate
    ?? value.NumberPlate
    ?? value.plateNumber
    ?? value.PlateNumber
    ?? value.licensePlate
    ?? value.LicensePlate
    ?? '';
  const numberPlate = String(rawPlate).trim().toUpperCase();
  if (!numberPlate) return null;

  const ownerEmail = (value.ownerEmail ?? value.OwnerEmail ?? '').trim() || null;
  const ownerName = (value.ownerName ?? value.OwnerName ?? '').trim() || null;

  return {
    vehicleId,
    numberPlate,
    vehicleBrand: String(value.vehicleBrand ?? value.VehicleBrand ?? '').trim(),
    vehicleModel: String(value.vehicleModel ?? value.VehicleModel ?? '').trim(),
    vehicleColor: String(value.vehicleColor ?? value.VehicleColor ?? '').trim(),
    createdAt: String(value.createdAt ?? value.CreatedAt ?? ''),
    updatedAt: String(value.updatedAt ?? value.UpdatedAt ?? ''),
    ownerEmail,
    ownerName,
  };
};

const sanitizeVehiclePayload = (vehicle: AdminVehiclePayload): AdminVehiclePayload => {
  const plateError = validateVehiclePlate(vehicle.numberPlate);
  if (plateError) {
    throw new Error(plateError);
  }

  const sanitized: AdminVehiclePayload = {
    numberPlate: normalizeVehiclePlate(vehicle.numberPlate),
    vehicleBrand: vehicle.vehicleBrand.trim(),
    vehicleModel: vehicle.vehicleModel.trim(),
    vehicleColor: vehicle.vehicleColor.trim(),
  };

  if (
    !sanitized.numberPlate
    || !sanitized.vehicleBrand
    || !sanitized.vehicleModel
    || !sanitized.vehicleColor
  ) {
    throw new Error('Number plate, brand, model, and color are required.');
  }

  return sanitized;
};

export async function getAllVehicles(
  token: string,
  signal?: AbortSignal,
): Promise<AdminVehicleListResponse> {
  const response = await apiRequest('/vehicle/all', {
    method: 'GET',
    headers: authorizationHeaders(token),
    signal,
  });

  if (!response.ok) {
    throw new Error(await readApiError(response, 'Unable to load all vehicles.'));
  }

  const payload = await response.json().catch(() => null) as VehicleWireEnvelope<VehicleWireData[]> | null;
  const wireData = payload?.data ?? payload?.Data;
  if (!payload || !Array.isArray(wireData)) {
    throw new Error('The vehicle service returned an unreadable vehicle list.');
  }

  const data = wireData.map(normalizeVehicle);
  if (data.some((vehicle) => vehicle === null)) {
    throw new Error('The vehicle service returned incomplete vehicle details.');
  }

  const result: AdminVehicleListResponse = {
    code: payload.code ?? payload.Code ?? response.status,
    success: payload.success ?? payload.Success ?? false,
    message: payload.message ?? payload.Message ?? '',
    data: data as AdminVehicleDto[],
  };
  if (!result.success) throw new Error(result.message || 'Unable to load all vehicles.');
  return result;
}

/**
 * Registers a vehicle via POST /api/vehicle/add.
 * Note: the current backend contract binds new vehicles to the signed-in user
 * and does not accept an owner/userId field.
 */
export async function createAdminVehicle(
  token: string,
  vehicle: AdminVehiclePayload,
): Promise<AdminVehicleMutationResponse> {
  const body = sanitizeVehiclePayload(vehicle);
  const response = await apiRequest('/vehicle/add', {
    method: 'POST',
    headers: authorizationHeaders(token, 'application/json'),
    body: JSON.stringify(body),
  }, { preserveSessionOnForbidden: true });

  if (!response.ok) {
    throw new Error(await readApiError(response, 'Unable to register this vehicle.'));
  }

  const payload = await response.json().catch(() => null) as VehicleWireEnvelope<VehicleWireData | null> | null;
  if (!payload) {
    throw new Error('The vehicle service returned an unreadable response.');
  }

  const result: AdminVehicleMutationResponse = {
    code: payload.code ?? payload.Code ?? response.status,
    success: payload.success ?? payload.Success ?? false,
    message: payload.message ?? payload.Message ?? 'Vehicle registered successfully.',
    data: normalizeVehicle(payload.data ?? payload.Data),
  };

  if (!result.success) {
    throw new Error(result.message || 'Unable to register this vehicle.');
  }

  return result;
}

/**
 * Updates a vehicle via PUT /api/vehicle/modify.
 * Uses preserveSessionOnForbidden because the current backend restricts edits
 * to vehicles owned by the authenticated account and may reject cross-owner
 * admin updates with HTTP 403.
 */
export async function updateAdminVehicle(
  token: string,
  vehicle: AdminUpdateVehicleRequest,
): Promise<AdminVehicleMutationResponse> {
  if (!Number.isFinite(vehicle.vehicleId) || vehicle.vehicleId <= 0) {
    throw new Error('This vehicle is missing a valid vehicle ID.');
  }

  const body: AdminUpdateVehicleRequest = {
    vehicleId: vehicle.vehicleId,
    ...sanitizeVehiclePayload(vehicle),
  };

  const response = await apiRequest('/vehicle/modify', {
    method: 'PUT',
    headers: authorizationHeaders(token, 'application/json'),
    body: JSON.stringify(body),
  }, { preserveSessionOnForbidden: true });

  if (!response.ok) {
    const message = await readApiError(response, 'Unable to update this vehicle.');
    if (response.status === 403 && /HTTP 403\b/i.test(message)) {
      throw new Error(
        'The backend rejected editing another user’s vehicle (PUT /api/vehicle/modify currently requires vehicle ownership).',
      );
    }
    throw new Error(message);
  }

  const payload = await response.json().catch(() => null) as VehicleWireEnvelope<VehicleWireData | null> | null;
  const result: AdminVehicleMutationResponse = {
    code: payload?.code ?? payload?.Code ?? response.status,
    success: payload?.success ?? payload?.Success ?? true,
    message: payload?.message ?? payload?.Message ?? 'Vehicle updated successfully.',
    data: normalizeVehicle(payload?.data ?? payload?.Data),
  };

  if (!result.success) {
    throw new Error(result.message || 'Unable to update this vehicle.');
  }

  return result;
}

/**
 * Deletes any vehicle as an administrator via DELETE /api/vehicle/delete/{id}.
 */
export async function deleteAdminVehicle(
  token: string,
  vehicleId: number,
): Promise<AdminDeleteVehicleResponse> {
  if (!Number.isFinite(vehicleId) || vehicleId <= 0) {
    throw new Error('This vehicle is missing a valid vehicle ID.');
  }

  const response = await apiRequest(`/vehicle/delete/${encodeURIComponent(String(vehicleId))}`, {
    method: 'DELETE',
    headers: authorizationHeaders(token),
  }, { preserveSessionOnForbidden: true });

  if (!response.ok) {
    throw new Error(await readApiError(response, 'Unable to delete this vehicle.'));
  }

  const payload = await response.json().catch(() => null) as VehicleWireEnvelope<unknown> | null;
  if (!payload) {
    throw new Error('The vehicle service returned an unreadable delete response.');
  }

  const result: AdminDeleteVehicleResponse = {
    code: payload.code ?? payload.Code ?? response.status,
    success: payload.success ?? payload.Success ?? false,
    message: payload.message ?? payload.Message ?? 'Vehicle deleted successfully.',
  };

  if (!result.success) {
    throw new Error(result.message || 'Unable to delete this vehicle.');
  }

  return result;
}
