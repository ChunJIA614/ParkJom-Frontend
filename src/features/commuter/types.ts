export interface ParkingSpot {
  id: string;
  parkingSpotId: number;
  parkingLabel: string;
  propertyId: number;
  propertyName: string;
  address: string;
  latitude: number;
  longitude: number;
  stationName: string;
  distanceToStation: number;
  timeToStationInMinutes: number;
  availabilityStatus: string;
  monthlyRate: number;
  dailyRate: number | null;
  primaryImageUrl: string | null;
  station: string;
  name: string;
  pricePerHour: number;
  distance: number;
  lat: number;
  lng: number;
  available: boolean;
  type: 'Condo Bay' | 'Landed Driveway';
  owner: string;
}

export interface ParkingSearchResponse {
  code: number;
  success: boolean;
  message: string;
  data: Array<{
    parkingSpotId: number;
    parkingLabel: string;
    propertyId: number;
    propertyName: string;
    address: string;
    latitude: number;
    longitude: number;
    stationName: string;
    distanceToStation: number;
    timeToStationInMinutes: number;
    availabilityStatus: string;
    monthlyRate: number;
    dailyRate: number | null;
    primaryImageUrl: string | null;
  }>;
  totalCount: number;
  page: number;
  pageSize: number;
}

export interface WalletTopUpResponse {
  code: number;
  success: boolean;
  message: string;
  paymentId: number;
  sessionId: string;
  checkoutUrl: string;
}

export interface WalletSummary {
  code: number;
  success: boolean;
  message: string;
  walletId: number;
  balance: number;
  onHold: number;
  currency: string;
  status: string;
  updatedAt: string;
}

export type WalletTopUpState =
  | 'open'
  | 'processing'
  | 'completed'
  | 'expired'
  | 'cancelled'
  | 'failed'
  | 'unavailable';

export interface WalletTopUpStatus {
  code: number;
  success: boolean;
  message: string;
  paymentId: number;
  sessionId: string;
  amount: number;
  currency: string;
  state: WalletTopUpState;
  paymentStatus: string;
  checkoutStatus: string;
  stripePaymentStatus: string;
  isCredited: boolean;
  canContinue: boolean;
  checkoutUrl: string | null;
  expiresAt: string | null;
  walletBalance: number;
  walletUpdatedAt: string;
}

export interface Booking {
  id: string;
  bookingId?: number;
  spot: ParkingSpot;
  startTime: Date;
  endTime: Date;
  vehiclePlate: string;
  status: 'Active' | 'Completed' | 'Upcoming';
  totalPaid: number;
}

export interface Vehicle {
  vehicleId: number | null;
  plate: string;
  brand: string;
  model: string;
  color: string;
  active: boolean;
}

export interface AppNotification {
  id: string;
  title: string;
  message: string;
  time: string;
  read: boolean;
  type: 'alert' | 'wallet' | 'booking' | 'general';
}

export interface PublicParkingSpotImage {
  parkingSpotId: number;
  mediaFileId: number;
  resourceType: string;
  format: string;
  originalFileName: string;
  uploadedAt: string;
  secureUrl?: string;
}

export interface PublicParkingSpotDetail {
  parkingSpotId: number;
  propertyId: number;
  propertyName: string;
  address: string;
  ownerId: number;
  ownerName: string;
  parkingLabel: string;
  availabilityStatus: string | number;
  verificationStatus: string | number;
  monthlyRate: number;
  dailyRate: number | null;
  isPublished: boolean;
  createdAt: string;
  updatedAt: string;
  images: PublicParkingSpotImage[];
  /**
   * Bay coordinates. Optional because older backend builds omit them; when
   * absent the detail page must hide map/distance affordances instead of
   * plotting the bay at 0,0.
   */
  latitude?: number | null;
  longitude?: number | null;
  /** Nearest transit station, when the backend resolves one. */
  stationName?: string | null;
  distanceToStationMeters?: number | null;
  timeToStationInMinutes?: number | null;
}

export interface PublicParkingSpotResponse {
  code: number;
  success: boolean;
  message: string;
  data: PublicParkingSpotDetail;
}

export interface WalletTopUpHistoryItem {
  paymentId: number;
  amount: number;
  currency: string;
  status: string;
  sessionId: string | null;
  createdAt: string;
  completedAt: string | null;
}

export interface WalletTopUpHistoryResponse {
  code: number;
  success: boolean;
  message: string;
  totalCount: number;
  page: number;
  pageSize: number;
  totalPages: number;
  data: WalletTopUpHistoryItem[];
}

export interface WalletTransactionItem {
  transactionId: number;
  type: string;
  amount: number;
  status: string;
  paymentMethod: string;
  referenceNumber: string;
  bookingId: number | null;
  createdAt: string;
}

export interface WalletHistoryResponse {
  code: number;
  success: boolean;
  message: string;
  month: string | null;
  type: string | null;
  status: string | null;
  totalCount: number;
  page: number;
  pageSize: number;
  totalPages: number;
  data: WalletTransactionItem[];
}

export interface CancelBookingRequest {
  bookingId: number;
  cancellationReason: string;
}

export interface CancelBookingResponse {
  code: number;
  success: boolean;
  message: string;
  data?: unknown;
}
