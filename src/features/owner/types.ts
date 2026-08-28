export interface ParkingBay {
  id: string;
  parkingSpotId: number;
  propertyId: number;
  ownerId: number;
  parkingLabel: string;
  availabilityStatus: string;
  verificationStatus: string | number;
  monthlyRate: number;
  dailyRate: number | null;
  isPublished: boolean;
  createdAt: string;
  updatedAt: string;
  propertyName: string;
  stationName: string;
  bayNumber: string;
  level: string;
  status: 'Active' | 'Approved' | 'Pending Verification' | 'Rejected' | 'Blocked';
  hourlyRate: number;
  verificationDocName?: string;
  verificationProgress?: number;
  verificationSubmittedAt?: string;
}

export type ParkingAvailabilityStatus = 'Inactive' | 'Available' | 'Reserved' | 'Occupied';

export interface ParkingActionResult {
  success: boolean;
  message: string;
}

export interface ParkingConfigurationPayload {
  description: string;
  dailyRate: number;
  monthlyRate: number;
}

export interface ParkingConfigurationResponse extends ParkingActionResult {
  code: number;
  parkingSpotId: number;
  isConfigurationComplete: boolean;
  missingRequirements: string[];
  updatedAt: string;
}

export interface ParkingSpotImage {
  parkingSpotImageId: number;
  mediaFileId: number;
  secureUrl: string;
  originalFileName: string;
  displayOrder: number;
  isPrimary: boolean;
}

export interface ParkingImagesResponse extends ParkingActionResult {
  code: number;
  parkingSpotId: number;
  data: ParkingSpotImage[];
}

export interface ParkingImageUpdatePayload {
  displayOrder: number;
  isPrimary: boolean;
}

export interface ParkingAvailabilityRuleInput {
  fromDate: string;
  toDate: string;
  fromTime: string;
  toTime: string;
  dayPattern: string;
}

export interface ParkingAvailabilityRulesPayload {
  rules: ParkingAvailabilityRuleInput[];
}

export interface ParkingAvailabilityRule extends ParkingAvailabilityRuleInput {
  availabilityRuleId: number;
}

export interface ParkingAvailabilityRulesResponse extends ParkingActionResult {
  code: number;
  parkingSpotId: number;
  timeZone: string;
  data: ParkingAvailabilityRule[];
}

export interface ParkingAvailabilityCalendarHours {
  from: string;
  to: string;
}

export interface ParkingAvailabilityCalendarDay {
  date: string;
  configuredHours: ParkingAvailabilityCalendarHours[];
  status: string;
}

export interface ParkingAvailabilityCalendarResponse extends ParkingActionResult {
  code: number;
  parkingSpotId: number;
  month: string;
  timeZone: string;
  days: ParkingAvailabilityCalendarDay[];
}

export interface MyParkingResponse {
  code: number;
  success: boolean;
  message: string;
  data: Array<{
    parkingSpotId: number;
    propertyId: number;
    ownerId: number;
    parkingLabel: string;
    availabilityStatus: string | number;
    verificationStatus: string | number;
    monthlyRate: number;
    dailyRate: number | null;
    isPublished: boolean;
    createdAt: string;
    updatedAt: string;
  }>;
}

export interface Booking {
  id: string;
  date: string;
  renterPlate: string;
  renterName: string;
  bayId: string;
  bayInfo: string;
  propertyName?: string;
  duration: string;
  totalEarned: number;
  commissionPaid: number;
  status: 'Completed' | 'Upcoming' | 'Active' | 'Disputed';
  disputeReason?: string;
}

export interface WalletTransaction {
  id: string;
  date: string;
  type: 'Earning' | 'Withdrawal' | 'Overstay Fine Credit';
  amount: number;
  reference: string;
  status: 'Success' | 'Pending' | 'Failed';
}

export interface Notification {
  id: string;
  title: string;
  message: string;
  time: string;
  unread: boolean;
  type: 'booking' | 'payment' | 'system' | 'dispute';
}

export interface ScheduleBlock {
  dayOfWeek: number;
  startTime: string;
  endTime: string;
  isActive: boolean;
  rate: number;
}
