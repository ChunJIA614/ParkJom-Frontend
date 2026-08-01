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

export interface Booking {
  id: string;
  spot: ParkingSpot;
  startTime: Date;
  endTime: Date;
  vehiclePlate: string;
  status: 'Active' | 'Completed' | 'Upcoming';
  totalPaid: number;
}

export interface Vehicle {
  plate: string;
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
