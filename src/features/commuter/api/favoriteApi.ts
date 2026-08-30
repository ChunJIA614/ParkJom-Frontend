import { apiRequest, authorizationHeaders, readApiError } from '@/services/apiClient';
import type { ParkingSpot } from '../types';

export interface FavoriteParkingData {
  parkingSpotId: number;
  isFavorite: boolean;
}

export interface UpdateFavoriteParkingResponse {
  code: number;
  success: boolean;
  message: string;
  data: FavoriteParkingData;
}

export interface FavoriteParkingSpotData {
  favoriteId: number;
  parkingSpotId: number;
  parkingLabel: string;
  propertyId: number;
  propertyName: string;
  address: string;
  latitude: number | null;
  longitude: number | null;
  stationName: string;
  distanceToStation: number;
  timeToStationInMinutes: number;
  availabilityStatus: string;
  monthlyRate: number;
  dailyRate: number | null;
  primaryImageUrl: string | null;
  favoritedAt: string;
}

export interface GetFavoriteParkingResponse {
  code: number;
  success: boolean;
  message: string;
  totalCount: number;
  data: FavoriteParkingSpotData[];
}

type FavoriteParkingWireData = Partial<FavoriteParkingData> & {
  ParkingSpotId?: number;
  IsFavorite?: boolean;
};

type UpdateFavoriteParkingWireResponse = {
  code?: number;
  Code?: number;
  success?: boolean;
  Success?: boolean;
  message?: string;
  Message?: string;
  data?: FavoriteParkingWireData;
  Data?: FavoriteParkingWireData;
};

type FavoriteParkingSpotWireData = Partial<FavoriteParkingSpotData> & {
  FavoriteId?: number;
  ParkingSpotId?: number;
  ParkingLabel?: string;
  PropertyId?: number;
  PropertyName?: string;
  Address?: string;
  Latitude?: number | null;
  Longitude?: number | null;
  StationName?: string;
  DistanceToStation?: number;
  TimeToStationInMinutes?: number;
  AvailabilityStatus?: string;
  MonthlyRate?: number;
  DailyRate?: number | null;
  PrimaryImageUrl?: string | null;
  FavoritedAt?: string;
};

type GetFavoriteParkingWireResponse = {
  code?: number;
  Code?: number;
  success?: boolean;
  Success?: boolean;
  message?: string;
  Message?: string;
  totalCount?: number;
  TotalCount?: number;
  data?: FavoriteParkingSpotWireData[];
  Data?: FavoriteParkingSpotWireData[];
};

function normalizeFavoriteParkingSpot(
  spot: FavoriteParkingSpotWireData,
): FavoriteParkingSpotData | null {
  const favoriteId = spot.favoriteId ?? spot.FavoriteId;
  const parkingSpotId = spot.parkingSpotId ?? spot.ParkingSpotId;
  const propertyId = spot.propertyId ?? spot.PropertyId;
  if (
    typeof favoriteId !== 'number'
    || typeof parkingSpotId !== 'number'
    || typeof propertyId !== 'number'
  ) return null;

  return {
    favoriteId,
    parkingSpotId,
    parkingLabel: spot.parkingLabel ?? spot.ParkingLabel ?? '',
    propertyId,
    propertyName: spot.propertyName ?? spot.PropertyName ?? '',
    address: spot.address ?? spot.Address ?? '',
    latitude: spot.latitude ?? spot.Latitude ?? null,
    longitude: spot.longitude ?? spot.Longitude ?? null,
    stationName: spot.stationName ?? spot.StationName ?? '',
    distanceToStation: spot.distanceToStation ?? spot.DistanceToStation ?? 0,
    timeToStationInMinutes: spot.timeToStationInMinutes ?? spot.TimeToStationInMinutes ?? 0,
    availabilityStatus: spot.availabilityStatus ?? spot.AvailabilityStatus ?? '',
    monthlyRate: spot.monthlyRate ?? spot.MonthlyRate ?? 0,
    dailyRate: spot.dailyRate ?? spot.DailyRate ?? null,
    primaryImageUrl: spot.primaryImageUrl ?? spot.PrimaryImageUrl ?? null,
    favoritedAt: spot.favoritedAt ?? spot.FavoritedAt ?? '',
  };
}

export function favoriteParkingSpotToParkingSpot(
  favorite: FavoriteParkingSpotData,
  cachedSpot?: ParkingSpot,
): ParkingSpot {
  const latitude = favorite.latitude ?? cachedSpot?.latitude ?? 0;
  const longitude = favorite.longitude ?? cachedSpot?.longitude ?? 0;

  return {
    id: String(favorite.parkingSpotId),
    parkingSpotId: favorite.parkingSpotId,
    parkingLabel: favorite.parkingLabel,
    propertyId: favorite.propertyId,
    propertyName: favorite.propertyName,
    address: favorite.address,
    latitude,
    longitude,
    stationName: favorite.stationName,
    distanceToStation: favorite.distanceToStation,
    timeToStationInMinutes: favorite.timeToStationInMinutes,
    availabilityStatus: favorite.availabilityStatus,
    monthlyRate: favorite.monthlyRate,
    dailyRate: favorite.dailyRate,
    primaryImageUrl: favorite.primaryImageUrl,
    station: favorite.stationName,
    name: favorite.propertyName,
    pricePerHour: cachedSpot?.pricePerHour ?? 0,
    distance: Math.round(favorite.distanceToStation * 1000),
    lat: latitude,
    lng: longitude,
    available: favorite.availabilityStatus.toLowerCase() === 'available',
    type: cachedSpot?.type ?? 'Condo Bay',
    owner: cachedSpot?.owner ?? `Property #${favorite.propertyId}`,
  };
}

export async function getFavoriteParking(
  token: string,
  signal?: AbortSignal,
): Promise<GetFavoriteParkingResponse> {
  const response = await apiRequest('/favorites', {
    method: 'GET',
    headers: authorizationHeaders(token),
    signal,
  });

  if (!response.ok) {
    throw new Error(await readApiError(response, 'Unable to load your favorite parking spots.'));
  }

  const payload = await response.json().catch(() => null) as GetFavoriteParkingWireResponse | null;
  const wireData = payload?.data ?? payload?.Data;
  if (!payload || !Array.isArray(wireData)) {
    throw new Error('The favorite parking service returned an unreadable list.');
  }

  const data = wireData.map(normalizeFavoriteParkingSpot).filter((spot): spot is FavoriteParkingSpotData => Boolean(spot));
  if (data.length !== wireData.length) {
    throw new Error('The favorite parking service returned incomplete parking details.');
  }

  const result: GetFavoriteParkingResponse = {
    code: payload.code ?? payload.Code ?? response.status,
    success: payload.success ?? payload.Success ?? false,
    message: payload.message ?? payload.Message ?? '',
    totalCount: payload.totalCount ?? payload.TotalCount ?? data.length,
    data,
  };

  if (!result.success) {
    throw new Error(result.message || 'Unable to load your favorite parking spots.');
  }

  return result;
}

export async function updateFavoriteParking(
  token: string,
  parkingSpotId: number,
  signal?: AbortSignal,
): Promise<UpdateFavoriteParkingResponse> {
  const response = await apiRequest(
    `/favorites/update/${encodeURIComponent(String(parkingSpotId))}`,
    {
      method: 'POST',
      headers: authorizationHeaders(token),
      signal,
    },
  );

  if (!response.ok) {
    throw new Error(await readApiError(response, 'Unable to update this favorite parking spot.'));
  }

  const payload = await response.json().catch(() => null) as UpdateFavoriteParkingWireResponse | null;
  const wireData = payload?.data ?? payload?.Data;
  const responseParkingSpotId = wireData?.parkingSpotId ?? wireData?.ParkingSpotId;
  const isFavorite = wireData?.isFavorite ?? wireData?.IsFavorite;

  if (!payload || !wireData) {
    throw new Error('The favorite parking service returned an unreadable response.');
  }

  const result: UpdateFavoriteParkingResponse = {
    code: payload.code ?? payload.Code ?? response.status,
    success: payload.success ?? payload.Success ?? false,
    message: payload.message ?? payload.Message ?? '',
    data: {
      parkingSpotId: responseParkingSpotId ?? 0,
      isFavorite: isFavorite ?? false,
    },
  };

  if (!result.success) {
    throw new Error(result.message || 'Unable to update this favorite parking spot.');
  }
  if (
    typeof responseParkingSpotId !== 'number'
    || responseParkingSpotId !== parkingSpotId
    || typeof isFavorite !== 'boolean'
  ) {
    throw new Error('The favorite parking response did not match the selected parking spot.');
  }

  return result;
}
