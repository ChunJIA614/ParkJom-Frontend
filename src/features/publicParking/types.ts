export type PublicParkingOperatingType = 'Unlimited24Hours' | 'LimitedHours' | 1 | 2;

export type PublicParkingSessionStatus =
  | 'Parked'
  | 'PaymentPending'
  | 'Paid'
  | 'Exited'
  | 'Cancelled'
  | 1 | 2 | 3 | 4 | 5;

export interface PublicParkingLot {
  publicParkingLotId: number;
  ownerId: number;
  ownerName: string;
  propertyId?: number | null;
  lotName: string;
  address: string;
  latitude: number;
  longitude: number;
  totalCapacity: number;
  occupiedSpaces: number;
  availableSpaces: number;
  isFull: boolean;
  operatingType: PublicParkingOperatingType;
  openingTime?: string | null;
  closingTime?: string | null;
  isCurrentlyOpen: boolean;
  hourlyRate: number;
  dailyCapRate?: number | null;
  flatRatePerEntry?: number | null;
  overnightSurcharge?: number | null;
  initialGraceMinutes: number;
  exitGraceMinutes: number;
  isActive: boolean;
  verificationStatus?: 'Pending' | 'Approved' | 'Rejected' | 1 | 2 | 3;
  verificationDocumentUrl?: string | null;
  verificationDocumentType?: string | null;
  facilityPhotoUrl?: string | null;
  entrancePhotoUrl?: string | null;
  iotDeviceUuid?: string | null;
  isIotConnected?: boolean;
  nearestStationName?: string | null;
  distanceToStation?: number | null;
  adminReviewNotes?: string | null;
  description?: string | null;
  createdAt: string;
}

export interface PublicParkingSession {
  publicParkingSessionId: number;
  sessionCode: string;
  publicParkingLotId: number;
  lotName: string;
  lotAddress: string;
  carPlateNumber: string;
  userId?: number | null;
  entryTimeUtc: string;
  exitTimeUtc?: string | null;
  paidAtUtc?: string | null;
  durationMinutes: number;
  hourlyRate: number;
  overnightSurchargeAmount?: number;
  totalAmount: number;
  status: PublicParkingSessionStatus;
  paymentMethod?: string | null;
  graceMinutesRemaining: number;
  canExitFree: boolean;
  isPaid: boolean;
}

export interface CreatePublicParkingLotInput {
  lotName: string;
  propertyId?: number | null;
  address: string;
  latitude: number;
  longitude: number;
  totalCapacity: number;
  operatingType: number; // 1 = Unlimited, 2 = Limited
  openingTime?: string;
  closingTime?: string;
  hourlyRate: number;
  dailyCapRate?: number | null;
  flatRatePerEntry?: number | null;
  overnightSurcharge?: number | null;
  initialGraceMinutes?: number;
  exitGraceMinutes?: number;
  description?: string;
  isActive?: boolean;
  verificationDocumentUrl?: string | null;
  verificationDocumentType?: string | null;
  facilityPhotoUrl?: string | null;
  entrancePhotoUrl?: string | null;
  nearestStationName?: string | null;
  distanceToStation?: number | null;
}

export interface PublicParkingCheckoutStripeResponse {
  checkoutUrl: string;
  sessionId: string;
}

export const DEFAULT_PUBLIC_PARKING_PHOTO =
  'https://images.unsplash.com/photo-1590674899484-d5640e854abe?auto=format&fit=crop&w=1200&q=80';

export function getPublicLotPhotoUrl(url?: string | null): string {
  if (!url || typeof url !== 'string' || url.trim() === '' || url.startsWith('blob:')) {
    return DEFAULT_PUBLIC_PARKING_PHOTO;
  }
  return url;
}

