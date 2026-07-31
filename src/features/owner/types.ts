export interface ParkingBay {
  id: string;
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