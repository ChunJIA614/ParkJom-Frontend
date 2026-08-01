import type { Booking } from '../types';

export type JourneyStage = 'reserved' | 'arrived' | 'unlocked' | 'parked';

export interface JourneySession {
  booking: Booking;
  stage: JourneyStage;
}

const STORAGE_KEY = 'parkjom.commuterJourney';

interface SerializedJourneySession {
  booking: Omit<Booking, 'startTime' | 'endTime'> & {
    startTime: string;
    endTime: string;
  };
  stage: JourneyStage;
}

export function saveJourneySession(booking: Booking, stage: JourneyStage = 'reserved') {
  const payload: SerializedJourneySession = {
    booking: {
      ...booking,
      startTime: booking.startTime.toISOString(),
      endTime: booking.endTime.toISOString(),
    },
    stage,
  };

  window.localStorage.setItem(STORAGE_KEY, JSON.stringify(payload));
}

export function loadJourneySession(): JourneySession | null {
  try {
    const raw = window.localStorage.getItem(STORAGE_KEY);
    if (!raw) return null;

    const payload = JSON.parse(raw) as SerializedJourneySession;
    return {
      stage: payload.stage,
      booking: {
        ...payload.booking,
        startTime: new Date(payload.booking.startTime),
        endTime: new Date(payload.booking.endTime),
      },
    };
  } catch {
    window.localStorage.removeItem(STORAGE_KEY);
    return null;
  }
}

export function updateJourneyStage(stage: JourneyStage) {
  const session = loadJourneySession();
  if (session) saveJourneySession(session.booking, stage);
}

export function clearJourneySession() {
  window.localStorage.removeItem(STORAGE_KEY);
}
