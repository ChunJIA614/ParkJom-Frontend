import type { Booking } from '../types';

export type JourneyStage = 'reserved' | 'arrived' | 'unlocked' | 'parked';

export interface JourneySession {
  booking: Booking;
  stage: JourneyStage;
}

const LEGACY_STORAGE_KEY = 'parkjom.commuterJourney';
const storageKey = (userId: number) => `${LEGACY_STORAGE_KEY}.${userId}`;

interface SerializedJourneySession {
  userId: number;
  booking: Omit<Booking, 'startTime' | 'endTime'> & {
    startTime: string;
    endTime: string;
  };
  stage: JourneyStage;
}

function purgeLegacyUnscopedJourney() {
  try {
    window.localStorage.removeItem(LEGACY_STORAGE_KEY);
  } catch {
    // Ignore storage errors
  }
}

export function saveJourneySession(
  booking: Booking,
  stage: JourneyStage = 'reserved',
  userId?: number | null,
) {
  purgeLegacyUnscopedJourney();
  if (!userId || !Number.isFinite(userId)) return;

  const payload: SerializedJourneySession = {
    userId,
    booking: {
      ...booking,
      startTime: booking.startTime.toISOString(),
      endTime: booking.endTime.toISOString(),
    },
    stage,
  };

  try {
    window.localStorage.setItem(storageKey(userId), JSON.stringify(payload));
  } catch {
    // Ignore storage errors
  }
}

export function loadJourneySession(userId?: number | null): JourneySession | null {
  purgeLegacyUnscopedJourney();
  if (!userId || !Number.isFinite(userId)) return null;

  const key = storageKey(userId);
  try {
    const raw = window.localStorage.getItem(key);
    if (!raw) return null;

    const payload = JSON.parse(raw) as Partial<SerializedJourneySession>;
    if (payload.userId !== userId || !payload.booking || !payload.stage) {
      window.localStorage.removeItem(key);
      return null;
    }

    return {
      stage: payload.stage,
      booking: {
        ...payload.booking,
        startTime: new Date(payload.booking.startTime),
        endTime: new Date(payload.booking.endTime),
      },
    };
  } catch {
    try {
      window.localStorage.removeItem(key);
    } catch {
      // Ignore storage errors
    }
    return null;
  }
}

export function updateJourneyStage(stage: JourneyStage, userId?: number | null) {
  if (!userId || !Number.isFinite(userId)) return;
  const session = loadJourneySession(userId);
  if (session) saveJourneySession(session.booking, stage, userId);
}

export function clearJourneySession(userId?: number | null) {
  purgeLegacyUnscopedJourney();
  if (!userId || !Number.isFinite(userId)) return;
  try {
    window.localStorage.removeItem(storageKey(userId));
  } catch {
    // Ignore storage errors
  }
}
