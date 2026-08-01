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
