import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import {
  AlertCircle,
  Ban,
  CalendarDays,
  CalendarRange,
  Car,
  Check,
  CheckCircle2,
  ChevronLeft,
  ChevronRight,
  ClipboardCheck,
  FileText,
  ImagePlus,
  Info,
  Lock,
  MapPin,
  RotateCcw,
  Save,
  Send,
  ShieldCheck,
  Trash2,
  UploadCloud,
  Users,
} from 'lucide-react';
import { ParkingBay } from '../types';

/**
 * Local owner parking workspace storage.  The shape is deliberately JSON
 * friendly so it can later be replaced by the owner API without changing the
 * timetable's UI model.
 */
export const OWNER_PARKING_WORKSPACE_STORAGE_KEY = 'parkjom_owner_parking_workspace_v1';

export type ParkingDayStatus = 'available' | 'unavailable' | 'booked';

export interface OwnerParkingBooking {
  id?: string;
  commuterName?: string;
  commuterPhone?: string;
  vehicle?: string;
  bookedAt?: string;
}

export interface OwnerParkingDay {
  status: ParkingDayStatus;
  booking?: OwnerParkingBooking;
}

export interface OwnerParkingSetup {
  photos: string[];
  description: string;
  accessInstructions: string;
  dailyRate: number | null;
  monthlyRate: number | null;
  published: boolean;
  updatedAt?: string;
}

export interface OwnerParkingWorkspaceSpot {
  setup: OwnerParkingSetup;
  days: Record<string, OwnerParkingDay>;
}

export interface OwnerParkingWorkspace {
  version: 1;
  spots: Record<string, OwnerParkingWorkspaceSpot>;
}

export interface AvailabilitySchedulerProps {
  bays: ParkingBay[];
  initialParkingSpotId?: number;
  initialSection?: 'setup' | 'timetable';
  onScheduleChange?: () => void;
}

const MAX_PHOTOS = 5;
const MAX_BULK_DAYS = 366;

const statusMeta: Record<ParkingDayStatus, {
  label: string;
  shortLabel: string;
  icon: typeof CheckCircle2;
  cell: string;
  badge: string;
}> = {
  available: {
    label: 'Available for booking',
    shortLabel: 'Available',
    icon: CheckCircle2,
    cell: 'border-emerald-300 bg-emerald-50 text-emerald-800 hover:bg-emerald-100',
    badge: 'border-emerald-200 bg-emerald-50 text-emerald-700',
  },
  unavailable: {
    label: 'Not available for booking',
    shortLabel: 'Not available',
    icon: Ban,
    cell: 'border-slate-200 bg-slate-100 text-slate-600 hover:bg-slate-200',
    badge: 'border-slate-200 bg-slate-100 text-slate-600',
  },
  booked: {
    label: 'Booked by commuter',
    shortLabel: 'Booked',
    icon: Lock,
    cell: 'border-blue-300 bg-blue-50 text-blue-800',
    badge: 'border-blue-200 bg-blue-50 text-blue-700',
  },
};

function safeNumber(value: unknown): number | null {
  if (typeof value === 'number' && Number.isFinite(value)) return value;
  if (typeof value === 'string' && value.trim() !== '') {
    const parsed = Number(value);
    if (Number.isFinite(parsed)) return parsed;
  }
  return null;
}

function normaliseStatus(value: unknown): ParkingDayStatus {
  const status = String(value ?? '').trim().toLowerCase();
  if (status === 'available' || status === 'open' || status === 'active') return 'available';
  if (status === 'booked' || status === 'reserved' || status === 'occupied') return 'booked';
  return 'unavailable';
}

function normaliseBooking(value: unknown): OwnerParkingBooking | undefined {
  if (!value || typeof value !== 'object') return undefined;
  const candidate = value as Record<string, unknown>;
  return {
    id: typeof candidate.id === 'string' ? candidate.id : undefined,
    commuterName: typeof candidate.commuterName === 'string' ? candidate.commuterName : undefined,
    commuterPhone: typeof candidate.commuterPhone === 'string' ? candidate.commuterPhone : undefined,
    vehicle: typeof candidate.vehicle === 'string' ? candidate.vehicle : undefined,
    bookedAt: typeof candidate.bookedAt === 'string' ? candidate.bookedAt : undefined,
  };
}

function emptySetup(bay?: ParkingBay): OwnerParkingSetup {
  return {
    photos: [],
    description: '',
    accessInstructions: '',
    dailyRate: bay && safeNumber(bay.dailyRate) && (bay.dailyRate ?? 0) > 0 ? bay.dailyRate : null,
    monthlyRate: bay && safeNumber(bay.monthlyRate) && bay.monthlyRate > 0 ? bay.monthlyRate : null,
    published: Boolean(bay?.isPublished),
  };
}

function seedDaysFromBay(bay?: ParkingBay): Record<string, OwnerParkingDay> {
  if (!bay) return {};
  const status = String(bay.availabilityStatus ?? '').trim().toLowerCase();
  if (status !== 'reserved' && status !== 'occupied' && status !== 'booked') return {};
  const date = localDateKey();
  return {
    [date]: {
      status: 'booked',
      booking: {
        id: `mock-${bay.parkingSpotId}-${date}`,
        commuterName: 'Current commuter booking',
        vehicle: 'Booking details from backend',
      },
    },
  };
}

function normaliseSetup(value: unknown, bay?: ParkingBay): OwnerParkingSetup {
  const fallback = emptySetup(bay);
  if (!value || typeof value !== 'object') return fallback;
  const candidate = value as Record<string, unknown>;
  const photos = Array.isArray(candidate.photos)
    ? candidate.photos.filter((photo): photo is string => typeof photo === 'string').slice(0, MAX_PHOTOS)
    : fallback.photos;
  return {
    photos,
    description: typeof candidate.description === 'string' ? candidate.description : fallback.description,
    accessInstructions: typeof candidate.accessInstructions === 'string'
      ? candidate.accessInstructions
      : fallback.accessInstructions,
    dailyRate: candidate.dailyRate === undefined ? fallback.dailyRate : safeNumber(candidate.dailyRate),
    monthlyRate: candidate.monthlyRate === undefined ? fallback.monthlyRate : safeNumber(candidate.monthlyRate),
    published: typeof candidate.published === 'boolean' ? candidate.published : fallback.published,
    updatedAt: typeof candidate.updatedAt === 'string' ? candidate.updatedAt : undefined,
  };
}

function normaliseSpot(value: unknown, bay?: ParkingBay): OwnerParkingWorkspaceSpot {
  const candidate = value && typeof value === 'object' ? value as Record<string, unknown> : {};
  const rawDays = candidate.days && typeof candidate.days === 'object'
    ? candidate.days as Record<string, unknown>
    : {};
  const days: Record<string, OwnerParkingDay> = {};
  Object.entries(rawDays).forEach(([date, rawDay]) => {
    if (!/^\d{4}-\d{2}-\d{2}$/.test(date) || !rawDay || typeof rawDay !== 'object') return;
    const day = rawDay as Record<string, unknown>;
    const dayStatus = normaliseStatus(day.status);
    days[date] = {
      status: dayStatus,
      booking: dayStatus === 'booked' ? normaliseBooking(day.booking) : undefined,
    };
  });
  const seeded = seedDaysFromBay(bay);
  Object.entries(seeded).forEach(([date, day]) => {
    if (!days[date] || days[date].status !== 'booked') days[date] = day;
  });
  return { setup: normaliseSetup(candidate.setup, bay), days };
}

function rawWorkspace(): OwnerParkingWorkspace {
  if (typeof window === 'undefined') return { version: 1, spots: {} };
  try {
    const saved = window.localStorage.getItem(OWNER_PARKING_WORKSPACE_STORAGE_KEY);
    if (!saved) return { version: 1, spots: {} };
    const parsed: unknown = JSON.parse(saved);
    if (!parsed || typeof parsed !== 'object') return { version: 1, spots: {} };
    const candidate = parsed as Record<string, unknown>;
    const rawSpots = candidate.spots && typeof candidate.spots === 'object'
      ? candidate.spots as Record<string, unknown>
      : {};
    const spots: Record<string, OwnerParkingWorkspaceSpot> = {};
    Object.entries(rawSpots).forEach(([id, value]) => {
      if (/^\d+$/.test(id)) spots[id] = normaliseSpot(value);
    });
    return { version: 1, spots };
  } catch {
    return { version: 1, spots: {} };
  }
}

function mergeWorkspaceWithBays(workspace: OwnerParkingWorkspace, bays: ParkingBay[]): OwnerParkingWorkspace {
  const spots = { ...workspace.spots };
  bays.forEach((bay) => {
    const id = String(bay.parkingSpotId);
    const existing = spots[id];
    spots[id] = normaliseSpot(existing, bay);
  });
  return { version: 1, spots };
}

/** Read the persisted workspace, optionally adding the current bays as defaults. */
export function getOwnerParkingWorkspace(bays: ParkingBay[] = []): OwnerParkingWorkspace {
  return mergeWorkspaceWithBays(rawWorkspace(), bays);
}

/** Return a persisted day status for dashboard summaries. Unspecified days are unavailable by default. */
export function getStoredParkingDayStatus(
  parkingSpotId: number,
  date: string = localDateKey(),
): ParkingDayStatus {
  const workspace = getOwnerParkingWorkspace();
  return workspace.spots[String(parkingSpotId)]?.days[date]?.status ?? 'unavailable';
}

export function getStoredParkingDay(
  parkingSpotId: number,
  date: string = localDateKey(),
): OwnerParkingDay {
  const workspace = getOwnerParkingWorkspace();
  return workspace.spots[String(parkingSpotId)]?.days[date] ?? { status: 'unavailable' };
}

/** Local calendar key; intentionally avoids UTC conversion around midnight. */
export function localDateKey(date: Date = new Date()): string {
  return `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}-${String(date.getDate()).padStart(2, '0')}`;
}

function dateFromKey(key: string): Date {
  const [year, month, day] = key.split('-').map(Number);
  return new Date(year, (month || 1) - 1, day || 1);
}

function dateKeyIsPast(key: string): boolean {
  return key < localDateKey();
}

function addDays(date: Date, amount: number): Date {
  const next = new Date(date.getFullYear(), date.getMonth(), date.getDate());
  next.setDate(next.getDate() + amount);
  return next;
}

function inclusiveDateKeys(start: string, end: string): string[] {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(start) || !/^\d{4}-\d{2}-\d{2}$/.test(end)) return [];
  const first = dateFromKey(start);
  const last = dateFromKey(end);
  if (first.getTime() > last.getTime()) return [];
  const result: string[] = [];
  let cursor = first;
  while (cursor.getTime() <= last.getTime() && result.length <= MAX_BULK_DAYS) {
    result.push(localDateKey(cursor));
    cursor = addDays(cursor, 1);
  }
  return result;
}

function formatLongDate(key: string): string {
  return new Intl.DateTimeFormat('en-MY', {
    weekday: 'long',
    day: 'numeric',
    month: 'long',
    year: 'numeric',
  }).format(dateFromKey(key));
}

function formatShortDate(key: string): string {
  return new Intl.DateTimeFormat('en-MY', { day: 'numeric', month: 'short' }).format(dateFromKey(key));
}

function fileToDataUrl(file: File): Promise<string> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => resolve(typeof reader.result === 'string' ? reader.result : '');
    reader.onerror = () => reject(new Error('Unable to read image'));
    reader.readAsDataURL(file);
  });
}

function validPhoto(file: File): boolean {
  const extension = file.name.split('.').pop()?.toLowerCase() ?? '';
  return ['jpg', 'jpeg', 'png', 'webp'].includes(extension)
    && (!file.type || ['image/jpeg', 'image/png', 'image/webp'].includes(file.type));
}

function bayLabel(bay: ParkingBay): string {
  return `${bay.bayNumber || bay.parkingLabel || `Spot #${bay.parkingSpotId}`} · ${bay.propertyName || `Property #${bay.propertyId}`}`;
}

function statusFor(spot: OwnerParkingWorkspaceSpot | undefined, date: string): OwnerParkingDay {
  return spot?.days[date] ?? { status: 'unavailable' };
}

function setupFromSpot(spot: OwnerParkingWorkspaceSpot | undefined, bay?: ParkingBay): OwnerParkingSetup {
  return spot?.setup ?? emptySetup(bay);
}

function rateText(value: number | null): string {
  return value === null || !Number.isFinite(value) ? '—' : `RM ${value.toFixed(2)}`;
}

function setupCompletion(setup: OwnerParkingSetup): { complete: boolean; issues: string[] } {
  const issues: string[] = [];
  if (setup.photos.length === 0) issues.push('Add at least one parking photo.');
  if (!setup.description.trim()) issues.push('Add a short parking description.');
  if ((setup.dailyRate ?? 0) <= 0 && (setup.monthlyRate ?? 0) <= 0) issues.push('Set a daily or monthly rate.');
  return { complete: issues.length === 0, issues };
}

function StepPill({ number, label, active, complete }: { number: number; label: string; active: boolean; complete: boolean }) {
  return (
    <div className={`flex min-w-0 flex-1 items-center gap-2 rounded-xl border px-2.5 py-2 ${active ? 'border-blue-200 bg-blue-50' : 'border-slate-100 bg-slate-50'}`}>
      <span className={`flex h-6 w-6 shrink-0 items-center justify-center rounded-full text-[10px] font-bold ${complete ? 'bg-emerald-600 text-white' : active ? 'bg-blue-600 text-white' : 'bg-slate-200 text-slate-500'}`}>
        {complete ? <Check className="h-3.5 w-3.5" aria-hidden="true" /> : number}
      </span>
      <span className={`truncate text-[10px] font-bold ${active ? 'text-blue-800' : 'text-slate-500'}`}>{label}</span>
    </div>
  );
}

export default function AvailabilityScheduler({
  bays,
  initialParkingSpotId,
  initialSection = 'setup',
  onScheduleChange,
}: AvailabilitySchedulerProps) {
  const todayKey = localDateKey();
  const [workspace, setWorkspace] = useState<OwnerParkingWorkspace>(() => getOwnerParkingWorkspace(bays));
  const [selectedBayId, setSelectedBayId] = useState<string>(() => {
    const preferred = initialParkingSpotId && bays.find((bay) => bay.parkingSpotId === initialParkingSpotId);
    return String(preferred?.parkingSpotId ?? bays[0]?.parkingSpotId ?? '');
  });
  const [section, setSection] = useState<'setup' | 'timetable'>(initialSection);
  const [monthCursor, setMonthCursor] = useState<Date>(() => {
    const now = new Date();
    return new Date(now.getFullYear(), now.getMonth(), 1);
  });
  const [selectedDate, setSelectedDate] = useState(todayKey);
  const [setupStep, setSetupStep] = useState<1 | 2 | 3>(1);
  const [setupForm, setSetupForm] = useState<{
    photos: string[];
    description: string;
    accessInstructions: string;
    dailyRate: string;
    monthlyRate: string;
  }>({ photos: [], description: '', accessInstructions: '', dailyRate: '', monthlyRate: '' });
  const [photoPreviews, setPhotoPreviews] = useState<Record<string, string[]>>({});
  const [pendingPhotoCount, setPendingPhotoCount] = useState(0);
  const [setupMessage, setSetupMessage] = useState<string | null>(null);
  const [setupError, setSetupError] = useState<string | null>(null);
  const [bulkStart, setBulkStart] = useState(todayKey);
  const [bulkEnd, setBulkEnd] = useState(todayKey);
  const [bulkMessage, setBulkMessage] = useState<string | null>(null);
  const [bulkError, setBulkError] = useState<string | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const objectUrlsRef = useRef<Set<string>>(new Set());

  const activeBay = bays.find((bay) => String(bay.parkingSpotId) === selectedBayId) ?? bays[0];
  const activeSpotId = activeBay ? String(activeBay.parkingSpotId) : '';
  const activeSpot = activeSpotId ? workspace.spots[activeSpotId] : undefined;
  const activeSetup = setupFromSpot(activeSpot, activeBay);

  useEffect(() => {
    setWorkspace((current) => mergeWorkspaceWithBays(current, bays));
  }, [bays]);

  useEffect(() => {
    if (bays.length === 0) {
      setSelectedBayId('');
      return;
    }
    const preferred = initialParkingSpotId && bays.find((bay) => bay.parkingSpotId === initialParkingSpotId);
    const preferredId = String(preferred?.parkingSpotId ?? bays[0].parkingSpotId);
    if (!bays.some((bay) => String(bay.parkingSpotId) === selectedBayId)) setSelectedBayId(preferredId);
  }, [bays, initialParkingSpotId, selectedBayId]);

  useEffect(() => {
    if (initialParkingSpotId === undefined) return;
    const preferred = bays.find((bay) => bay.parkingSpotId === initialParkingSpotId);
    if (preferred) setSelectedBayId(String(preferred.parkingSpotId));
  }, [initialParkingSpotId, bays]);

  useEffect(() => {
    setSection(initialSection);
  }, [initialSection]);

  useEffect(() => {
    if (!selectedBayId) return;
    const setup = setupFromSpot(workspace.spots[selectedBayId], bays.find((bay) => String(bay.parkingSpotId) === selectedBayId));
    setSetupForm({
      photos: [...setup.photos],
      description: setup.description,
      accessInstructions: setup.accessInstructions,
      dailyRate: setup.dailyRate === null ? '' : String(setup.dailyRate),
      monthlyRate: setup.monthlyRate === null ? '' : String(setup.monthlyRate),
    });
    setPhotoPreviews((current) => ({ ...current, [selectedBayId]: [...setup.photos] }));
    setSetupStep(1);
    setSetupMessage(null);
    setSetupError(null);
    setPendingPhotoCount(0);
    setSelectedDate(todayKey);
    const now = new Date();
    setMonthCursor(new Date(now.getFullYear(), now.getMonth(), 1));
    setBulkStart(todayKey);
    setBulkEnd(todayKey);
    setBulkMessage(null);
    setBulkError(null);
  }, [selectedBayId]);

  useEffect(() => {
    if (typeof window === 'undefined') return;
    try {
      window.localStorage.setItem(OWNER_PARKING_WORKSPACE_STORAGE_KEY, JSON.stringify(workspace));
    } catch {
      // Storage can be unavailable in private browsing; the in-memory editor still works.
    }
  }, [workspace]);

  useEffect(() => () => {
    objectUrlsRef.current.forEach((url) => URL.revokeObjectURL(url));
    objectUrlsRef.current.clear();
  }, []);

  const notifyChange = useCallback(() => {
    onScheduleChange?.();
  }, [onScheduleChange]);

  const updateWorkspace = useCallback((updater: (current: OwnerParkingWorkspace) => OwnerParkingWorkspace) => {
    setWorkspace(updater);
    notifyChange();
  }, [notifyChange]);

  const replaceSetupForm = (field: keyof typeof setupForm, value: string | string[]) => {
    setSetupForm((current) => ({ ...current, [field]: value }));
    setSetupMessage(null);
    setSetupError(null);
  };

  const handlePhotoChange = async (event: React.ChangeEvent<HTMLInputElement>) => {
    const files = Array.from(event.target.files ?? []);
    event.target.value = '';
    if (!activeSpotId || files.length === 0) return;
    const invalid = files.find((file) => !validPhoto(file));
    if (invalid) {
      setSetupError('Photos must be JPG, JPEG, PNG, or WEBP images.');
      return;
    }
    const existing = photoPreviews[activeSpotId] ?? setupForm.photos;
    const available = Math.max(0, MAX_PHOTOS - existing.length);
    if (available === 0) {
      setSetupError(`You can upload up to ${MAX_PHOTOS} photos.`);
      return;
    }
    const selected = files.slice(0, available);
    const objectUrls = selected.map((file) => {
      const url = URL.createObjectURL(file);
      objectUrlsRef.current.add(url);
      return url;
    });
    setPhotoPreviews((current) => ({
      ...current,
      [activeSpotId]: [...(current[activeSpotId] ?? []), ...objectUrls].slice(0, MAX_PHOTOS),
    }));
    setSetupForm((current) => ({ ...current, photos: [...current.photos, ...objectUrls].slice(0, MAX_PHOTOS) }));
    setPendingPhotoCount((count) => count + selected.length);
    setSetupError(files.length > selected.length ? `Only ${MAX_PHOTOS} photos can be kept; extra files were skipped.` : null);

    try {
      const dataUrls = await Promise.all(selected.map((file) => fileToDataUrl(file)));
      const replacements = new Map(objectUrls.map((url, index) => [url, dataUrls[index]]));
      setPhotoPreviews((current) => ({
        ...current,
        [activeSpotId]: (current[activeSpotId] ?? []).map((photo) => replacements.get(photo) ?? photo),
      }));
      setSetupForm((current) => ({
        ...current,
        photos: current.photos.map((photo) => replacements.get(photo) ?? photo),
      }));
      objectUrls.forEach((url) => {
        URL.revokeObjectURL(url);
        objectUrlsRef.current.delete(url);
      });
    } catch {
      setSetupError('One or more photos could not be read. Please try again.');
      setPhotoPreviews((current) => ({
        ...current,
        [activeSpotId]: (current[activeSpotId] ?? []).filter((photo) => !objectUrls.includes(photo)),
      }));
      setSetupForm((current) => ({ ...current, photos: current.photos.filter((photo) => !objectUrls.includes(photo)) }));
      objectUrls.forEach((url) => {
        URL.revokeObjectURL(url);
        objectUrlsRef.current.delete(url);
      });
    } finally {
      setPendingPhotoCount((count) => Math.max(0, count - selected.length));
    }
  };

  const removePhoto = (index: number) => {
    if (!activeSpotId) return;
    const preview = photoPreviews[activeSpotId]?.[index];
    if (preview && objectUrlsRef.current.has(preview)) {
      URL.revokeObjectURL(preview);
      objectUrlsRef.current.delete(preview);
    }
    setPhotoPreviews((current) => ({
      ...current,
      [activeSpotId]: (current[activeSpotId] ?? []).filter((_, itemIndex) => itemIndex !== index),
    }));
    setSetupForm((current) => ({ ...current, photos: current.photos.filter((_, itemIndex) => itemIndex !== index) }));
  };

  const persistSetup = (publish: boolean): boolean => {
    if (!activeSpotId) return false;
    if (pendingPhotoCount > 0) {
      setSetupError('Please wait for the photo previews to finish loading.');
      return false;
    }
    const daily = setupForm.dailyRate.trim() === '' ? null : Number(setupForm.dailyRate);
    const monthly = setupForm.monthlyRate.trim() === '' ? null : Number(setupForm.monthlyRate);
    if ((daily !== null && (!Number.isFinite(daily) || daily < 0)) || (monthly !== null && (!Number.isFinite(monthly) || monthly < 0))) {
      setSetupError('Rates must be zero or a positive number.');
      return false;
    }
    const nextSetup: OwnerParkingSetup = {
      // Keep both data URLs created by this prototype and any future API
      // URLs/paths.  The component deliberately does not assume a backend
      // image URL shape yet.
      photos: setupForm.photos.filter((photo) => photo.trim().length > 0).slice(0, MAX_PHOTOS),
      description: setupForm.description.trim(),
      accessInstructions: setupForm.accessInstructions.trim(),
      dailyRate: daily !== null && daily > 0 ? daily : null,
      monthlyRate: monthly !== null && monthly > 0 ? monthly : null,
      published: publish ? true : activeSetup.published,
      updatedAt: new Date().toISOString(),
    };
    updateWorkspace((current) => {
      const spot = current.spots[activeSpotId] ?? normaliseSpot(undefined, activeBay);
      return {
        ...current,
        spots: {
          ...current.spots,
          [activeSpotId]: { ...spot, setup: nextSetup },
        },
      };
    });
    setSetupForm({
      photos: [...nextSetup.photos],
      description: nextSetup.description,
      accessInstructions: nextSetup.accessInstructions,
      dailyRate: nextSetup.dailyRate === null ? '' : String(nextSetup.dailyRate),
      monthlyRate: nextSetup.monthlyRate === null ? '' : String(nextSetup.monthlyRate),
    });
    setPhotoPreviews((current) => ({ ...current, [activeSpotId]: [...nextSetup.photos] }));
    setSetupMessage(publish ? 'Parking setup published locally. It is ready for timetable changes.' : 'Draft saved locally.');
    setSetupError(null);
    return true;
  };

  const continueToReview = () => {
    const candidate: OwnerParkingSetup = {
      photos: setupForm.photos,
      description: setupForm.description,
      accessInstructions: setupForm.accessInstructions,
      dailyRate: setupForm.dailyRate.trim() === '' ? null : Number(setupForm.dailyRate),
      monthlyRate: setupForm.monthlyRate.trim() === '' ? null : Number(setupForm.monthlyRate),
      published: activeSetup.published,
    };
    const completion = setupCompletion(candidate);
    if (!completion.complete) {
      setSetupError(completion.issues.join(' '));
      return;
    }
    setSetupError(null);
    setSetupStep(2);
  };

  const handlePublish = () => {
    if (persistSetup(true)) setSetupStep(3);
  };

  const selectDate = (date: string) => {
    setSelectedDate(date);
    const parsed = dateFromKey(date);
    setMonthCursor(new Date(parsed.getFullYear(), parsed.getMonth(), 1));
  };

  const toggleDate = (date: string) => {
    if (!activeSpotId || dateKeyIsPast(date)) return;
    const currentDay = statusFor(workspace.spots[activeSpotId], date);
    if (currentDay.status === 'booked') return;
    const nextStatus: ParkingDayStatus = currentDay.status === 'available' ? 'unavailable' : 'available';
    updateWorkspace((current) => {
      const spot = current.spots[activeSpotId] ?? normaliseSpot(undefined, activeBay);
      return {
        ...current,
        spots: {
          ...current.spots,
          [activeSpotId]: {
            ...spot,
            days: { ...spot.days, [date]: { status: nextStatus } },
          },
        },
      };
    });
    setBulkMessage(`${formatShortDate(date)} marked ${statusMeta[nextStatus].shortLabel.toLowerCase()}.`);
    setBulkError(null);
  };

  const setPreset = (preset: 'week' | 'month') => {
    const now = new Date();
    if (preset === 'week') {
      const mondayOffset = (now.getDay() + 6) % 7;
      setBulkStart(localDateKey(addDays(now, -mondayOffset)));
      setBulkEnd(localDateKey(addDays(now, 6 - mondayOffset)));
    } else {
      setBulkStart(localDateKey(new Date(now.getFullYear(), now.getMonth(), 1)));
      setBulkEnd(localDateKey(new Date(now.getFullYear(), now.getMonth() + 1, 0)));
    }
    setBulkMessage(null);
    setBulkError(null);
  };

  const bulkUpdate = (nextStatus: 'available' | 'unavailable') => {
    if (!activeSpotId) return;
    const keys = inclusiveDateKeys(bulkStart, bulkEnd);
    if (keys.length === 0) {
      setBulkError('Choose a valid inclusive start and end date.');
      setBulkMessage(null);
      return;
    }
    if (keys.length > MAX_BULK_DAYS) {
      setBulkError(`Choose a range of ${MAX_BULK_DAYS} days or fewer.`);
      setBulkMessage(null);
      return;
    }
    const currentSpot = workspace.spots[activeSpotId] ?? normaliseSpot(undefined, activeBay);
    const editableDates = keys.filter((date) => {
      const currentDay = statusFor(currentSpot, date);
      return !dateKeyIsPast(date) && currentDay.status !== 'booked';
    });
    const skipped = keys.length - editableDates.length;
    const changed = editableDates.reduce((count, date) => (
      statusFor(currentSpot, date).status === nextStatus ? count : count + 1
    ), 0);
    updateWorkspace((current) => {
      const spot = current.spots[activeSpotId] ?? normaliseSpot(undefined, activeBay);
      const days = { ...spot.days };
      editableDates.forEach((date) => {
        days[date] = { status: nextStatus };
      });
      return { ...current, spots: { ...current.spots, [activeSpotId]: { ...spot, days } } };
    });
    setBulkError(null);
    setBulkMessage(`${changed} day${changed === 1 ? '' : 's'} marked ${statusMeta[nextStatus].shortLabel.toLowerCase()}.${skipped ? ` ${skipped} booked/past day${skipped === 1 ? '' : 's'} skipped.` : ''}`);
  };

  const calendarDays = useMemo(() => {
    const first = new Date(monthCursor.getFullYear(), monthCursor.getMonth(), 1);
    const gridStart = addDays(first, -first.getDay());
    return Array.from({ length: 42 }, (_, index) => addDays(gridStart, index));
  }, [monthCursor]);

  const selectedDay = statusFor(activeSpot, selectedDate);
  const selectedDayMeta = statusMeta[selectedDay.status];
  const SelectedDayIcon = selectedDayMeta.icon;
  const selectedDayIsPast = dateKeyIsPast(selectedDate);
  const monthStats = useMemo(() => {
    const month = monthCursor.getMonth();
    const year = monthCursor.getFullYear();
    let available = 0;
    let booked = 0;
    calendarDays.forEach((day) => {
      if (day.getMonth() !== month || day.getFullYear() !== year) return;
      const status = statusFor(activeSpot, localDateKey(day)).status;
      if (status === 'available') available += 1;
      if (status === 'booked') booked += 1;
    });
    return { available, booked };
  }, [activeSpot, calendarDays, monthCursor]);

  if (!activeBay) {
    return (
      <div className="rounded-2xl border border-dashed border-slate-300 bg-white p-10 text-center shadow-sm">
        <CalendarDays className="mx-auto h-10 w-10 text-slate-300" aria-hidden="true" />
        <h2 className="mt-3 text-sm font-bold text-slate-800">No parking spots to configure</h2>
        <p className="mt-1 text-xs text-slate-500">Register a parking spot first, then return here to add setup details and a timetable.</p>
      </div>
    );
  }

  const setupPhotos = photoPreviews[activeSpotId] ?? setupForm.photos;
  const setupCandidate: OwnerParkingSetup = {
    photos: setupForm.photos,
    description: setupForm.description,
    accessInstructions: setupForm.accessInstructions,
    dailyRate: setupForm.dailyRate.trim() === '' ? null : Number(setupForm.dailyRate),
    monthlyRate: setupForm.monthlyRate.trim() === '' ? null : Number(setupForm.monthlyRate),
    published: activeSetup.published,
  };
  const setupIsComplete = setupCompletion(setupCandidate).complete;

  return (
    <div className="space-y-5 md:space-y-6">
      <header className="flex flex-col gap-3 rounded-2xl border border-slate-200 bg-white p-4 shadow-sm md:p-5 sm:flex-row sm:items-start sm:justify-between">
        <div>
          <div className="flex items-center gap-2">
            <CalendarDays className="h-5 w-5 text-blue-600" aria-hidden="true" />
            <h1 className="text-xl font-extrabold tracking-tight text-slate-900">Configure parking</h1>
          </div>
          <p className="mt-1 max-w-2xl text-[11px] leading-relaxed text-slate-500">
            Keep infrequent parking setup separate from the daily availability timetable. Changes are saved as local JSON for this prototype.
          </p>
        </div>
        <div className="flex items-center gap-2 rounded-xl border border-slate-100 bg-slate-50 px-3 py-2 text-[10px] text-slate-600">
          <MapPin className="h-3.5 w-3.5 text-blue-600" aria-hidden="true" />
          <span className="max-w-[220px] truncate">{bayLabel(activeBay)}</span>
        </div>
      </header>

      <div className="rounded-2xl border border-slate-200 bg-white p-2 shadow-sm">
        <div className="flex flex-col gap-3 md:flex-row md:items-center md:justify-between">
          <label className="flex min-w-0 flex-1 items-center gap-2 px-2 py-1">
            <span className="shrink-0 text-[10px] font-bold uppercase tracking-wider text-slate-500">Parking spot</span>
            <select
              value={selectedBayId}
              onChange={(event) => setSelectedBayId(event.target.value)}
              disabled={pendingPhotoCount > 0}
              className="min-w-0 flex-1 rounded-lg border border-slate-200 bg-white px-3 py-2 text-xs font-semibold text-slate-800 outline-none focus:border-blue-500 focus:ring-2 focus:ring-blue-100 disabled:opacity-60"
            >
              {bays.map((bay) => <option key={bay.id || bay.parkingSpotId} value={String(bay.parkingSpotId)}>{bayLabel(bay)}</option>)}
            </select>
          </label>
          <div className="grid grid-cols-2 gap-1 rounded-xl bg-slate-100 p-1 md:w-[270px]">
            <button
              type="button"
              onClick={() => setSection('setup')}
              className={`min-h-9 rounded-lg px-3 text-[11px] font-bold transition-colors ${section === 'setup' ? 'bg-white text-blue-700 shadow-sm' : 'text-slate-500 hover:text-slate-800'}`}
              aria-pressed={section === 'setup'}
            >
              <span className="inline-flex items-center gap-1.5"><FileText className="h-3.5 w-3.5" aria-hidden="true" /> Setup</span>
            </button>
            <button
              type="button"
              onClick={() => setSection('timetable')}
              className={`min-h-9 rounded-lg px-3 text-[11px] font-bold transition-colors ${section === 'timetable' ? 'bg-white text-blue-700 shadow-sm' : 'text-slate-500 hover:text-slate-800'}`}
              aria-pressed={section === 'timetable'}
            >
              <span className="inline-flex items-center gap-1.5"><CalendarRange className="h-3.5 w-3.5" aria-hidden="true" /> Timetable</span>
            </button>
          </div>
        </div>
      </div>

      {section === 'setup' ? (
        <section className="grid grid-cols-1 gap-5 xl:grid-cols-[minmax(0,1.4fr)_minmax(280px,0.8fr)]">
          <div className="space-y-5 rounded-2xl border border-slate-200 bg-white p-4 shadow-sm md:p-5">
            <div className="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
              <div>
                <h2 className="text-base font-bold text-slate-900">Parking setup</h2>
                <p className="mt-0.5 text-[11px] text-slate-500">Set the information commuters see before they choose a date.</p>
              </div>
              <span className={`inline-flex w-fit items-center gap-1.5 rounded-full border px-2.5 py-1 text-[10px] font-bold ${activeSetup.published ? 'border-emerald-200 bg-emerald-50 text-emerald-700' : 'border-amber-200 bg-amber-50 text-amber-700'}`}>
                {activeSetup.published ? <CheckCircle2 className="h-3 w-3" aria-hidden="true" /> : <Info className="h-3 w-3" aria-hidden="true" />}
                {activeSetup.published ? 'Published' : 'Draft'}
              </span>
            </div>

            <div className="grid grid-cols-1 gap-2 sm:grid-cols-3" aria-label="Setup progress">
              <StepPill number={1} label="Setup" active={setupStep === 1} complete={setupStep > 1} />
              <StepPill number={2} label="Review" active={setupStep === 2} complete={setupStep > 2} />
              <StepPill number={3} label="Publish" active={setupStep === 3} complete={activeSetup.published} />
            </div>

            {setupMessage && <div role="status" className="flex items-center gap-2 rounded-xl border border-emerald-200 bg-emerald-50 px-3 py-2.5 text-[11px] font-medium text-emerald-700"><CheckCircle2 className="h-4 w-4 shrink-0" aria-hidden="true" />{setupMessage}</div>}
            {setupError && <div role="alert" className="flex items-start gap-2 rounded-xl border border-rose-200 bg-rose-50 px-3 py-2.5 text-[11px] font-medium text-rose-700"><AlertCircle className="mt-0.5 h-4 w-4 shrink-0" aria-hidden="true" />{setupError}</div>}

            {setupStep === 1 && (
              <div className="space-y-5">
                <div>
                  <div className="mb-1.5 flex items-center justify-between gap-2">
                    <label className="text-[11px] font-bold uppercase tracking-wider text-slate-600">Parking photos</label>
                    <span className="text-[10px] text-slate-400">{setupPhotos.length}/{MAX_PHOTOS}</span>
                  </div>
                  <input ref={fileInputRef} type="file" accept=".jpg,.jpeg,.png,.webp,image/jpeg,image/png,image/webp" multiple onChange={(event) => void handlePhotoChange(event)} className="hidden" />
                  <button type="button" onClick={() => fileInputRef.current?.click()} disabled={pendingPhotoCount > 0 || setupPhotos.length >= MAX_PHOTOS} className="flex min-h-24 w-full flex-col items-center justify-center gap-1.5 rounded-xl border border-dashed border-slate-300 bg-slate-50 px-4 text-center text-[11px] text-slate-500 transition-colors hover:border-blue-400 hover:bg-blue-50/40 disabled:cursor-not-allowed disabled:opacity-60">
                    <UploadCloud className="h-6 w-6 text-blue-500" aria-hidden="true" />
                    <span className="font-semibold text-slate-700">Upload parking photos</span>
                    <span>JPG, PNG, or WEBP · up to {MAX_PHOTOS}</span>
                  </button>
                  {setupPhotos.length > 0 && (
                    <div className="mt-3 grid grid-cols-2 gap-2 sm:grid-cols-3 md:grid-cols-5">
                      {setupPhotos.map((photo, index) => (
                        <div key={`${photo.slice(0, 24)}-${index}`} className="group relative aspect-square overflow-hidden rounded-xl border border-slate-200 bg-slate-100">
                          <img src={photo} alt={`Parking preview ${index + 1}`} className="h-full w-full object-cover" />
                          <button type="button" onClick={() => removePhoto(index)} className="absolute right-1.5 top-1.5 rounded-full bg-slate-900/75 p-1.5 text-white opacity-0 transition-opacity group-hover:opacity-100 focus:opacity-100" aria-label={`Remove parking photo ${index + 1}`}>
                            <Trash2 className="h-3 w-3" aria-hidden="true" />
                          </button>
                        </div>
                      ))}
                    </div>
                  )}
                  {pendingPhotoCount > 0 && <p className="mt-1.5 text-[10px] text-blue-600">Preparing photo preview…</p>}
                </div>

                <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
                  <label className="block">
                    <span className="mb-1.5 block text-[11px] font-bold uppercase tracking-wider text-slate-600">Description</span>
                    <textarea value={setupForm.description} onChange={(event) => replaceSetupForm('description', event.target.value)} rows={5} maxLength={500} placeholder="Describe the parking location, size, and nearby landmarks." className="w-full resize-y rounded-xl border border-slate-200 px-3 py-2.5 text-xs text-slate-800 outline-none focus:border-blue-500 focus:ring-2 focus:ring-blue-100" />
                    <span className="mt-1 block text-right text-[10px] text-slate-400">{setupForm.description.length}/500</span>
                  </label>
                  <label className="block">
                    <span className="mb-1.5 block text-[11px] font-bold uppercase tracking-wider text-slate-600">Access instructions</span>
                    <textarea value={setupForm.accessInstructions} onChange={(event) => replaceSetupForm('accessInstructions', event.target.value)} rows={5} maxLength={500} placeholder="Explain gate access, floor, lift, or handover instructions." className="w-full resize-y rounded-xl border border-slate-200 px-3 py-2.5 text-xs text-slate-800 outline-none focus:border-blue-500 focus:ring-2 focus:ring-blue-100" />
                    <span className="mt-1 block text-right text-[10px] text-slate-400">{setupForm.accessInstructions.length}/500</span>
                  </label>
                </div>

                <div>
                  <span className="mb-1.5 block text-[11px] font-bold uppercase tracking-wider text-slate-600">Parking rates</span>
                  <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
                    <label className="relative block">
                      <span className="absolute left-3 top-1/2 -translate-y-1/2 text-[11px] font-bold text-slate-400">RM</span>
                      <input type="number" min="0" step="0.01" inputMode="decimal" value={setupForm.dailyRate} onChange={(event) => replaceSetupForm('dailyRate', event.target.value)} placeholder="Daily rate" className="w-full rounded-xl border border-slate-200 py-2.5 pl-10 pr-16 text-xs font-semibold text-slate-800 outline-none focus:border-blue-500 focus:ring-2 focus:ring-blue-100" />
                      <span className="absolute right-3 top-1/2 -translate-y-1/2 text-[10px] text-slate-400">/ day</span>
                    </label>
                    <label className="relative block">
                      <span className="absolute left-3 top-1/2 -translate-y-1/2 text-[11px] font-bold text-slate-400">RM</span>
                      <input type="number" min="0" step="0.01" inputMode="decimal" value={setupForm.monthlyRate} onChange={(event) => replaceSetupForm('monthlyRate', event.target.value)} placeholder="Monthly rate" className="w-full rounded-xl border border-slate-200 py-2.5 pl-10 pr-20 text-xs font-semibold text-slate-800 outline-none focus:border-blue-500 focus:ring-2 focus:ring-blue-100" />
                      <span className="absolute right-3 top-1/2 -translate-y-1/2 text-[10px] text-slate-400">/ month</span>
                    </label>
                  </div>
                  <p className="mt-1.5 text-[10px] text-slate-400">At least one rate is needed before publishing. Leave a rate blank if it does not apply.</p>
                </div>

                <div className="flex flex-col-reverse gap-2 border-t border-slate-100 pt-4 sm:flex-row sm:justify-between">
                  <button type="button" onClick={() => persistSetup(false)} disabled={pendingPhotoCount > 0} className="inline-flex min-h-10 items-center justify-center gap-2 rounded-xl border border-slate-200 px-4 text-[11px] font-bold text-slate-700 transition-colors hover:bg-slate-50 disabled:cursor-not-allowed disabled:opacity-50"><Save className="h-3.5 w-3.5" aria-hidden="true" /> Save draft</button>
                  <button type="button" onClick={continueToReview} disabled={pendingPhotoCount > 0} className="inline-flex min-h-10 items-center justify-center gap-2 rounded-xl bg-slate-900 px-4 text-[11px] font-bold text-white transition-colors hover:bg-slate-800 disabled:cursor-not-allowed disabled:opacity-50">Review setup <ChevronRight className="h-3.5 w-3.5" aria-hidden="true" /></button>
                </div>
              </div>
            )}

            {setupStep === 2 && (
              <div className="space-y-4">
                <div className="rounded-xl border border-slate-100 bg-slate-50 p-4">
                  <div className="flex items-center gap-2"><ClipboardCheck className="h-4 w-4 text-blue-600" aria-hidden="true" /><h3 className="text-xs font-bold text-slate-800">Review before publishing</h3></div>
                  <p className="mt-1 text-[11px] leading-relaxed text-slate-500">Check the details commuters will use to identify and access this parking spot.</p>
                </div>
                <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
                  <div className="rounded-xl border border-slate-100 p-3 sm:col-span-2"><span className="text-[10px] font-bold uppercase tracking-wider text-slate-400">Photos</span><div className="mt-2 flex gap-2 overflow-x-auto">{setupPhotos.map((photo, index) => <img key={`${photo.slice(0, 20)}-${index}`} src={photo} alt={`Parking preview ${index + 1}`} className="h-16 w-16 shrink-0 rounded-lg border border-slate-200 object-cover" />)}{setupPhotos.length === 0 && <span className="text-xs text-rose-600">No photos added</span>}</div></div>
                  <div className="rounded-xl border border-slate-100 p-3"><span className="text-[10px] font-bold uppercase tracking-wider text-slate-400">Description</span><p className="mt-1 whitespace-pre-wrap text-xs text-slate-700">{setupForm.description || 'Not provided'}</p></div>
                  <div className="rounded-xl border border-slate-100 p-3"><span className="text-[10px] font-bold uppercase tracking-wider text-slate-400">Access</span><p className="mt-1 whitespace-pre-wrap text-xs text-slate-700">{setupForm.accessInstructions || 'No special instructions'}</p></div>
                  <div className="rounded-xl border border-slate-100 p-3"><span className="text-[10px] font-bold uppercase tracking-wider text-slate-400">Daily rate</span><p className="mt-1 text-sm font-bold text-emerald-700">{setupForm.dailyRate ? `RM ${Number(setupForm.dailyRate).toFixed(2)}` : '—'}</p></div>
                  <div className="rounded-xl border border-slate-100 p-3"><span className="text-[10px] font-bold uppercase tracking-wider text-slate-400">Monthly rate</span><p className="mt-1 text-sm font-bold text-emerald-700">{setupForm.monthlyRate ? `RM ${Number(setupForm.monthlyRate).toFixed(2)}` : '—'}</p></div>
                </div>
                <div className="flex flex-col-reverse gap-2 border-t border-slate-100 pt-4 sm:flex-row sm:justify-between"><button type="button" onClick={() => setSetupStep(1)} className="inline-flex min-h-10 items-center justify-center gap-2 rounded-xl border border-slate-200 px-4 text-[11px] font-bold text-slate-700 hover:bg-slate-50"><ChevronLeft className="h-3.5 w-3.5" aria-hidden="true" /> Edit setup</button><div className="flex flex-col gap-2 sm:flex-row"><button type="button" onClick={() => persistSetup(false)} disabled={pendingPhotoCount > 0} className="inline-flex min-h-10 items-center justify-center gap-2 rounded-xl border border-slate-200 px-4 text-[11px] font-bold text-slate-700 hover:bg-slate-50 disabled:opacity-50"><Save className="h-3.5 w-3.5" aria-hidden="true" /> Save draft</button><button type="button" onClick={() => { setSetupError(null); setSetupStep(3); }} disabled={!setupIsComplete} className="inline-flex min-h-10 items-center justify-center gap-2 rounded-xl bg-slate-900 px-4 text-[11px] font-bold text-white hover:bg-slate-800 disabled:cursor-not-allowed disabled:opacity-50">Continue to publish <ChevronRight className="h-3.5 w-3.5" aria-hidden="true" /></button></div></div>
              </div>
            )}

            {setupStep === 3 && (
              <div className="space-y-5">
                <div className="rounded-2xl border border-blue-100 bg-blue-50 p-5"><div className="flex items-center gap-2 text-blue-800"><ShieldCheck className="h-5 w-5" aria-hidden="true" /><h3 className="text-sm font-bold">Ready to publish?</h3></div><p className="mt-2 text-[11px] leading-relaxed text-blue-700">Publishing makes this setup visible to commuters. Availability still starts as unavailable until you mark dates open in the timetable.</p></div>
                <div className="grid grid-cols-1 gap-2 sm:grid-cols-3"><div className="rounded-xl border border-slate-100 p-3 text-center"><ImagePlus className="mx-auto h-4 w-4 text-emerald-600" aria-hidden="true" /><p className="mt-1 text-[10px] font-bold text-slate-700">{setupPhotos.length} photo{setupPhotos.length === 1 ? '' : 's'}</p></div><div className="rounded-xl border border-slate-100 p-3 text-center"><FileText className="mx-auto h-4 w-4 text-blue-600" aria-hidden="true" /><p className="mt-1 text-[10px] font-bold text-slate-700">Description added</p></div><div className="rounded-xl border border-slate-100 p-3 text-center"><Car className="mx-auto h-4 w-4 text-violet-600" aria-hidden="true" /><p className="mt-1 text-[10px] font-bold text-slate-700">{rateText(activeSetup.dailyRate ?? (setupForm.dailyRate ? Number(setupForm.dailyRate) : null))} daily</p></div></div>
                <div className="flex flex-col-reverse gap-2 border-t border-slate-100 pt-4 sm:flex-row sm:justify-between"><button type="button" onClick={() => setSetupStep(2)} className="inline-flex min-h-10 items-center justify-center gap-2 rounded-xl border border-slate-200 px-4 text-[11px] font-bold text-slate-700 hover:bg-slate-50"><ChevronLeft className="h-3.5 w-3.5" aria-hidden="true" /> Back to review</button><div className="flex flex-col gap-2 sm:flex-row"><button type="button" onClick={() => persistSetup(false)} disabled={pendingPhotoCount > 0} className="inline-flex min-h-10 items-center justify-center gap-2 rounded-xl border border-slate-200 px-4 text-[11px] font-bold text-slate-700 hover:bg-slate-50 disabled:opacity-50"><Save className="h-3.5 w-3.5" aria-hidden="true" /> Save draft</button><button type="button" onClick={handlePublish} disabled={!setupIsComplete || pendingPhotoCount > 0} className="inline-flex min-h-10 items-center justify-center gap-2 rounded-xl bg-blue-600 px-4 text-[11px] font-bold text-white hover:bg-blue-700 disabled:cursor-not-allowed disabled:opacity-50"><Send className="h-3.5 w-3.5" aria-hidden="true" /> Publish parking setup</button></div></div>
              </div>
            )}
          </div>

          <aside className="space-y-4 rounded-2xl border border-slate-200 bg-slate-50 p-4 md:p-5">
            <div className="flex items-center gap-2"><Info className="h-4 w-4 text-blue-600" aria-hidden="true" /><h2 className="text-xs font-bold text-slate-800">Setup at a glance</h2></div>
            <div className="space-y-2 rounded-xl border border-white bg-white p-3"><div className="flex items-center justify-between gap-3 text-[11px]"><span className="text-slate-500">Spot</span><span className="truncate font-bold text-slate-800">{activeBay.bayNumber || activeBay.parkingLabel}</span></div><div className="flex items-center justify-between gap-3 text-[11px]"><span className="text-slate-500">Daily rate</span><span className="font-bold text-emerald-700">{rateText(activeSetup.dailyRate)}</span></div><div className="flex items-center justify-between gap-3 text-[11px]"><span className="text-slate-500">Monthly rate</span><span className="font-bold text-emerald-700">{rateText(activeSetup.monthlyRate)}</span></div><div className="flex items-center justify-between gap-3 text-[11px]"><span className="text-slate-500">Timetable today</span><span className={`rounded-full border px-2 py-0.5 text-[10px] font-bold ${statusMeta[statusFor(activeSpot, todayKey).status].badge}`}>{statusMeta[statusFor(activeSpot, todayKey).status].shortLabel}</span></div></div>
            <div className="rounded-xl border border-blue-100 bg-blue-50 p-3 text-[11px] leading-relaxed text-blue-700"><strong>Tip:</strong> Setup is infrequent. Use the Timetable tab for day-to-day opening and closing decisions.</div>
            <button type="button" onClick={() => setSection('timetable')} className="inline-flex min-h-10 w-full items-center justify-center gap-2 rounded-xl border border-slate-200 bg-white px-3 text-[11px] font-bold text-slate-700 hover:bg-slate-100"><CalendarDays className="h-3.5 w-3.5 text-blue-600" aria-hidden="true" /> Open timetable</button>
          </aside>
        </section>
      ) : (
        <section className="space-y-5">
          <div className="rounded-2xl border border-slate-200 bg-white p-4 shadow-sm md:p-5">
            <div className="flex flex-col gap-4 lg:flex-row lg:items-start lg:justify-between">
              <div><h2 className="text-base font-bold text-slate-900">Availability timetable</h2><p className="mt-1 text-[11px] leading-relaxed text-slate-500">Choose which days commuters can book. Future dates start as not available. A booked day is locked automatically.</p></div>
              <div className="flex flex-wrap gap-2" aria-label="Availability legend">
                {(Object.keys(statusMeta) as ParkingDayStatus[]).map((status) => { const meta = statusMeta[status]; const Icon = meta.icon; return <span key={status} className={`inline-flex items-center gap-1.5 rounded-full border px-2.5 py-1 text-[10px] font-semibold ${meta.badge}`}><Icon className="h-3 w-3" aria-hidden="true" />{meta.label}</span>; })}
              </div>
            </div>
          </div>

          <div className="grid grid-cols-1 gap-5 xl:grid-cols-[minmax(0,1.5fr)_minmax(290px,0.7fr)]">
            <div className="rounded-2xl border border-slate-200 bg-white p-3 shadow-sm md:p-5">
              <div className="flex flex-col gap-3 border-b border-slate-100 pb-4 sm:flex-row sm:items-center sm:justify-between"><div><h3 className="text-sm font-bold text-slate-900">{new Intl.DateTimeFormat('en-MY', { month: 'long', year: 'numeric' }).format(monthCursor)}</h3><p className="mt-0.5 text-[10px] text-slate-400">{monthStats.available} available · {monthStats.booked} booked</p></div><div className="flex items-center gap-1"><button type="button" onClick={() => setMonthCursor((current) => new Date(current.getFullYear(), current.getMonth() - 1, 1))} className="rounded-lg border border-slate-200 p-2 text-slate-600 hover:bg-slate-50" aria-label="Previous month"><ChevronLeft className="h-4 w-4" aria-hidden="true" /></button><button type="button" onClick={() => { const now = new Date(); setMonthCursor(new Date(now.getFullYear(), now.getMonth(), 1)); selectDate(todayKey); }} className="rounded-lg border border-slate-200 px-3 py-2 text-[10px] font-bold text-slate-600 hover:bg-slate-50">Today</button><button type="button" onClick={() => setMonthCursor((current) => new Date(current.getFullYear(), current.getMonth() + 1, 1))} className="rounded-lg border border-slate-200 p-2 text-slate-600 hover:bg-slate-50" aria-label="Next month"><ChevronRight className="h-4 w-4" aria-hidden="true" /></button></div></div>
              <div className="mt-4 grid grid-cols-7 gap-1 text-center">{['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'].map((day) => <span key={day} className="py-1 text-[9px] font-bold uppercase tracking-wider text-slate-400">{day}</span>)}{calendarDays.map((day) => { const key = localDateKey(day); const inMonth = day.getMonth() === monthCursor.getMonth() && day.getFullYear() === monthCursor.getFullYear(); const dayState = statusFor(activeSpot, key); const meta = statusMeta[dayState.status]; const Icon = meta.icon; const past = dateKeyIsPast(key); const selected = key === selectedDate; const locked = dayState.status === 'booked'; return <button key={key} type="button" onClick={() => { selectDate(key); if (!past && !locked) toggleDate(key); }} className={`relative flex min-h-[76px] flex-col items-start justify-between rounded-lg border p-1.5 text-left transition-colors sm:min-h-[88px] ${meta.cell} ${!inMonth ? 'opacity-45' : ''} ${past ? 'cursor-default opacity-55' : ''} ${selected ? 'ring-2 ring-blue-600 ring-offset-1' : ''}`} aria-label={`${formatLongDate(key)}: ${meta.label}${locked ? ', locked' : ''}`} title={`${formatLongDate(key)} · ${meta.label}${locked ? ' · booked dates cannot be changed' : past ? ' · past dates are read-only' : ' · click to toggle'}`}><span className="flex w-full items-center justify-between gap-1"><span className={`text-[11px] font-bold ${key === todayKey ? 'underline decoration-2 underline-offset-2' : ''}`}>{day.getDate()}</span>{locked && <Lock className="h-3 w-3 shrink-0" aria-hidden="true" />}</span><span className="flex items-center gap-1 text-[8px] font-semibold leading-tight"><Icon className="h-3 w-3 shrink-0" aria-hidden="true" /><span className="hidden sm:inline">{meta.shortLabel}</span></span></button>; })}</div>
              <p className="mt-3 flex items-center gap-1.5 text-[10px] text-slate-400"><Info className="h-3 w-3" aria-hidden="true" /> Click a future/today cell to toggle available and not available. Past and booked cells are read-only.</p>
            </div>

            <aside className="space-y-4 rounded-2xl border border-slate-200 bg-white p-4 shadow-sm md:p-5">
              <div><p className="text-[10px] font-bold uppercase tracking-wider text-slate-400">Selected day</p><h3 className="mt-1 text-sm font-bold text-slate-900">{formatLongDate(selectedDate)}</h3></div>
              <div className={`rounded-xl border p-3 ${selectedDayMeta.badge}`}><div className="flex items-center gap-2"><SelectedDayIcon className="h-4 w-4" aria-hidden="true" /><span className="text-xs font-bold">{selectedDayMeta.label}</span></div>{selectedDay.status === 'booked' && <p className="mt-2 text-[10px] leading-relaxed">This date is locked because one commuter already has the booking.</p>}{selectedDayIsPast && selectedDay.status !== 'booked' && <p className="mt-2 text-[10px] leading-relaxed">Past dates are read-only.</p>}{!selectedDayIsPast && selectedDay.status !== 'booked' && <button type="button" onClick={() => toggleDate(selectedDate)} className="mt-3 inline-flex min-h-9 w-full items-center justify-center gap-2 rounded-lg border border-current/20 bg-white/60 px-3 text-[10px] font-bold hover:bg-white">Toggle to {selectedDay.status === 'available' ? 'not available' : 'available'}</button>}</div>
              {selectedDay.status === 'booked' && <div className="space-y-2 rounded-xl border border-slate-100 bg-slate-50 p-3"><div className="flex items-center gap-2 text-[11px] font-bold text-slate-700"><Users className="h-3.5 w-3.5 text-blue-600" aria-hidden="true" /> Commuter booking</div><div className="flex items-center justify-between gap-2 text-[10px]"><span className="text-slate-500">Name</span><span className="text-right font-semibold text-slate-700">{selectedDay.booking?.commuterName || 'Booking details unavailable'}</span></div><div className="flex items-center justify-between gap-2 text-[10px]"><span className="text-slate-500">Vehicle</span><span className="inline-flex items-center gap-1 text-right font-semibold text-slate-700"><Car className="h-3 w-3" aria-hidden="true" />{selectedDay.booking?.vehicle || '—'}</span></div>{selectedDay.booking?.commuterPhone && <div className="flex items-center justify-between gap-2 text-[10px]"><span className="text-slate-500">Contact</span><span className="font-semibold text-slate-700">{selectedDay.booking.commuterPhone}</span></div>}</div>}
              <div className="rounded-xl border border-slate-100 p-3 text-[10px] leading-relaxed text-slate-500"><strong className="text-slate-700">One booking per day.</strong> Once a commuter books this spot, the day remains locked until the backend handles cancellation or reopening.</div>
            </aside>
          </div>

          <div className="rounded-2xl border border-slate-200 bg-white p-4 shadow-sm md:p-5">
            <div className="flex flex-col gap-2 sm:flex-row sm:items-start sm:justify-between"><div><div className="flex items-center gap-2"><CalendarRange className="h-4 w-4 text-blue-600" aria-hidden="true" /><h3 className="text-sm font-bold text-slate-900">Quick date range</h3></div><p className="mt-1 text-[11px] text-slate-500">Apply one status to an inclusive range. Booked and past days are skipped automatically.</p></div><button type="button" onClick={() => { setBulkStart(todayKey); setBulkEnd(todayKey); setBulkMessage(null); setBulkError(null); }} className="inline-flex min-h-8 items-center justify-center gap-1.5 rounded-lg border border-slate-200 px-2.5 text-[10px] font-bold text-slate-600 hover:bg-slate-50"><RotateCcw className="h-3 w-3" aria-hidden="true" /> Reset range</button></div>
            <div className="mt-4 grid grid-cols-1 gap-3 lg:grid-cols-[auto_minmax(0,1fr)_minmax(0,1fr)_auto] lg:items-end"><div><span className="mb-1.5 block text-[10px] font-bold uppercase tracking-wider text-slate-400">Presets</span><div className="flex gap-2"><button type="button" onClick={() => setPreset('week')} className="min-h-9 rounded-lg border border-slate-200 px-3 text-[10px] font-bold text-slate-700 hover:bg-slate-50">This week</button><button type="button" onClick={() => setPreset('month')} className="min-h-9 rounded-lg border border-slate-200 px-3 text-[10px] font-bold text-slate-700 hover:bg-slate-50">This month</button></div></div><label><span className="mb-1.5 block text-[10px] font-bold uppercase tracking-wider text-slate-400">From</span><input type="date" min={todayKey} value={bulkStart} onChange={(event) => setBulkStart(event.target.value)} className="min-h-9 w-full rounded-lg border border-slate-200 px-2.5 text-xs outline-none focus:border-blue-500 focus:ring-2 focus:ring-blue-100" /></label><label><span className="mb-1.5 block text-[10px] font-bold uppercase tracking-wider text-slate-400">To</span><input type="date" min={todayKey} value={bulkEnd} onChange={(event) => setBulkEnd(event.target.value)} className="min-h-9 w-full rounded-lg border border-slate-200 px-2.5 text-xs outline-none focus:border-blue-500 focus:ring-2 focus:ring-blue-100" /></label><div className="flex gap-2"><button type="button" onClick={() => bulkUpdate('available')} className="inline-flex min-h-9 flex-1 items-center justify-center gap-1.5 rounded-lg bg-emerald-600 px-3 text-[10px] font-bold text-white hover:bg-emerald-700"><Check className="h-3.5 w-3.5" aria-hidden="true" /> Mark available</button><button type="button" onClick={() => bulkUpdate('unavailable')} className="inline-flex min-h-9 flex-1 items-center justify-center gap-1.5 rounded-lg border border-slate-300 bg-slate-50 px-3 text-[10px] font-bold text-slate-700 hover:bg-slate-100"><Ban className="h-3.5 w-3.5" aria-hidden="true" /> Mark closed</button></div></div>
            {bulkError && <p role="alert" className="mt-3 flex items-center gap-1.5 text-[10px] font-semibold text-rose-600"><AlertCircle className="h-3.5 w-3.5" aria-hidden="true" />{bulkError}</p>}
            {bulkMessage && <p role="status" className="mt-3 flex items-center gap-1.5 text-[10px] font-semibold text-emerald-700"><CheckCircle2 className="h-3.5 w-3.5" aria-hidden="true" />{bulkMessage}</p>}
          </div>
        </section>
      )}
    </div>
  );
}
