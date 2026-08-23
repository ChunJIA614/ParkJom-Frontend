import { apiRequest, authorizationHeaders, readApiError } from '@/services/apiClient';

export interface AddVehicleRequest {
  numberPlate: string;
  vehicleBrand: string;
  vehicleModel: string;
  vehicleColor: string;
}

export interface VehicleApiData extends AddVehicleRequest {
  vehicleId: number;
  createdAt: string;
  updatedAt: string;
  ownerEmail?: string | null;
  ownerName?: string | null;
}

export interface AddVehicleResponse {
  code: number;
  success: boolean;
  message: string;
  data: VehicleApiData | null;
}

export interface ModifyVehicleRequest extends AddVehicleRequest {
  vehicleId: number;
}

export interface ModifyVehicleResponse {
  code: number;
  success: boolean;
  message: string;
  data: VehicleApiData;
}

export interface DeleteVehicleResponse {
  code: number;
  success: boolean;
  message: string;
}

export interface GetMyVehiclesResponse {
  code: number;
  success: boolean;
  message: string;
  data: VehicleApiData[];
}

type VehicleWireData = Partial<VehicleApiData> & {
  VehicleId?: number;
  NumberPlate?: string;
  VehicleBrand?: string;
  VehicleModel?: string;
  VehicleColor?: string;
  CreatedAt?: string;
  UpdatedAt?: string;
  OwnerEmail?: string | null;
  OwnerName?: string | null;
};

type VehicleWireResponse<TData> = {
  code?: number;
  Code?: number;
  success?: boolean;
  Success?: boolean;
  message?: string;
  Message?: string;
  data?: TData;
  Data?: TData;
};

type AddVehicleWireResponse = VehicleWireResponse<VehicleWireData | null>;
type MyVehiclesWireResponse = VehicleWireResponse<VehicleWireData[]>;

const normalizeVehicleData = (
  data: VehicleWireData | null | undefined,
): VehicleApiData | null => {
  if (!data) return null;

  const vehicleId = data.vehicleId ?? data.VehicleId;
  if (typeof vehicleId !== 'number' || !Number.isFinite(vehicleId)) return null;

  return {
    vehicleId,
    numberPlate: data.numberPlate ?? data.NumberPlate ?? '',
    vehicleBrand: data.vehicleBrand ?? data.VehicleBrand ?? '',
    vehicleModel: data.vehicleModel ?? data.VehicleModel ?? '',
    vehicleColor: data.vehicleColor ?? data.VehicleColor ?? '',
    createdAt: data.createdAt ?? data.CreatedAt ?? '',
    updatedAt: data.updatedAt ?? data.UpdatedAt ?? '',
    ownerEmail: data.ownerEmail ?? data.OwnerEmail ?? null,
    ownerName: data.ownerName ?? data.OwnerName ?? null,
  };
};

const hasCompleteVehicleData = (data: VehicleApiData | null): data is VehicleApiData => Boolean(
  data
  && data.vehicleId > 0
  && data.numberPlate.trim()
  && data.vehicleBrand.trim()
  && data.vehicleModel.trim()
  && data.vehicleColor.trim(),
);

export async function getMyVehicles(
  token: string,
  signal?: AbortSignal,
): Promise<GetMyVehiclesResponse> {
  const response = await apiRequest('/vehicle/my-vehicle', {
    method: 'GET',
    headers: authorizationHeaders(token),
    signal,
  });

  if (!response.ok) {
    throw new Error(await readApiError(response, 'Unable to load your vehicles.'));
  }

  const payload = await response.json().catch(() => null) as MyVehiclesWireResponse | null;
  const wireData = payload?.data ?? payload?.Data;
  if (!payload || !Array.isArray(wireData)) {
    throw new Error('The vehicle service returned an unreadable vehicle list.');
  }

  const result: GetMyVehiclesResponse = {
    code: payload.code ?? payload.Code ?? response.status,
    success: payload.success ?? payload.Success ?? false,
    message: payload.message ?? payload.Message ?? '',
    data: wireData.map(normalizeVehicleData).filter(hasCompleteVehicleData),
  };

  if (!result.success) {
    throw new Error(result.message || 'Unable to load your vehicles.');
  }
  if (result.data.length !== wireData.length) {
    throw new Error('The vehicle service returned incomplete vehicle details.');
  }

  return result;
}

export async function addVehicle(
  token: string,
  vehicle: AddVehicleRequest,
): Promise<AddVehicleResponse> {
  const response = await apiRequest('/vehicle/add', {
    method: 'POST',
    headers: authorizationHeaders(token, 'application/json'),
    body: JSON.stringify(vehicle),
  });

  if (!response.ok) {
    throw new Error(await readApiError(response, 'Unable to add this vehicle.'));
  }

  const payload = await response.json().catch(() => null) as AddVehicleWireResponse | null;
  if (!payload) {
    throw new Error('The vehicle service returned an unreadable success response.');
  }

  const result: AddVehicleResponse = {
    code: payload.code ?? payload.Code ?? response.status,
    success: payload.success ?? payload.Success ?? false,
    message: payload.message ?? payload.Message ?? '',
    data: normalizeVehicleData(payload.data ?? payload.Data),
  };

  if (!result.success) {
    throw new Error(result.message || 'Unable to add this vehicle.');
  }
  if (!hasCompleteVehicleData(result.data)) {
    throw new Error('The vehicle was added, but the response was missing its vehicle details.');
  }

  return result;
}

export async function modifyVehicle(
  token: string,
  vehicle: ModifyVehicleRequest,
): Promise<ModifyVehicleResponse> {
  const response = await apiRequest('/vehicle/modify', {
    method: 'PUT',
    headers: authorizationHeaders(token, 'application/json'),
    body: JSON.stringify(vehicle),
  });

  if (!response.ok) {
    throw new Error(await readApiError(response, 'Unable to update this vehicle.'));
  }

  const payload = await response.json().catch(() => null) as AddVehicleWireResponse | null;
  const data = normalizeVehicleData(payload?.data ?? payload?.Data) ?? {
    ...vehicle,
    createdAt: '',
    updatedAt: '',
  };
  const result: ModifyVehicleResponse = {
    code: payload?.code ?? payload?.Code ?? response.status,
    success: payload?.success ?? payload?.Success ?? true,
    message: payload?.message ?? payload?.Message ?? 'Vehicle updated successfully.',
    data,
  };

  if (!result.success) {
    throw new Error(result.message || 'Unable to update this vehicle.');
  }

  return result;
}

export async function deleteVehicle(
  token: string,
  vehicleId: number,
): Promise<DeleteVehicleResponse> {
  const response = await apiRequest(`/vehicle/delete/${encodeURIComponent(String(vehicleId))}`, {
    method: 'DELETE',
    headers: authorizationHeaders(token),
  });

  if (!response.ok) {
    throw new Error(await readApiError(response, 'Unable to delete this vehicle.'));
  }

  const payload = await response.json().catch(() => null) as AddVehicleWireResponse | null;
  if (!payload) {
    throw new Error('The vehicle service returned an unreadable delete response.');
  }

  const result: DeleteVehicleResponse = {
    code: payload.code ?? payload.Code ?? response.status,
    success: payload.success ?? payload.Success ?? false,
    message: payload.message ?? payload.Message ?? '',
  };
  if (!result.success) {
    throw new Error(result.message || 'Unable to delete this vehicle.');
  }

  return result;
}
