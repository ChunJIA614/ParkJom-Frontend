export interface IoTBollard {
  id: string;
  bayNumber: string;
  location: string;
  status: 'online' | 'offline' | 'maintenance';
  batteryLevel: number;
  barrierState: 'raised' | 'lowered' | 'transitioning';
  rssi: number;
  lastHeartbeat: string;
  firmwareVersion: string;
}

export interface ParkingVerificationDocumentDto {
  verificationDocumentId: number;
  documentType: number;
  mediaFileId: number;
  resourceType: string;
  format: string;
  originalFileName: string;
  uploadedAt: string;
}

export interface ParkingVerificationRequestDto {
  verificationRequestId: number;
  parkingSpotId: number;
  parkingLabel: string;
  propertyId: number;
  propertyName: string;
  submittedByUserId: number;
  submittedByEmail: string;
  submittedByName: string;
  verificationStatus: string | number;
  submittedAt: string;
  documents: ParkingVerificationDocumentDto[];
}

export interface ListingRequest extends ParkingVerificationRequestDto {
  id: string;
  verificationStatusLabel: string;
  status: 'pending' | 'approved' | 'rejected' | 'unknown';
}

export interface ParkingVerificationRequestsResponse {
  code: number;
  success: boolean;
  message: string;
  data: ParkingVerificationRequestDto[];
  page?: number;
  pageSize?: number;
  totalCount?: number;
  totalPages?: number;
  hasNextPage?: boolean;
  pagination?: {
    page?: number;
    currentPage?: number;
    pageSize?: number;
    totalCount?: number;
    totalPages?: number;
    hasNextPage?: boolean;
  };
}

export interface VerificationRequestPaginationState {
  source: 'server' | 'client';
  page: number;
  pageSize: number;
  totalCount: number | null;
  totalPages: number | null;
  hasNextPage: boolean;
}

export interface AccessLogDto {
  accessLogId: number;
  bookingId: number | null;
  userId: number | null;
  ioTDeviceId: number | null;
  actions: string;
  accessedAt: string;
  createdAt: string;
  userEmail: string | null;
  userName: string;
}

export interface AccessLogResponse {
  code: number;
  success: boolean;
  message: string;
  data: AccessLogDto[];
  page: number;
  pageSize: number;
  total: number;
  totalPages: number;
  sort: string;
  type: string | null;
  search: string | null;
}

export interface AccessLogPaginationState {
  source: 'server' | 'client';
  page: number;
  pageSize: number;
  totalCount: number;
  totalPages: number;
  hasNextPage: boolean;
}

export interface AdminVehicleDto {
  vehicleId: number;
  numberPlate: string;
  vehicleBrand: string;
  vehicleModel: string;
  vehicleColor: string;
  createdAt: string;
  updatedAt: string;
  ownerEmail: string | null;
  ownerName: string | null;
}

export type VerificationRequestListStatus = 'pending' | 'completed';

export interface ParkingVerificationRequestResponse {
  code: number;
  success: boolean;
  message: string;
  data: ParkingVerificationRequestDto;
}

export type ParkingVerificationDecision = 'approved' | 'rejected';

export interface ParkingVerificationDecisionResponse {
  code: number;
  success: boolean;
  message: string;
  verificationRequestId: number;
  parkingSpotId: number;
  verificationStatus: number;
  updatedAt: string;
}

export interface ParkingVerificationDecisionResult {
  success: boolean;
  message: string;
}

export interface OwnerPayout {
  id: string;
  ownerName: string;
  email: string;
  bankName: string;
  accountNumber: string;
  amount: number;
  requestedAt: string;
  status: 'pending' | 'completed' | 'failed';
}

export interface Transaction {
  id: string;
  bookingId: string;
  userEmail: string;
  ownerName: string;
  location: string;
  amount: number;
  commission: number;
  status: 'completed' | 'refunded' | 'pending';
  timestamp: string;
}

export interface OverstayRecord {
  id: string;
  bookingId: string;
  vehicleNo: string;
  userPhone: string;
  location: string;
  bayNumber: string;
  scheduledEndTime: string;
  currentOverstayMinutes: number;
  calculatedPenalty: number;
  status: 'detected' | 'warning_sent' | 'penalized' | 'resolved';
}

export interface SupportTicket {
  id: string;
  bookingId?: string;
  userRole: 'driver' | 'owner';
  userName: string;
  email: string;
  subject: string;
  category: 'payment' | 'hardware' | 'overstay' | 'other';
  description: string;
  status: 'open' | 'pending' | 'resolved';
  createdAt: string;
  chatHistory: {
    sender: 'user' | 'admin';
    message: string;
    timestamp: string;
  }[];
}

export interface PlatformStats {
  totalRevenue: number;
  platformCommission: number;
  activeBookings: number;
  totalUsers: number;
  onlineBollardsRate: number;
  pendingListingsCount: number;
  openDisputesCount: number;
  activeOverstaysCount: number;
}
