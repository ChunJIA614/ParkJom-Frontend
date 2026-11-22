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

/**
 * Live counters for the admin landing screen.
 * Every field is served by GET /api/admin/dashboard — see dashboardApi.ts.
 */
export type AdminDashboardStats = PlatformStats;
export interface PlatformStats {
  totalRevenue: number;
  platformCommission: number;
  grossBookingValue: number;
  ownerPayoutTotal: number;
  activeBookings: number;
  totalUsers: number;
  totalOwners: number;
  totalCommuters: number;
  onlineBollardsRate: number;
  totalBollards: number;
  onlineBollards: number;
  pendingListingsCount: number;
  openDisputesCount: number;
  activeOverstaysCount: number;
  openTicketsCount: number;
  pendingWithdrawalsCount?: number;
}

export interface AdminDashboardBookingCounts {
  pending: number;
  confirmed: number;
  active: number;
  completed: number;
  cancelled: number;
  expired: number;
  total: number;
}

export interface DashboardDailyPoint {
  day: string;
  date: string;
  bookings: number;
  revenue: number;
  commission: number;
}

export interface DashboardStationPoint {
  name: string;
  bookings: number;
  revenue: number;
}

export interface DashboardHourlyPoint {
  hour: string;
  bookings: number;
}

export interface DashboardUserGrowthPoint {
  month: string;
  drivers: number;
  owners: number;
}

export interface DashboardRevenueTypePoint {
  type: string;
  revenue: number;
  bookings: number;
}

/** Full payload of GET /api/admin/dashboard. */
export interface AdminDashboardData {
  stats: PlatformStats;
  bookingCounts: AdminDashboardBookingCounts;
  weekly: DashboardDailyPoint[];
  stations: DashboardStationPoint[];
  hourly: DashboardHourlyPoint[];
  userGrowth: DashboardUserGrowthPoint[];
  revenueByType: DashboardRevenueTypePoint[];
  generatedAt: string;
  timeZone: string;
}

/** GET/PUT /api/admin/system-config */
export interface SystemConfig {
  commissionRate: number;
  gracePeriodMinutes: number;
  overstayPenaltyMultiplier?: number;
  overstayMaxDailyPenalty?: number;
  hardwareExitLockEnabled?: boolean;
  taxRatePercent?: number;
  updatedAt: string;
  updatedByUserId: number | null;
  updatedByName: string | null;
}

export interface SettlementBatchSummary {
  settlementBatchId: number;
  batchReference: string;
  rail: string;
  scheduleWindow: string;
  status: string;
  itemCount: number;
  totalAmount: number;
  currency: string;
  bnmFormatVersion: string;
  fileChecksum: string;
  bankReference: string | null;
  createdByUserId: number | null;
  createdByName: string | null;
  createdAt: string;
  submittedAt: string | null;
  clearedAt: string | null;
  notes: string | null;
}

export interface SettlementBatchItem {
  settlementBatchItemId: number;
  transactionId: number;
  transactionReference: string;
  ownerUserId: number;
  ownerName: string;
  ownerEmail: string;
  bankName: string;
  bankCode: string;
  accountNumber: string;
  accountHolderName: string;
  amount: number;
  status: string;
  clearingReference: string | null;
  failureReason: string | null;
  processedAt: string | null;
}

export interface SettlementBatchDetail {
  batch: SettlementBatchSummary;
  items: SettlementBatchItem[];
  ibgPreview: string;
}

export interface SettlementSummary {
  commissionRate: number;
  taxRatePercent: number;
  platformWalletBalance: number;
  platformTotalRevenue: number;
  platformTotalRefunded: number;
  totalOwnerAvailable: number;
  totalEscrowOnHold: number;
  unreleasedCompletedBookingsCount: number;
  unreleasedCompletedBookingsAmount: number;
  pendingWithdrawalsCount: number;
  pendingWithdrawalsAmount: number;
  clearedWithdrawalsCount: number;
  clearedWithdrawalsAmount: number;
  eligibleAutoWithdrawOwnersCount: number;
  eligibleAutoWithdrawAmount: number;
  totalGrossCommissions: number;
  totalCommissionTaxSst: number;
  totalOverstayPenaltiesCollected: number;
  totalStripeTopUps: number;
  ibgScheduleLabel: string;
  nextScheduledIbgCutoffUtc: string;
  latestBatch: SettlementBatchSummary | null;
  reconciliationHealth: string;
  generatedAtUtc: string;
}

export interface AdminWithdrawalItem {
  transactionId: number;
  referenceNumber: string;
  walletId: number;
  ownerUserId: number;
  ownerName: string;
  ownerEmail: string;
  amount: number;
  status: string;
  bankName: string;
  bankCode: string;
  accountNumber: string;
  accountHolderName: string;
  autoWithdraw: boolean;
  batchId: number | null;
  batchReference: string | null;
  batchItemStatus: string | null;
  clearingReference: string | null;
  failureReason: string | null;
  createdAt: string;
  updatedAt: string;
}

export interface SettlementLedgerEntry {
  transactionId: number;
  referenceNumber: string;
  type: string;
  status: string;
  paymentMethod: string;
  ledgerAccount: string;
  userId: number | null;
  userName: string | null;
  userEmail: string | null;
  bookingId: number | null;
  bookingReference: string | null;
  spotLabel: string | null;
  amount: number;
  taxRatePercent: number;
  taxAmount: number;
  netAmount: number;
  createdAt: string;
}

export interface EscrowSyncResult {
  releasedBookingsCount: number;
  releasedAmount: number;
  skippedOrAlreadySettledCount: number;
  flaggedMismatchCount: number;
  syncedAtUtc: string;
}

export interface ReconciliationSection {
  key: string;
  title: string;
  expectedAmount: number;
  recordedAmount: number;
  varianceAmount: number;
  status: string;
  notes: string;
}

export interface ReconciliationReceiptRow {
  source: string;
  reference: string;
  userEmail: string;
  stripeOrBookingAmount: number;
  ledgerAmount: number;
  variance: number;
  matchStatus: string;
  detail: string;
  timestampUtc: string;
}

export interface ReconciliationReport {
  overallStatus: string;
  fromUtc: string | null;
  toUtc: string | null;
  stripeCompletedPaymentsCount: number;
  stripeCompletedPaymentsTotal: number;
  stripeTopUpTransactionsCount: number;
  stripeTopUpTransactionsTotal: number;
  publicParkingStripeCount: number;
  publicParkingStripeTotal: number;
  bookingSplitExceptionsCount: number;
  platformWalletRecordedBalance: number;
  platformWalletExpectedBalance: number;
  totalOwnerHeldEscrow: number;
  totalOwnerAvailable: number;
  totalClearedWithdrawals: number;
  totalPendingWithdrawals: number;
  sections: ReconciliationSection[];
  exceptionsAndRecentReceipts: ReconciliationReceiptRow[];
  generatedAtUtc: string;
}

export interface OverstayWorkerStatus {
  enabled: boolean;
  isRunning: boolean;
  intervalSeconds: number;
  startedAtUtc: string | null;
  lastScanStartedAtUtc: string | null;
  lastScanCompletedAtUtc: string | null;
  lastScanDetectedCount: number;
  lastScanWarningsSent: number;
  lastScanPenaltiesDebited: number;
  totalScansCompleted: number;
  lastError: string | null;
}

export interface OverstaySummary {
  gracePeriodMinutes: number;
  penaltyMultiplier: number;
  maxDailyPenalty: number;
  hardwareExitLockEnabled: boolean;
  activeOverstaysCount: number;
  warningsSentCount: number;
  paymentDueCount: number;
  disputedCount: number;
  hardwareLockedCount: number;
  waivedOrResolvedCount: number;
  totalCalculatedPenalties: number;
  totalCollectedPenalties: number;
  totalOutstandingPenalties: number;
  totalWaivedPenalties: number;
  workerStatus: OverstayWorkerStatus;
  generatedAtUtc: string;
}

export interface OverstayCaseDto {
  overstayCaseId: number;
  caseReference: string;
  bookingId: number;
  bookingReference: string;
  renterId: number;
  renterName: string;
  renterEmail: string;
  renterPhone: string | null;
  vehiclePlate: string;
  parkingSpotId: number;
  spotLabel: string;
  propertyName: string;
  ioTDeviceId: number | null;
  esp32Serial: string | null;
  deviceStatus: string | null;
  windowDate: string;
  scheduledEndAtUtc: string;
  graceEndsAtUtc: string;
  detectedAtUtc: string;
  departedAtUtc: string | null;
  overstayMinutes: number;
  billableHours: number;
  baseHourlyRate: number;
  penaltyMultiplier: number;
  hourlyPenaltyTariff: number;
  calculatedPenaltyAmount: number;
  debitedAmount: number;
  waivedAmount: number;
  remainingDueAmount: number;
  status: string;
  paymentStatus: string;
  pushWarningSentAtUtc: string | null;
  smsWarningSentAtUtc: string | null;
  smsProviderRef: string | null;
  smsDeliveryStatus: string | null;
  ledgerDebitedAtUtc: string | null;
  penaltyTransactionId: number | null;
  hardwareLockActive: boolean;
  hardwareLockEngagedAtUtc: string | null;
  hardwareLockReleasedAtUtc: string | null;
  hardwareLockReleasedByUserId: number | null;
  disputeInvestigationId: number | null;
  resolutionNotes: string | null;
  resolvedByUserId: number | null;
  resolvedAtUtc: string | null;
  updatedAt: string;
}

export interface OverstayScanResult {
  activeBookingsScanned: number;
  casesDetectedOrUpdated: number;
  warningsDispatched: number;
  penaltiesDebited: number;
  casesAutoResolved: number;
  scannedAtUtc: string;
}

export interface OverstayReleaseResult {
  case: OverstayCaseDto;
  bollardUnlockAttempted: boolean;
  bollardUnlockSucceeded: boolean;
  bollardOutcome: string | null;
}
