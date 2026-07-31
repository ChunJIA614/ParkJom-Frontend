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

export interface ListingRequest {
  id: string;                      // verificationRequestId as string
  verificationRequestId: number;   // from backend verification endpoint
  parkingSpotId: number;           // from backend
  propertyId: number;              // from backend
  ownerName: string;               // submittedByName
  ownerEmail: string;              // submittedByEmail
  location: string;                // propertyName (since address not in verification response)
  bayNumber: string;               // parkingLabel
  hourlyRate: number;
  documents: {
    titleDeed: string;
    utilityBill: string;
    identityCard: string;
  };
  submittedAt: string;
  status: 'pending' | 'approved' | 'rejected';
  rejectionReason?: string;
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
