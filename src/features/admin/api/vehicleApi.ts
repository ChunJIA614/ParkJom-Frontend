import { apiRequest, authorizationHeaders, readApiError } from '@/services/apiClient';
import type { AdminVehicleDto } from '../types';

interface VehicleWireData {
  vehicleId?: number;
  VehicleId?: number;
  numberPlate?: string;
  NumberPlate?: string;
  vehicleBrand?: string;
  VehicleBrand?: string;
  vehicleModel?: string;
  VehicleModel?: string;
  vehicleColor?: string;
  VehicleColor?: string;
  createdAt?: string;
  CreatedAt?: string;
  updatedAt?: string;
  UpdatedAt?: string;
  ownerEmail?: string | null;
  OwnerEmail?: string | null;
  ownerName?: string | null;
  OwnerName?: string | null;
}

interface VehicleListWireResponse {
  code?: number;
  Code?: number;
  success?: boolean;
  Success?: boolean;
  message?: string;
  Message?: string;
  data?: VehicleWireData[];
  Data?: VehicleWireData[];
}

export interface AdminVehicleListResponse {
  code: number;
  success: boolean;
  message: string;
  data: AdminVehicleDto[];
}

const normalizeVehicle = (value: VehicleWireData): AdminVehicleDto | null => {
  const vehicleId = value.vehicleId ?? value.VehicleId;
  if (typeof vehicleId !== 'number' || !Number.isFinite(vehicleId) || vehicleId <= 0) return null;

  const numberPlate = value.numberPlate ?? value.NumberPlate ?? '';
  const vehicleBrand = value.vehicleBrand ?? value.VehicleBrand ?? '';
  const vehicleModel = value.vehicleModel ?? value.VehicleModel ?? '';
  const vehicleColor = value.vehicleColor ?? value.VehicleColor ?? '';
  if (!numberPlate.trim() || !vehicleBrand.trim() || !vehicleModel.trim() || !vehicleColor.trim()) return null;

  return {
    vehicleId,
    numberPlate: numberPlate.trim().toUpperCase(),
    vehicleBrand: vehicleBrand.trim(),
    vehicleModel: vehicleModel.trim(),
    vehicleColor: vehicleColor.trim(),
    createdAt: value.createdAt ?? value.CreatedAt ?? '',
    updatedAt: value.updatedAt ?? value.UpdatedAt ?? '',
    ownerEmail: value.ownerEmail ?? value.OwnerEmail ?? null,
    ownerName: value.ownerName ?? value.OwnerName ?? null,
  };
};

export async function getAllVehicles(token: string): Promise<AdminVehicleListResponse> {
  const response = await apiRequest('/vehicle/all', {
    method: 'GET',
    headers: authorizationHeaders(token),
  });

  if (!response.ok) {
    throw new Error(await readApiError(response, 'Unable to load all vehicles.'));
  }

  const payload = await response.json().catch(() => null) as VehicleListWireResponse | null;
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
