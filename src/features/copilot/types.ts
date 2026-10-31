/** Wire types for POST /api/copilot/chat (see ParkJomV2 CopilotController). */

export type CopilotRole = 'user' | 'model';

export interface CopilotParkingCardData {
  parkingSpotId: number;
  parkingLabel: string;
  propertyName: string;
  address: string;
  distanceToStationMeters: number;
  walkingTimeMinutes: number;
  dailyRate: number | null;
  monthlyRate: number | null;
  availabilityStatus: string;
  hasSmartBollard: boolean;
  stationName: string;
  stopId: string;
  lineName: string | null;
  primaryImageUrl: string | null;
}

export interface CopilotDeparture {
  direction: string;
  next: string;
  minutesUntil: number;
  following: string[];
}

export interface CopilotDeparturesCardData {
  stopId: string;
  stationName: string;
  lineName: string;
  currentTime: string;
  isOperating: boolean;
  serviceStatus: string;
  isPeakHour: boolean;
  frequencyMinutes: number;
  firstTrain: string;
  lastTrain: string;
  departures: CopilotDeparture[];
}

export interface CopilotBookingProposalCardData {
  parkingSpotId: number;
  parkingLabel: string;
  propertyName: string;
  address: string;
  startDate: string;
  endDate: string;
  days: number;
  dailyRate: number | null;
  estimatedSubtotal: number | null;
}

export type CopilotCard =
  | { type: 'parking'; data: CopilotParkingCardData }
  | { type: 'departures'; data: CopilotDeparturesCardData }
  | { type: 'bookingProposal'; data: CopilotBookingProposalCardData };

export interface CopilotChatResponse {
  code: number;
  success: boolean;
  message: string;
  reply: string;
  context: string | null;
  cards: CopilotCard[];
  toolsUsed: string[];
}

/** One message in the local chat transcript. */
export interface CopilotChatMessage {
  id: string;
  role: CopilotRole;
  text: string;
  /** Server-generated ID summary, echoed back so follow-ups ("book the 2nd one") resolve. */
  context?: string | null;
  cards?: CopilotCard[];
  isError?: boolean;
}

/** Wire shape for history turns sent to the server. */
export interface CopilotHistoryTurn {
  role: CopilotRole;
  text: string;
  context?: string | null;
}
