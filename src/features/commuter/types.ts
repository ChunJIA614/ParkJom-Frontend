export interface ParkingSpot {
  id: string;
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

export interface Station {
  stationId: number;
  stationName: string;
}

export interface Property {
  propertyId: number;
  propertyName: string;
  propertyType: number;      // 1=Condominium, 2=Apartment
  address: string;
  latitude: number;
  longitude: number;
  distanceToStation: number; // km
}
