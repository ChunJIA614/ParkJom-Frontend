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
  FileText,
  GripVertical,
  ImagePlus,
  Info,
  Lock,
  MapPin,
  Minus,
  Plus,
  RefreshCw,
  RotateCcw,
  Send,
  ShieldCheck,
  Trash2,
  UploadCloud,
  Users,
} from 'lucide-react';
import { AnimatePresence, motion, useReducedMotion } from 'motion/react';
import { useAuth } from '@/features/auth/context/AuthContext';
import {
  createParkingAvailabilityRules,
  deleteParkingImage,
  getOwnerAvailabilityCalendar,
  updateParkingConfiguration,
  updateParkingImage,
  updateParkingPublication,
  uploadParkingImages,
} from '../api/parkingApi';
import type {
  ParkingBay,
  ParkingAvailabilityCalendarHours,
  ParkingAvailabilityCalendarResponse,
  ParkingAvailabilityRulesResponse,
  ParkingConfigurationResponse,
  ParkingImagesResponse,
  ParkingSpotImage,
} from '../types';

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
  configuredHours?: ParkingAvailabilityCalendarHours[];
  booking?: OwnerParkingBooking;
  ownerOverride?: 'closed';
}

export interface OwnerParkingSetup {
  photos: string[];
  images: ParkingSpotImage[];
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

const MAX_PHOTOS = 6;
const MAX_BULK_DAYS = 366;
const SETUP_STEPS = ['Photos', 'Description', 'Pricing', 'Review', 'Publish'] as const;
type SetupStep = 1 | 2 | 3 | 4 | 5;

const statusMeta: Record<ParkingDayStatus, {
  label: string;
  shortLabel: string;
  icon: typeof CheckCircle2;
  cell: string;
  badge: string;
  dot: string;
}> = {
  available: {
    label: 'Available for booking',
    shortLabel: 'Open',
    icon: CheckCircle2,
    cell: 'text-emerald-700',
    badge: 'border-emerald-200 bg-emerald-50 text-emerald-700',
    dot: 'bg-emerald-500',
  },
  unavailable: {
    label: 'Not available for booking',
    shortLabel: 'Closed',
    icon: Ban,
    cell: 'text-slate-500',
    badge: 'border-slate-200 bg-slate-100 text-slate-600',
    dot: 'bg-slate-400',
  },
  booked: {
    label: 'Booked by commuter',
    shortLabel: 'Booked',
    icon: Lock,
    cell: 'text-blue-700',
    badge: 'border-blue-200 bg-blue-50 text-blue-700',
    dot: 'bg-blue-500',
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

function normaliseConfiguredHours(value: unknown): ParkingAvailabilityCalendarHours[] {
  if (!Array.isArray(value)) return [];
  return value.flatMap((item) => {
    if (!item || typeof item !== 'object') return [];
    const candidate = item as Record<string, unknown>;
    return typeof candidate.from === 'string' && typeof candidate.to === 'string'
      ? [{ from: candidate.from, to: candidate.to }]
      : [];
  });
}

function normaliseParkingImage(value: unknown): ParkingSpotImage | null {
  if (!value || typeof value !== 'object') return null;
  const candidate = value as Record<string, unknown>;
  const parkingSpotImageId = safeNumber(candidate.parkingSpotImageId);
  const mediaFileId = safeNumber(candidate.mediaFileId);
  const displayOrder = safeNumber(candidate.displayOrder);
  if (
    parkingSpotImageId === null
    || mediaFileId === null
    || displayOrder === null
    || typeof candidate.secureUrl !== 'string'
  ) return null;
  return {
    parkingSpotImageId,
    mediaFileId,
    secureUrl: candidate.secureUrl,
    originalFileName: typeof candidate.originalFileName === 'string' ? candidate.originalFileName : '',
    displayOrder,
    isPrimary: Boolean(candidate.isPrimary),
  };
}

function emptySetup(bay?: ParkingBay): OwnerParkingSetup {
  return {
    photos: [],
    images: [],
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
  const images = Array.isArray(candidate.images)
    ? candidate.images
      .map(normaliseParkingImage)
      .filter((image): image is ParkingSpotImage => image !== null)
      .sort((left, right) => left.displayOrder - right.displayOrder)
    : fallback.images;
  const apiDailyRate = bay ? safeNumber(bay.dailyRate) : null;
  const apiMonthlyRate = bay ? safeNumber(bay.monthlyRate) : null;
  return {
    photos,
    images,
    description: typeof candidate.description === 'string' ? candidate.description : fallback.description,
    accessInstructions: typeof candidate.accessInstructions === 'string'
      ? candidate.accessInstructions
      : fallback.accessInstructions,
    dailyRate: bay
      ? (apiDailyRate !== null && apiDailyRate > 0 ? apiDailyRate : null)
      : candidate.dailyRate === undefined ? fallback.dailyRate : safeNumber(candidate.dailyRate),
    monthlyRate: bay
      ? (apiMonthlyRate !== null && apiMonthlyRate > 0 ? apiMonthlyRate : null)
      : candidate.monthlyRate === undefined ? fallback.monthlyRate : safeNumber(candidate.monthlyRate),
    published: bay
      ? Boolean(bay.isPublished)
      : typeof candidate.published === 'boolean' ? candidate.published : fallback.published,
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
      configuredHours: normaliseConfiguredHours(day.configuredHours),
      booking: dayStatus === 'booked' ? normaliseBooking(day.booking) : undefined,
      ownerOverride: day.ownerOverride === 'closed' ? 'closed' : undefined,
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

function dateMatchesDayPattern(key: string, dayPattern: string): boolean {
  const day = dateFromKey(key).getDay();
  const normalized = dayPattern.trim().toLowerCase().replace(/\s+/g, '');
  if (normalized === 'weekdays' || normalized === 'weekday') return day >= 1 && day <= 5;
  if (normalized === 'weekends' || normalized === 'weekend') return day === 0 || day === 6;
  const dayNames = ['sunday', 'monday', 'tuesday', 'wednesday', 'thursday', 'friday', 'saturday'];
  if (normalized === dayNames[day] || normalized === `${dayNames[day]}s`) return true;
  if (dayNames.some((name) => normalized === name || normalized === `${name}s`)) return false;
  return true;
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

async function dataUrlToImageFile(dataUrl: string, index: number): Promise<File> {
  const response = await fetch(dataUrl);
  const blob = await response.blob();
  if (!blob.type.startsWith('image/')) throw new Error('Invalid image preview data.');
  const extension = blob.type === 'image/jpeg' ? 'jpg' : blob.type.split('/')[1] || 'jpg';
  return new File([blob], `parking-image-${index + 1}.${extension}`, { type: blob.type });
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
  const rates = [setup.dailyRate, setup.monthlyRate];
  const hasInvalidRate = rates.some((rate) => rate !== null && (!Number.isFinite(rate) || rate < 1));
  if (setup.photos.length === 0) issues.push('Add at least one parking photo.');
  if (!setup.description.trim()) issues.push('Add a short parking description.');
  if (hasInvalidRate) issues.push('Enter a valid positive rate.');
  if (!hasInvalidRate && (setup.dailyRate ?? 0) <= 0 && (setup.monthlyRate ?? 0) <= 0) issues.push('Set a daily or monthly rate.');
  return { complete: issues.length === 0, issues };
}

const calmMotion = {
  initial: { opacity: 0, y: 8 },
  animate: { opacity: 1, y: 0 },
  exit: { opacity: 0, y: -6 },
  transition: { type: 'spring' as const, stiffness: 420, damping: 38, mass: 0.8 },
};

export default function AvailabilityScheduler({
  bays,
  initialParkingSpotId,
  initialSection = 'setup',
  onScheduleChange,
}: AvailabilitySchedulerProps) {
  const { user } = useAuth();
  const todayKey = localDateKey();
  const [workspace, setWorkspace] = useState<OwnerParkingWorkspace>(() => getOwnerParkingWorkspace(bays));
  const [selectedBayId, setSelectedBayId] = useState<string>(() => {
    const preferred = initialParkingSpotId && bays.find((bay) => bay.parkingSpotId === initialParkingSpotId);
    return String(preferred?.parkingSpotId ?? bays[0]?.parkingSpotId ?? '');
  });
  const [section, setSection] = useState<'setup' | 'timetable'>(initialSection);
  const [monthCursor, setMonthCursor] = useState(() => {
    const now = dateFromKey(todayKey);
    return new Date(now.getFullYear(), now.getMonth(), 1);
  });
  const [selectedDate, setSelectedDate] = useState(todayKey);
  const [setupStep, setSetupStep] = useState<SetupStep>(1);
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
  const [setupSaving, setSetupSaving] = useState(false);
  const [imagesUploading, setImagesUploading] = useState(false);
  const [imageUpdatingId, setImageUpdatingId] = useState<number | null>(null);
  const [imageDeletingId, setImageDeletingId] = useState<number | null>(null);
  const [publishing, setPublishing] = useState(false);
  const [selectedPhotoIndex, setSelectedPhotoIndex] = useState<number | null>(null);
  const [draggedPhotoIndex, setDraggedPhotoIndex] = useState<number | null>(null);
  const [bulkStart, setBulkStart] = useState(todayKey);
  const [bulkEnd, setBulkEnd] = useState(todayKey);
  const [bulkFromTime, setBulkFromTime] = useState('09:00');
  const [bulkToTime, setBulkToTime] = useState('19:00');
  const [bulkDayPattern, setBulkDayPattern] = useState('Weekdays');
  const [bulkStatus, setBulkStatus] = useState<'available' | 'unavailable'>('available');
  const [bulkMessage, setBulkMessage] = useState<string | null>(null);
  const [bulkError, setBulkError] = useState<string | null>(null);
  const [availabilitySaving, setAvailabilitySaving] = useState(false);
  const [calendarLoading, setCalendarLoading] = useState(false);
  const [calendarError, setCalendarError] = useState<string | null>(null);
  const [calendarTimeZone, setCalendarTimeZone] = useState('Asia/Kuala_Lumpur');
  const [daySaving, setDaySaving] = useState(false);
  const [dayMessage, setDayMessage] = useState<string | null>(null);
  const [dayError, setDayError] = useState<string | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const objectUrlsRef = useRef<Set<string>>(new Set());
  const pendingImageFilesRef = useRef<Map<string, File>>(new Map());
  const calendarRequestRef = useRef(0);
  const prefersReducedMotion = useReducedMotion();

  const activeBay = bays.find((bay) => String(bay.parkingSpotId) === selectedBayId) ?? bays[0];
  const activeSpotId = activeBay ? String(activeBay.parkingSpotId) : '';
  const activeSpot = activeSpotId ? workspace.spots[activeSpotId] : undefined;
  const activeSetup = setupFromSpot(activeSpot, activeBay);
  const displayedMonth = `${monthCursor.getFullYear()}-${String(monthCursor.getMonth() + 1).padStart(2, '0')}`;
  const setupBusy = setupSaving
    || imagesUploading
    || imageUpdatingId !== null
    || imageDeletingId !== null
    || publishing
    || availabilitySaving
    || daySaving;

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
    setSelectedPhotoIndex(null);
    setDraggedPhotoIndex(null);
    setSelectedDate(todayKey);
    setBulkStart(todayKey);
    setBulkEnd(todayKey);
    setBulkFromTime('09:00');
    setBulkToTime('19:00');
    setBulkDayPattern('Weekdays');
    setBulkMessage(null);
    setBulkError(null);
    setCalendarError(null);
    setDaySaving(false);
    setDayMessage(null);
    setDayError(null);
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

  const fetchAvailabilityCalendar = useCallback(async (month = displayedMonth) => {
    const parkingSpotId = activeBay?.parkingSpotId;
    const token = user?.token ?? '';
    if (!parkingSpotId || !activeSpotId) return;
    if (!token) {
      setCalendarLoading(false);
      setCalendarError('Your owner session is missing an authorization token.');
      return;
    }

    const requestId = calendarRequestRef.current + 1;
    calendarRequestRef.current = requestId;
    setCalendarLoading(true);
    setCalendarError(null);
    try {
      const response = await getOwnerAvailabilityCalendar(token, parkingSpotId, month);
      const body = await response.json().catch(() => null) as ParkingAvailabilityCalendarResponse | null;
      if (!response.ok || !body?.success || !Array.isArray(body.days)) {
        throw new Error(body?.message || `Unable to retrieve the availability calendar (${response.status}).`);
      }

      setWorkspace((current) => {
        const spot = current.spots[activeSpotId] ?? normaliseSpot(undefined, activeBay);
        const days = { ...spot.days };
        const closedOverrides = Object.fromEntries(Object.entries(days).filter(([date, day]) => (
          date.startsWith(`${body.month}-`) && day.ownerOverride === 'closed'
        )));
        Object.keys(days).forEach((date) => {
          if (date.startsWith(`${body.month}-`)) delete days[date];
        });
        body.days.forEach((day) => {
          if (!/^\d{4}-\d{2}-\d{2}$/.test(day.date) || !day.date.startsWith(`${body.month}-`)) return;
          const status = normaliseStatus(day.status);
          days[day.date] = {
            status,
            configuredHours: normaliseConfiguredHours(day.configuredHours),
          };
        });
        Object.entries(closedOverrides).forEach(([date, override]) => {
          if (days[date]?.status === 'booked') return;
          days[date] = {
            ...override,
            ...days[date],
            status: 'unavailable',
            configuredHours: days[date]?.configuredHours?.length
              ? days[date].configuredHours
              : override.configuredHours,
            ownerOverride: 'closed',
          };
        });
        return {
          ...current,
          spots: { ...current.spots, [activeSpotId]: { ...spot, days } },
        };
      });

      if (calendarRequestRef.current === requestId) {
        setCalendarTimeZone(body.timeZone || 'Asia/Kuala_Lumpur');
      }
    } catch (error) {
      if (calendarRequestRef.current === requestId) {
        setCalendarError(error instanceof Error ? error.message : 'Unable to retrieve the availability calendar.');
      }
    } finally {
      if (calendarRequestRef.current === requestId) setCalendarLoading(false);
    }
  }, [activeBay, activeSpotId, displayedMonth, user?.token]);

  useEffect(() => {
    if (section === 'timetable') void fetchAvailabilityCalendar();
  }, [fetchAvailabilityCalendar, section]);

  const replaceSetupForm = (field: keyof typeof setupForm, value: string | string[]) => {
    setSetupForm((current) => ({ ...current, [field]: value }));
    setSetupMessage(null);
    setSetupError(null);
  };

  const replaceRate = (field: 'dailyRate' | 'monthlyRate', value: string) => {
    if (!/^\d*(?:\.\d{0,2})?$/.test(value)) return;
    replaceSetupForm(field, value);
  };

  const adjustRate = (field: 'dailyRate' | 'monthlyRate', amount: number) => {
    const currentValue = Number(setupForm[field]);
    const baseValue = Number.isFinite(currentValue) && currentValue >= 1 ? currentValue : 0;
    const nextValue = Math.max(1, Number((baseValue + amount).toFixed(2)));
    replaceSetupForm(field, String(nextValue));
  };

  const addPhotoFiles = async (files: File[]) => {
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
      dataUrls.forEach((dataUrl, index) => pendingImageFilesRef.current.set(dataUrl, selected[index]));
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

  const handlePhotoChange = (event: React.ChangeEvent<HTMLInputElement>) => {
    const files = Array.from(event.target.files ?? []);
    event.target.value = '';
    void addPhotoFiles(files);
  };

  const handlePhotoFileDrop = (event: React.DragEvent<HTMLButtonElement>) => {
    event.preventDefault();
    if (setupBusy) return;
    void addPhotoFiles(Array.from(event.dataTransfer.files ?? []));
  };

  const removePhoto = (index: number) => {
    if (!activeSpotId) return;
    const preview = photoPreviews[activeSpotId]?.[index];
    const storedPhoto = setupForm.photos[index];
    if (storedPhoto) pendingImageFilesRef.current.delete(storedPhoto);
    if (preview && objectUrlsRef.current.has(preview)) {
      URL.revokeObjectURL(preview);
      objectUrlsRef.current.delete(preview);
    }
    setPhotoPreviews((current) => ({
      ...current,
      [activeSpotId]: (current[activeSpotId] ?? []).filter((_, itemIndex) => itemIndex !== index),
    }));
    setSetupForm((current) => ({ ...current, photos: current.photos.filter((_, itemIndex) => itemIndex !== index) }));
    setSelectedPhotoIndex(null);
  };

  const swapPhotos = async (fromIndex: number, toIndex: number) => {
    if (!activeSpotId || fromIndex === toIndex || setupBusy) return;
    const photos = photoPreviews[activeSpotId] ?? setupForm.photos;
    const sourceUrl = photos[fromIndex];
    const targetUrl = photos[toIndex];
    if (!sourceUrl || !targetUrl) return;

    const sourceImage = activeSetup.images.find((image) => image.secureUrl === sourceUrl);
    const targetImage = activeSetup.images.find((image) => image.secureUrl === targetUrl);
    if (sourceImage && targetImage) {
      if (sourceImage.isPrimary) {
        await editImageOrder(targetImage, sourceImage.displayOrder, true);
        await editImageOrder(sourceImage, targetImage.displayOrder, false);
      } else {
        await editImageOrder(sourceImage, targetImage.displayOrder, targetImage.isPrimary);
        await editImageOrder(targetImage, sourceImage.displayOrder, false);
      }
      return;
    }

    const reordered = [...photos];
    [reordered[fromIndex], reordered[toIndex]] = [reordered[toIndex], reordered[fromIndex]];
    setPhotoPreviews((current) => ({ ...current, [activeSpotId]: reordered }));
    setSetupForm((current) => ({ ...current, photos: reordered }));
    setSetupMessage('Photo order updated.');
    setSetupError(null);
  };

  const handlePhotoTap = (index: number) => {
    if (selectedPhotoIndex === null) {
      setSelectedPhotoIndex(index);
      return;
    }
    if (selectedPhotoIndex === index) {
      setSelectedPhotoIndex(null);
      return;
    }
    void swapPhotos(selectedPhotoIndex, index);
    setSelectedPhotoIndex(null);
  };

  const persistSetup = (
    publish: boolean,
    updatedAt = new Date().toISOString(),
    successMessage = publish ? 'Parking listing published. Choose open dates in Availability.' : 'Draft saved.',
  ): boolean => {
    if (!activeSpotId) return false;
    if (pendingPhotoCount > 0) {
      setSetupError('Please wait for the photo previews to finish loading.');
      return false;
    }
    const daily = setupForm.dailyRate.trim() === '' ? null : Number(setupForm.dailyRate);
    const monthly = setupForm.monthlyRate.trim() === '' ? null : Number(setupForm.monthlyRate);
    if ((daily !== null && (!Number.isFinite(daily) || daily < 1)) || (monthly !== null && (!Number.isFinite(monthly) || monthly < 1))) {
      setSetupError('Each entered rate must be at least RM 1.');
      return false;
    }
    const nextSetup: OwnerParkingSetup = {
      // Keep both data URLs created by this prototype and any future API
      // URLs/paths.  The component deliberately does not assume a backend
      // image URL shape yet.
      photos: setupForm.photos.filter((photo) => photo.trim().length > 0).slice(0, MAX_PHOTOS),
      images: activeSetup.images.filter((image) => setupForm.photos.includes(image.secureUrl)),
      description: setupForm.description.trim(),
      accessInstructions: setupForm.accessInstructions.trim(),
      dailyRate: daily !== null && daily > 0 ? daily : null,
      monthlyRate: monthly !== null && monthly > 0 ? monthly : null,
      published: publish ? true : activeSetup.published,
      updatedAt,
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
    setSetupMessage(successMessage);
    setSetupError(null);
    return true;
  };

  const saveConfiguration = async (): Promise<boolean> => {
    if (!activeBay) return false;
    if (pendingPhotoCount > 0) {
      setSetupError('Please wait for the photo previews to finish loading.');
      return false;
    }

    const dailyRateText = setupForm.dailyRate.trim();
    const monthlyRateText = setupForm.monthlyRate.trim();
    const dailyRate = dailyRateText === '' ? 0 : Number(dailyRateText);
    const monthlyRate = monthlyRateText === '' ? 0 : Number(monthlyRateText);
    if ((dailyRateText !== '' && (!Number.isFinite(dailyRate) || dailyRate < 1)) || (monthlyRateText !== '' && (!Number.isFinite(monthlyRate) || monthlyRate < 1))) {
      setSetupError('Each entered rate must be at least RM 1.');
      return false;
    }

    const token = user?.token ?? '';
    if (!token) {
      setSetupError('Your owner session is missing an authorization token.');
      return false;
    }

    setSetupSaving(true);
    setSetupMessage(null);
    setSetupError(null);
    try {
      const response = await updateParkingConfiguration(token, activeBay.parkingSpotId, {
        description: setupForm.description.trim(),
        dailyRate,
        monthlyRate,
      });
      const body = await response.json().catch(() => null) as ParkingConfigurationResponse | null;
      if (!response.ok || !body?.success) {
        throw new Error(body?.message || `Unable to save parking configuration (${response.status}).`);
      }

      return persistSetup(false, body.updatedAt, body.message);
    } catch (error) {
      setSetupError(error instanceof Error ? error.message : 'Unable to save parking configuration.');
      return false;
    } finally {
      setSetupSaving(false);
    }
  };

  const applyServerImages = (images: ParkingSpotImage[], message: string) => {
    const orderedImages = images
      .map(normaliseParkingImage)
      .filter((image): image is ParkingSpotImage => image !== null)
      .sort((left, right) => left.displayOrder - right.displayOrder)
      .slice(0, MAX_PHOTOS);
    const secureUrls = orderedImages.map((image) => image.secureUrl);

    updateWorkspace((current) => {
      const spot = current.spots[activeSpotId] ?? normaliseSpot(undefined, activeBay);
      return {
        ...current,
        spots: {
          ...current.spots,
          [activeSpotId]: {
            ...spot,
            setup: { ...spot.setup, photos: secureUrls, images: orderedImages },
          },
        },
      };
    });
    setSetupForm((current) => ({ ...current, photos: secureUrls }));
    setPhotoPreviews((current) => ({ ...current, [activeSpotId]: secureUrls }));
    setSetupMessage(message);
  };

  const uploadImages = async (): Promise<boolean> => {
    if (!activeBay) return false;
    const localImages = setupForm.photos.filter((photo) => photo.startsWith('data:image/'));
    if (localImages.length === 0) return true;

    const token = user?.token ?? '';
    if (!token) {
      setSetupError('Your owner session is missing an authorization token.');
      return false;
    }

    setImagesUploading(true);
    setSetupMessage(null);
    setSetupError(null);
    try {
      const imageFiles = await Promise.all(localImages.map((dataUrl, index) => (
        pendingImageFilesRef.current.get(dataUrl) ?? dataUrlToImageFile(dataUrl, index)
      )));
      const response = await uploadParkingImages(token, activeBay.parkingSpotId, imageFiles);
      const body = await response.json().catch(() => null) as ParkingImagesResponse | null;
      if (!response.ok || !body?.success || !Array.isArray(body.data)) {
        throw new Error(body?.message || `Unable to upload parking images (${response.status}).`);
      }

      localImages.forEach((dataUrl) => pendingImageFilesRef.current.delete(dataUrl));
      applyServerImages(body.data, body.message);
      return true;
    } catch (error) {
      setSetupError(error instanceof Error ? error.message : 'Unable to upload parking images.');
      return false;
    } finally {
      setImagesUploading(false);
    }
  };

  const editImageOrder = async (
    image: ParkingSpotImage,
    displayOrder: number,
    isPrimary: boolean,
  ) => {
    if (!activeBay) return;
    const token = user?.token ?? '';
    if (!token) {
      setSetupError('Your owner session is missing an authorization token.');
      return;
    }

    const nextOrder = Math.min(Math.max(1, displayOrder), activeSetup.images.length);
    if (nextOrder === image.displayOrder && isPrimary === image.isPrimary) return;

    setImageUpdatingId(image.parkingSpotImageId);
    setSetupMessage(null);
    setSetupError(null);
    try {
      const response = await updateParkingImage(
        token,
        activeBay.parkingSpotId,
        image.parkingSpotImageId,
        { displayOrder: nextOrder, isPrimary },
      );
      const body = await response.json().catch(() => null) as ParkingImagesResponse | null;
      if (!response.ok || !body?.success || !Array.isArray(body.data)) {
        throw new Error(body?.message || `Unable to update the parking image (${response.status}).`);
      }

      applyServerImages(body.data, body.message);
    } catch (error) {
      setSetupError(error instanceof Error ? error.message : 'Unable to update the parking image.');
    } finally {
      setImageUpdatingId(null);
    }
  };

  const deleteImage = async (image: ParkingSpotImage) => {
    if (!activeBay) return;
    const confirmed = window.confirm(
      `Delete ${image.originalFileName || 'this listing image'}? This cannot be undone.`,
    );
    if (!confirmed) return;

    const token = user?.token ?? '';
    if (!token) {
      setSetupError('Your owner session is missing an authorization token.');
      return;
    }

    setImageDeletingId(image.parkingSpotImageId);
    setSetupMessage(null);
    setSetupError(null);
    try {
      const response = await deleteParkingImage(
        token,
        activeBay.parkingSpotId,
        image.parkingSpotImageId,
        { displayOrder: 1, isPrimary: true },
      );
      const body = await response.json().catch(() => null) as ParkingImagesResponse | null;
      if (!response.ok || !body?.success || !Array.isArray(body.data)) {
        throw new Error(body?.message || `Unable to delete the parking image (${response.status}).`);
      }

      applyServerImages(body.data, body.message);
    } catch (error) {
      setSetupError(error instanceof Error ? error.message : 'Unable to delete the parking image.');
    } finally {
      setImageDeletingId(null);
    }
  };

  const currentSetupCandidate = (): OwnerParkingSetup => ({
    photos: setupForm.photos,
    images: activeSetup.images,
    description: setupForm.description,
    accessInstructions: setupForm.accessInstructions,
    dailyRate: setupForm.dailyRate.trim() === '' ? null : Number(setupForm.dailyRate),
    monthlyRate: setupForm.monthlyRate.trim() === '' ? null : Number(setupForm.monthlyRate),
    published: activeSetup.published,
  });

  const continueFromPhotos = async () => {
    if (setupForm.photos.length === 0) {
      setSetupError('Add at least one clear parking photo to continue.');
      return;
    }
    if (await uploadImages()) {
      setSetupError(null);
      setSetupStep(2);
    }
  };

  const continueFromDescription = () => {
    if (!setupForm.description.trim()) {
      setSetupError('Add a short parking description to continue.');
      return;
    }
    setSetupError(null);
    setSetupStep(3);
  };

  const continueFromPricing = async () => {
    const candidate = currentSetupCandidate();
    const rates = [candidate.dailyRate, candidate.monthlyRate];
    if (rates.some((rate) => rate !== null && (!Number.isFinite(rate) || rate < 1))) {
      setSetupError('Each entered rate must be at least RM 1.');
      return;
    }
    if ((candidate.dailyRate ?? 0) <= 0 && (candidate.monthlyRate ?? 0) <= 0) {
      setSetupError('Set a daily or monthly rate to continue.');
      return;
    }
    if (await saveConfiguration()) {
      setSetupError(null);
      setSetupStep(4);
    }
  };

  const continueToPublish = () => {
    const completion = setupCompletion(currentSetupCandidate());
    if (!completion.complete) {
      setSetupError(completion.issues.join(' '));
      return;
    }
    setSetupError(null);
    setSetupStep(5);
  };

  const handlePublish = async () => {
    if (!activeBay) return;
    const completion = setupCompletion(currentSetupCandidate());
    if (!completion.complete) {
      setSetupError(completion.issues.join(' '));
      return;
    }
    const token = user?.token ?? '';
    if (!token) {
      setSetupError('Your owner session is missing an authorization token.');
      return;
    }

    setPublishing(true);
    setSetupMessage(null);
    setSetupError(null);
    try {
      const response = await updateParkingPublication(token, activeBay.parkingSpotId, true);
      const body = await response.json().catch(() => null) as {
        success?: boolean;
        message?: string;
        isPublished?: boolean;
      } | null;
      if (!response.ok || body?.success !== true || body.isPublished === false) {
        throw new Error(body?.message || `Unable to publish the parking listing (${response.status}).`);
      }
      persistSetup(true, new Date().toISOString(), body.message || 'Parking listing published. Choose open dates in Availability.');
    } catch (error) {
      setSetupError(error instanceof Error ? error.message : 'Unable to publish the parking listing.');
    } finally {
      setPublishing(false);
    }
  };

  const selectDate = (date: string) => {
    setSelectedDate(date);
    setDayMessage(null);
    setDayError(null);
  };

  const changeMonth = (offset: number) => {
    const nextMonth = new Date(monthCursor.getFullYear(), monthCursor.getMonth() + offset, 1);
    const selectedDay = dateFromKey(selectedDate).getDate();
    const daysInNextMonth = new Date(nextMonth.getFullYear(), nextMonth.getMonth() + 1, 0).getDate();
    setMonthCursor(nextMonth);
    setSelectedDate(localDateKey(new Date(
      nextMonth.getFullYear(),
      nextMonth.getMonth(),
      Math.min(selectedDay, daysInNextMonth),
    )));
    setDayMessage(null);
    setDayError(null);
  };

  const goToCurrentMonth = () => {
    const currentMonth = dateFromKey(todayKey);
    setMonthCursor(new Date(currentMonth.getFullYear(), currentMonth.getMonth(), 1));
    setSelectedDate(todayKey);
    setDayMessage(null);
    setDayError(null);
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

  const bulkUpdate = async (nextStatus: 'available' | 'unavailable') => {
    if (!activeSpotId || !activeBay) return;
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

    if (nextStatus === 'available') {
      if (!/^([01]\d|2[0-3]):[0-5]\d$/.test(bulkFromTime) || !/^([01]\d|2[0-3]):[0-5]\d$/.test(bulkToTime)) {
        setBulkError('Choose valid opening and closing times.');
        setBulkMessage(null);
        return;
      }
      if (bulkFromTime >= bulkToTime) {
        setBulkError('The closing time must be later than the opening time.');
        setBulkMessage(null);
        return;
      }
      if (!bulkDayPattern.trim()) {
        setBulkError('Enter a day pattern such as Weekdays.');
        setBulkMessage(null);
        return;
      }
    }

    const currentSpot = workspace.spots[activeSpotId] ?? normaliseSpot(undefined, activeBay);
    const matchingDates = nextStatus === 'available'
      ? keys.filter((date) => dateMatchesDayPattern(date, bulkDayPattern))
      : keys;
    const editableDates = matchingDates.filter((date) => {
      const currentDay = statusFor(currentSpot, date);
      return !dateKeyIsPast(date) && currentDay.status !== 'booked';
    });
    const skipped = keys.length - editableDates.length;
    const changed = editableDates.reduce((count, date) => (
      statusFor(currentSpot, date).status === nextStatus ? count : count + 1
    ), 0);

    let backendMessage = '';
    if (nextStatus === 'available') {
      const token = user?.token ?? '';
      if (!token) {
        setBulkError('Your owner session is missing an authorization token.');
        setBulkMessage(null);
        return;
      }

      setAvailabilitySaving(true);
      setBulkError(null);
      setBulkMessage(null);
      try {
        const response = await createParkingAvailabilityRules(token, activeBay.parkingSpotId, {
          rules: [{
            fromDate: bulkStart,
            toDate: bulkEnd,
            fromTime: bulkFromTime,
            toTime: bulkToTime,
            dayPattern: bulkDayPattern.trim(),
          }],
        });
        const body = await response.json().catch(() => null) as ParkingAvailabilityRulesResponse | null;
        if (!response.ok || !body?.success || !Array.isArray(body.data)) {
          throw new Error(body?.message || `Unable to create availability rules (${response.status}).`);
        }
        backendMessage = `${body.message}${body.timeZone ? ` Time zone: ${body.timeZone}.` : ''}`;
      } catch (error) {
        setBulkError(error instanceof Error ? error.message : 'Unable to create availability rules.');
        return;
      } finally {
        setAvailabilitySaving(false);
      }
    }

    updateWorkspace((current) => {
      const spot = current.spots[activeSpotId] ?? normaliseSpot(undefined, activeBay);
      const days = { ...spot.days };
      editableDates.forEach((date) => {
        days[date] = nextStatus === 'unavailable'
          ? { ...days[date], status: 'unavailable', ownerOverride: 'closed' }
          : { status: 'available' };
      });
      return { ...current, spots: { ...current.spots, [activeSpotId]: { ...spot, days } } };
    });
    setBulkError(null);
    const localMessage = `${changed} day${changed === 1 ? '' : 's'} marked ${statusMeta[nextStatus].shortLabel.toLowerCase()}.${skipped ? ` ${skipped} day${skipped === 1 ? '' : 's'} outside the pattern, booked, or past.` : ''}`;
    setBulkMessage(backendMessage ? `${backendMessage} ${localMessage}` : localMessage);
    if (nextStatus === 'available') await fetchAvailabilityCalendar();
  };

  const applySelectedDayStatus = async (nextStatus: 'available' | 'unavailable') => {
    if (!activeSpotId || !activeBay || dateKeyIsPast(selectedDate)) {
      setDayError('Past dates are read-only.');
      setDayMessage(null);
      return;
    }
    const currentDay = statusFor(workspace.spots[activeSpotId], selectedDate);
    if (currentDay.status === 'booked') {
      setDayError('Booked dates are locked until the booking is released by the backend.');
      setDayMessage(null);
      return;
    }
    if (currentDay.status === nextStatus) {
      setDayMessage(`${formatShortDate(selectedDate)} is already ${statusMeta[nextStatus].shortLabel.toLowerCase()}.`);
      setDayError(null);
      return;
    }

    setDaySaving(true);
    setDayMessage(null);
    setDayError(null);
    try {
      if (nextStatus === 'available' && currentDay.ownerOverride !== 'closed') {
        const token = user?.token ?? '';
        if (!token) throw new Error('Your owner session is missing an authorization token.');
        const weekday = new Intl.DateTimeFormat('en-MY', { weekday: 'long' }).format(dateFromKey(selectedDate));
        const response = await createParkingAvailabilityRules(token, activeBay.parkingSpotId, {
          rules: [{
            fromDate: selectedDate,
            toDate: selectedDate,
            fromTime: currentDay.configuredHours?.[0]?.from ?? bulkFromTime,
            toTime: currentDay.configuredHours?.[0]?.to ?? bulkToTime,
            dayPattern: weekday,
          }],
        });
        const body = await response.json().catch(() => null) as ParkingAvailabilityRulesResponse | null;
        if (!response.ok || !body?.success || !Array.isArray(body.data)) {
          throw new Error(body?.message || `Unable to open this date (${response.status}).`);
        }
      }

      updateWorkspace((current) => {
        const spot = current.spots[activeSpotId] ?? normaliseSpot(undefined, activeBay);
        const existingDay = statusFor(spot, selectedDate);
        const updatedDay: OwnerParkingDay = nextStatus === 'unavailable'
          ? { ...existingDay, status: 'unavailable', ownerOverride: 'closed' }
          : { ...existingDay, status: 'available', ownerOverride: undefined };
        return {
          ...current,
          spots: {
            ...current.spots,
            [activeSpotId]: { ...spot, days: { ...spot.days, [selectedDate]: updatedDay } },
          },
        };
      });
      setDayMessage(`${formatShortDate(selectedDate)} is now ${statusMeta[nextStatus].shortLabel.toLowerCase()}.`);
      if (nextStatus === 'available') await fetchAvailabilityCalendar();
    } catch (error) {
      setDayError(error instanceof Error ? error.message : `Unable to mark this date ${statusMeta[nextStatus].shortLabel.toLowerCase()}.`);
    } finally {
      setDaySaving(false);
    }
  };

  const calendarDays = useMemo(() => {
    const first = new Date(monthCursor.getFullYear(), monthCursor.getMonth(), 1);
    const numberOfDays = new Date(monthCursor.getFullYear(), monthCursor.getMonth() + 1, 0).getDate();
    return Array.from({ length: numberOfDays }, (_, index) => addDays(first, index));
  }, [monthCursor]);

  const calendarStartOffset = monthCursor.getDay();

  const selectedDay = statusFor(activeSpot, selectedDate);
  const selectedDayMeta = statusMeta[selectedDay.status];
  const SelectedDayIcon = selectedDayMeta.icon;
  const selectedDayIsPast = dateKeyIsPast(selectedDate);
  const monthStats = useMemo(() => {
    let available = 0;
    let unavailable = 0;
    let booked = 0;
    calendarDays.forEach((day) => {
      const status = statusFor(activeSpot, localDateKey(day)).status;
      if (status === 'available') available += 1;
      if (status === 'unavailable') unavailable += 1;
      if (status === 'booked') booked += 1;
    });
    return { available, unavailable, booked };
  }, [activeSpot, calendarDays]);

  const bulkPreview = useMemo(() => {
    const keys = inclusiveDateKeys(bulkStart, bulkEnd);
    if (!keys.length || keys.length > MAX_BULK_DAYS || !activeSpot) {
      return { total: keys.length, editable: 0, changed: 0, skipped: keys.length };
    }
    const matchingKeys = bulkStatus === 'available'
      ? keys.filter((date) => dateMatchesDayPattern(date, bulkDayPattern))
      : keys;
    const editable = matchingKeys.filter((date) => {
      const day = statusFor(activeSpot, date);
      return !dateKeyIsPast(date) && day.status !== 'booked';
    });
    return {
      total: keys.length,
      editable: editable.length,
      changed: editable.filter((date) => statusFor(activeSpot, date).status !== bulkStatus).length,
      skipped: keys.length - editable.length,
    };
  }, [activeSpot, bulkDayPattern, bulkEnd, bulkStart, bulkStatus]);

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
    images: activeSetup.images,
    description: setupForm.description,
    accessInstructions: setupForm.accessInstructions,
    dailyRate: setupForm.dailyRate.trim() === '' ? null : Number(setupForm.dailyRate),
    monthlyRate: setupForm.monthlyRate.trim() === '' ? null : Number(setupForm.monthlyRate),
    published: activeSetup.published,
  };
  const setupIsComplete = setupCompletion(setupCandidate).complete;

  return (
    <div className="space-y-3 sm:space-y-5 md:space-y-6">
      <div className="rounded-2xl border border-white/80 bg-white/90 p-2 shadow-[0_12px_36px_-28px_rgba(15,23,42,0.38)] md:p-3">
        <div className="flex flex-col gap-1.5 sm:gap-2.5 lg:flex-row lg:items-center lg:justify-between">
          <div className="flex min-w-0 items-center gap-2 px-1 sm:gap-3 sm:px-2 sm:py-1">
            <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-[10px] bg-blue-600 text-white shadow-sm sm:h-10 sm:w-10 sm:rounded-xl"><CalendarDays className="h-4 w-4 sm:h-5 sm:w-5" aria-hidden="true" /></div>
             <div className="min-w-0"><p className="hidden text-xs font-semibold text-blue-600 sm:block">Owner workspace</p><h1 className="truncate text-base font-extrabold tracking-tight text-slate-950 sm:text-lg">Configure parking</h1><p className="hidden truncate text-xs text-slate-500 md:block">Set up your listing, then choose when commuters can book it.</p></div>
          </div>
          <div className="flex flex-col gap-1.5 sm:flex-row sm:items-center sm:gap-2">
            <label className="flex h-10 min-w-0 items-center gap-2 rounded-xl border border-slate-200/90 bg-white/75 px-3 sm:h-11 sm:min-w-[260px]">
              <MapPin className="h-4 w-4 shrink-0 text-blue-600" aria-hidden="true" />
              <span className="sr-only">Parking spot</span>
              <select value={selectedBayId} onChange={(event) => setSelectedBayId(event.target.value)} disabled={pendingPhotoCount > 0 || setupBusy} style={{ minHeight: 0 }} className="h-auto min-w-0 flex-1 bg-transparent text-xs font-bold text-slate-800 outline-none disabled:opacity-60">
                {bays.map((bay) => <option key={bay.id || bay.parkingSpotId} value={String(bay.parkingSpotId)}>{bayLabel(bay)}</option>)}
              </select>
            </label>
            <div role="tablist" aria-label="Configure parking sections" className="grid h-10 grid-cols-2 gap-1 rounded-xl bg-slate-200/65 p-1 sm:h-11 sm:min-w-[250px]">
              <button id="parking-setup-tab" type="button" role="tab" aria-selected={section === 'setup'} aria-controls="parking-setup-panel" onClick={() => setSection('setup')} style={{ minHeight: 0 }} className={`h-8 rounded-lg px-3 text-xs font-bold transition-colors active:scale-[0.98] sm:h-9 ${section === 'setup' ? 'bg-white text-blue-700 shadow-sm' : 'text-slate-500 hover:text-slate-800'}`}><span className="inline-flex items-center gap-1.5"><FileText className="h-3.5 w-3.5" aria-hidden="true" /> Setup</span></button>
              <button id="parking-timetable-tab" type="button" role="tab" aria-selected={section === 'timetable'} aria-controls="parking-timetable-panel" onClick={() => setSection('timetable')} style={{ minHeight: 0 }} className={`h-8 rounded-lg px-3 text-xs font-bold transition-colors active:scale-[0.98] sm:h-9 ${section === 'timetable' ? 'bg-white text-blue-700 shadow-sm' : 'text-slate-500 hover:text-slate-800'}`}><span className="inline-flex items-center gap-1.5"><CalendarRange className="h-3.5 w-3.5" aria-hidden="true" /> Timetable</span></button>
            </div>
          </div>
        </div>
      </div>

      <AnimatePresence mode="wait" initial={false}>
      {section === 'setup' ? (
        <motion.section id="parking-setup-panel" role="tabpanel" aria-labelledby="parking-setup-tab" key="setup" initial={prefersReducedMotion ? false : calmMotion.initial} animate={calmMotion.animate} exit={prefersReducedMotion ? undefined : calmMotion.exit} transition={prefersReducedMotion ? { duration: 0.15 } : calmMotion.transition}>
          <div className="space-y-3 rounded-2xl border border-slate-200/90 bg-white/90 p-3 shadow-[0_14px_45px_-32px_rgba(15,23,42,0.5)] sm:space-y-5 sm:p-4 md:p-6">
            <div className="hidden flex-col gap-2 sm:flex sm:flex-row sm:items-center sm:justify-between">
              <div>
                <h2 className="text-base font-bold text-slate-900">Parking setup</h2>
                <p className="mt-0.5 text-[11px] text-slate-500">Set the information commuters see before they choose a date.</p>
              </div>
              <span className={`inline-flex w-fit items-center gap-1.5 rounded-full border px-2.5 py-1 text-[10px] font-bold ${activeSetup.published ? 'border-emerald-200 bg-emerald-50 text-emerald-700' : 'border-amber-200 bg-amber-50 text-amber-700'}`}>
                {activeSetup.published ? <CheckCircle2 className="h-3 w-3" aria-hidden="true" /> : <Info className="h-3 w-3" aria-hidden="true" />}
                {activeSetup.published ? 'Published' : 'Draft'}
              </span>
            </div>

            <div className="rounded-2xl bg-slate-50 p-2.5 sm:p-3.5" aria-label="Setup progress">
              <div className="flex items-end justify-between gap-3">
                <div>
                  <p className="text-[11px] font-semibold text-blue-600">Step {setupStep} of {SETUP_STEPS.length}</p>
                  <p className="mt-0.5 text-sm font-bold text-slate-900">{SETUP_STEPS[setupStep - 1]}</p>
                </div>
                <span className="text-[11px] font-semibold tabular-nums text-slate-500">{Math.round((setupStep / SETUP_STEPS.length) * 100)}%</span>
              </div>
              <div
                role="progressbar"
                aria-valuemin={1}
                aria-valuemax={SETUP_STEPS.length}
                aria-valuenow={setupStep}
                aria-valuetext={`${SETUP_STEPS[setupStep - 1]}, step ${setupStep} of ${SETUP_STEPS.length}`}
                className="mt-3 h-1.5 overflow-hidden rounded-full bg-slate-200"
              >
                <span className="block h-full rounded-full bg-blue-600 transition-[width] duration-300" style={{ width: `${(setupStep / SETUP_STEPS.length) * 100}%` }} />
              </div>
              <ol className="mt-2 grid grid-cols-5 gap-1" aria-hidden="true">
                {SETUP_STEPS.map((label, index) => (
                  <li key={label} className={`truncate text-center text-[9px] font-semibold ${setupStep === index + 1 ? 'text-blue-600' : setupStep > index + 1 ? 'text-slate-600' : 'text-slate-400'}`}>{label}</li>
                ))}
              </ol>
            </div>

            {setupMessage && <div role="status" className="flex items-center gap-2 rounded-xl border border-emerald-200 bg-emerald-50 px-3 py-2.5 text-[11px] font-medium text-emerald-700"><CheckCircle2 className="h-4 w-4 shrink-0" aria-hidden="true" />{setupMessage}</div>}
            {setupError && <div role="alert" className="flex items-start gap-2 rounded-xl border border-rose-200 bg-rose-50 px-3 py-2.5 text-[11px] font-medium text-rose-700"><AlertCircle className="mt-0.5 h-4 w-4 shrink-0" aria-hidden="true" />{setupError}</div>}

            {setupStep === 1 && (
              <motion.div key="photos-step" initial={prefersReducedMotion ? false : { opacity: 0, y: 6 }} animate={{ opacity: 1, y: 0 }} transition={prefersReducedMotion ? { duration: 0 } : calmMotion.transition} className="space-y-3 sm:space-y-5">
                <div>
                  <h3 className="text-lg font-bold tracking-tight text-slate-950 sm:text-xl">Show commuters the exact spot</h3>
                  <p className="mt-0.5 text-xs leading-relaxed text-slate-500 sm:mt-1 sm:text-sm">Add at least one clear photo. The first photo becomes the cover.</p>
                </div>
                <input ref={fileInputRef} type="file" accept=".jpg,.jpeg,.png,.webp,image/jpeg,image/png,image/webp" multiple onChange={handlePhotoChange} className="hidden" />
                <button
                  type="button"
                  onClick={() => fileInputRef.current?.click()}
                  onDragOver={(event) => event.preventDefault()}
                  onDrop={handlePhotoFileDrop}
                  disabled={pendingPhotoCount > 0 || setupPhotos.length >= MAX_PHOTOS || setupBusy}
                  className="flex min-h-24 w-full flex-col items-center justify-center gap-1.5 rounded-2xl border border-dashed border-blue-300 bg-blue-50/50 px-4 text-center transition-colors hover:border-blue-500 hover:bg-blue-50 disabled:cursor-not-allowed disabled:opacity-60 sm:min-h-36 sm:gap-2 sm:px-5"
                >
                  <span className="grid h-11 w-11 place-items-center rounded-full bg-white text-blue-600 shadow-sm"><UploadCloud className="h-5 w-5" aria-hidden="true" /></span>
                  <span className="text-sm font-semibold text-slate-900">Tap to add photos</span>
                  <span className="text-[11px] text-slate-500">or drop JPG, PNG, WEBP here · {setupPhotos.length}/{MAX_PHOTOS}</span>
                </button>
                {setupPhotos.length > 0 && (
                  <div>
                    <div className="mb-2 flex items-center gap-1.5 text-[11px] text-slate-500"><GripVertical className="h-3.5 w-3.5" aria-hidden="true" />Drag to reorder, or tap one photo then another to swap.</div>
                    <div className="grid grid-cols-3 gap-2 sm:gap-3">
                      {setupPhotos.map((photo, index) => {
                        const uploadedImage = activeSetup.images.find((image) => image.secureUrl === photo);
                        const selected = selectedPhotoIndex === index;
                        return (
                          <div
                            key={uploadedImage?.parkingSpotImageId ?? `${photo.slice(0, 24)}-${index}`}
                            role="button"
                            tabIndex={0}
                            draggable={!setupBusy}
                            aria-pressed={selected}
                            aria-label={`Parking photo ${index + 1}. ${selected ? 'Selected. Choose another photo to move it.' : 'Select to reorder.'}`}
                            onClick={() => handlePhotoTap(index)}
                            onKeyDown={(event) => { if (event.key === 'Enter' || event.key === ' ') { event.preventDefault(); handlePhotoTap(index); } }}
                            onDragStart={(event) => { setDraggedPhotoIndex(index); event.dataTransfer.effectAllowed = 'move'; event.dataTransfer.setData('text/plain', String(index)); }}
                            onDragEnd={() => setDraggedPhotoIndex(null)}
                            onDragOver={(event) => { event.preventDefault(); event.dataTransfer.dropEffect = 'move'; }}
                            onDrop={(event) => { event.preventDefault(); const from = draggedPhotoIndex ?? Number(event.dataTransfer.getData('text/plain')); if (Number.isInteger(from)) void swapPhotos(from, index); setDraggedPhotoIndex(null); setSelectedPhotoIndex(null); }}
                            className={`group relative aspect-[4/3] cursor-grab overflow-hidden rounded-2xl bg-slate-100 shadow-sm outline-none transition ${selected ? 'ring-4 ring-blue-500/25 ring-offset-2' : 'ring-1 ring-black/5'} ${draggedPhotoIndex === index ? 'opacity-50' : ''}`}
                          >
                            <img src={photo} alt="" className="h-full w-full object-cover" draggable={false} />
                            <span className={`absolute left-2 top-2 rounded-full px-2 py-1 text-[10px] font-bold shadow-sm ${index === 0 ? 'bg-white text-slate-900' : 'bg-slate-950/70 text-white'}`}>{index === 0 ? 'Cover' : index + 1}</span>
                            <span className="absolute bottom-2 left-2 grid h-8 w-8 place-items-center rounded-full bg-slate-950/65 text-white backdrop-blur"><GripVertical className="h-4 w-4" aria-hidden="true" /></span>
                            <button type="button" onClick={(event) => { event.stopPropagation(); if (uploadedImage) void deleteImage(uploadedImage); else removePhoto(index); }} disabled={setupBusy} className="absolute right-2 top-2 grid h-9 w-9 place-items-center rounded-full bg-slate-950/70 text-white backdrop-blur hover:bg-rose-600 disabled:opacity-50" aria-label={`Remove parking photo ${index + 1}`}><Trash2 className="h-4 w-4" aria-hidden="true" /></button>
                            {imageUpdatingId === uploadedImage?.parkingSpotImageId && <span className="absolute inset-0 grid place-items-center bg-slate-950/55 text-[11px] font-bold text-white">Reordering…</span>}
                            {imageDeletingId === uploadedImage?.parkingSpotImageId && <span className="absolute inset-0 grid place-items-center bg-rose-950/65 text-[11px] font-bold text-white">Removing…</span>}
                          </div>
                        );
                      })}
                    </div>
                  </div>
                )}
                {pendingPhotoCount > 0 && <p className="text-[11px] font-medium text-blue-600">Preparing photo preview…</p>}
                <div className="border-t border-slate-100 pt-3 sm:pt-5">
                  <button type="button" onClick={() => void continueFromPhotos()} disabled={pendingPhotoCount > 0 || setupBusy} className="inline-flex min-h-12 w-full items-center justify-center gap-2 rounded-2xl bg-blue-600 px-5 text-sm font-semibold text-white shadow-sm hover:bg-blue-700 disabled:cursor-not-allowed disabled:opacity-50">{imagesUploading ? 'Uploading photos…' : 'Continue'} <ChevronRight className="h-4 w-4" aria-hidden="true" /></button>
                </div>
              </motion.div>
            )}

            {setupStep === 2 && (
              <motion.div key="description-step" initial={prefersReducedMotion ? false : { opacity: 0, y: 6 }} animate={{ opacity: 1, y: 0 }} transition={prefersReducedMotion ? { duration: 0 } : calmMotion.transition} className="space-y-3 sm:space-y-5">
                <div>
                  <h3 className="text-lg font-bold tracking-tight text-slate-950 sm:text-xl">Describe the parking spot</h3>
                  <p className="mt-0.5 text-xs leading-relaxed text-slate-500 sm:mt-1 sm:text-sm">Help commuters recognise the bay and find it without calling you.</p>
                </div>
                <label className="block">
                  <span className="mb-2 block text-xs font-semibold text-slate-800">Description</span>
                  <textarea value={setupForm.description} onChange={(event) => replaceSetupForm('description', event.target.value)} rows={6} maxLength={500} placeholder="Covered bay on Level B2, beside the lift lobby. Enter through the visitor lane." className="w-full resize-none rounded-2xl border border-slate-200 bg-slate-50/70 px-4 py-3 text-sm leading-relaxed text-slate-900 outline-none placeholder:text-slate-400 focus:border-blue-500 focus:bg-white focus:ring-4 focus:ring-blue-100 sm:py-3.5" />
                  <span className="mt-1.5 block text-right text-[11px] tabular-nums text-slate-400">{setupForm.description.length}/500</span>
                </label>
                <div className="flex gap-2 border-t border-slate-100 pt-3 sm:pt-5">
                  <button type="button" onClick={() => setSetupStep(1)} className="inline-flex min-h-12 flex-1 items-center justify-center gap-2 rounded-2xl border border-slate-200 bg-white px-4 text-sm font-semibold text-slate-700 hover:bg-slate-50"><ChevronLeft className="h-4 w-4" aria-hidden="true" /> Back</button>
                  <button type="button" onClick={continueFromDescription} className="inline-flex min-h-12 flex-[1.6] items-center justify-center gap-2 rounded-2xl bg-blue-600 px-4 text-sm font-semibold text-white hover:bg-blue-700">Continue <ChevronRight className="h-4 w-4" aria-hidden="true" /></button>
                </div>
              </motion.div>
            )}

            {setupStep === 3 && (
              <motion.div key="pricing-step" initial={prefersReducedMotion ? false : { opacity: 0, y: 6 }} animate={{ opacity: 1, y: 0 }} transition={prefersReducedMotion ? { duration: 0 } : calmMotion.transition} className="space-y-3 sm:space-y-5">
                <div>
                  <h3 className="text-lg font-bold tracking-tight text-slate-950 sm:text-xl">Set your rates</h3>
                  <p className="mt-0.5 text-xs leading-relaxed text-slate-500 sm:mt-1 sm:text-sm">Add one or both prices. Leave a rate empty if you do not offer it.</p>
                </div>
                <div className="grid gap-3 md:grid-cols-2">
                  <div className="rounded-2xl border border-slate-200 bg-white p-3 shadow-sm sm:p-4">
                    <div className="flex items-center justify-between gap-3">
                      <label htmlFor="owner-daily-rate" className="text-xs font-semibold text-slate-700">Daily rate</label>
                      <span className="rounded-md bg-slate-100 px-2 py-1 text-[9px] font-semibold text-slate-500">Optional</span>
                    </div>
                    <div className="mt-3 flex min-h-14 items-center rounded-xl border border-slate-200 bg-slate-50 p-1.5 focus-within:border-blue-400 focus-within:bg-white focus-within:ring-2 focus-within:ring-blue-100">
                      <span className="inline-flex h-10 shrink-0 items-center rounded-lg bg-blue-50 px-3 text-sm font-bold text-blue-700">RM</span>
                      <input id="owner-daily-rate" type="text" inputMode="decimal" value={setupForm.dailyRate} onChange={(event) => replaceRate('dailyRate', event.target.value)} placeholder="0" aria-describedby="owner-daily-rate-unit" className="min-w-0 flex-1 border-0 bg-transparent px-3 text-2xl font-bold text-slate-950 outline-none placeholder:text-slate-300" />
                      <div className="flex shrink-0 gap-1">
                        <button type="button" onClick={() => adjustRate('dailyRate', -1)} disabled={!setupForm.dailyRate || Number(setupForm.dailyRate) <= 1 || setupBusy} className="inline-flex h-10 w-10 items-center justify-center rounded-lg border border-slate-200 bg-white text-slate-600 hover:border-blue-200 hover:text-blue-700 disabled:cursor-not-allowed disabled:opacity-35" aria-label="Decrease daily rate by RM 1" title="Decrease by RM 1"><Minus className="h-4 w-4" aria-hidden="true" /></button>
                        <button type="button" onClick={() => adjustRate('dailyRate', 1)} disabled={setupBusy} className="inline-flex h-10 w-10 items-center justify-center rounded-lg bg-blue-600 text-white hover:bg-blue-700 disabled:cursor-not-allowed disabled:opacity-50" aria-label="Increase daily rate by RM 1" title="Increase by RM 1"><Plus className="h-4 w-4" aria-hidden="true" /></button>
                      </div>
                    </div>
                    <p id="owner-daily-rate-unit" className="mt-2 text-[10px] text-slate-500">Charged per booking day. Minimum RM 1.</p>
                  </div>

                  <div className="rounded-2xl border border-slate-200 bg-white p-3 shadow-sm sm:p-4">
                    <div className="flex items-center justify-between gap-3">
                      <label htmlFor="owner-monthly-rate" className="text-xs font-semibold text-slate-700">Monthly rate</label>
                      <span className="rounded-md bg-slate-100 px-2 py-1 text-[9px] font-semibold text-slate-500">Optional</span>
                    </div>
                    <div className="mt-3 flex min-h-14 items-center rounded-xl border border-slate-200 bg-slate-50 p-1.5 focus-within:border-blue-400 focus-within:bg-white focus-within:ring-2 focus-within:ring-blue-100">
                      <span className="inline-flex h-10 shrink-0 items-center rounded-lg bg-blue-50 px-3 text-sm font-bold text-blue-700">RM</span>
                      <input id="owner-monthly-rate" type="text" inputMode="decimal" value={setupForm.monthlyRate} onChange={(event) => replaceRate('monthlyRate', event.target.value)} placeholder="0" aria-describedby="owner-monthly-rate-unit" className="min-w-0 flex-1 border-0 bg-transparent px-3 text-2xl font-bold text-slate-950 outline-none placeholder:text-slate-300" />
                      <div className="flex shrink-0 gap-1">
                        <button type="button" onClick={() => adjustRate('monthlyRate', -1)} disabled={!setupForm.monthlyRate || Number(setupForm.monthlyRate) <= 1 || setupBusy} className="inline-flex h-10 w-10 items-center justify-center rounded-lg border border-slate-200 bg-white text-slate-600 hover:border-blue-200 hover:text-blue-700 disabled:cursor-not-allowed disabled:opacity-35" aria-label="Decrease monthly rate by RM 1" title="Decrease by RM 1"><Minus className="h-4 w-4" aria-hidden="true" /></button>
                        <button type="button" onClick={() => adjustRate('monthlyRate', 1)} disabled={setupBusy} className="inline-flex h-10 w-10 items-center justify-center rounded-lg bg-blue-600 text-white hover:bg-blue-700 disabled:cursor-not-allowed disabled:opacity-50" aria-label="Increase monthly rate by RM 1" title="Increase by RM 1"><Plus className="h-4 w-4" aria-hidden="true" /></button>
                      </div>
                    </div>
                    <p id="owner-monthly-rate-unit" className="mt-2 text-[10px] text-slate-500">Charged for a monthly booking. Minimum RM 1.</p>
                  </div>
                </div>
                <div className="flex gap-2 border-t border-slate-100 pt-3 sm:pt-5">
                  <button type="button" onClick={() => setSetupStep(2)} disabled={setupBusy} className="inline-flex min-h-12 flex-1 items-center justify-center gap-2 rounded-2xl border border-slate-200 bg-white px-4 text-sm font-semibold text-slate-700 hover:bg-slate-50 disabled:opacity-50"><ChevronLeft className="h-4 w-4" aria-hidden="true" /> Back</button>
                  <button type="button" onClick={() => void continueFromPricing()} disabled={setupBusy} className="inline-flex min-h-12 flex-[1.6] items-center justify-center gap-2 rounded-2xl bg-blue-600 px-4 text-sm font-semibold text-white hover:bg-blue-700 disabled:cursor-not-allowed disabled:opacity-50">{setupSaving ? 'Saving…' : 'Save & review'} <ChevronRight className="h-4 w-4" aria-hidden="true" /></button>
                </div>
              </motion.div>
            )}

            {setupStep === 4 && (
              <motion.div key="review-step" initial={prefersReducedMotion ? false : { opacity: 0, y: 6 }} animate={{ opacity: 1, y: 0 }} transition={prefersReducedMotion ? { duration: 0 } : calmMotion.transition} className="space-y-3 sm:space-y-5">
                <div>
                  <h3 className="text-lg font-bold tracking-tight text-slate-950 sm:text-xl">Review your listing</h3>
                  <p className="mt-0.5 text-xs leading-relaxed text-slate-500 sm:mt-1 sm:text-sm">This is what commuters will see before booking.</p>
                </div>
                <div className="overflow-hidden rounded-3xl border border-black/5 bg-white shadow-[0_16px_45px_-30px_rgba(15,23,42,0.45)]">
                  {setupPhotos[0] && <img src={setupPhotos[0]} alt="Parking listing cover" className="aspect-[16/7] w-full object-cover sm:aspect-[16/10]" />}
                  <div className="space-y-3 p-4 sm:space-y-4 sm:p-5">
                    <div className="flex items-start justify-between gap-4"><div><p className="text-[11px] font-semibold text-blue-600">{activeBay.propertyName || `Property #${activeBay.propertyId}`}</p><h4 className="mt-1 text-lg font-bold text-slate-950">{activeBay.bayNumber || activeBay.parkingLabel}</h4></div><span className="shrink-0 rounded-full bg-slate-100 px-2.5 py-1 text-[10px] font-semibold text-slate-600">{setupPhotos.length} photo{setupPhotos.length === 1 ? '' : 's'}</span></div>
                    <p className="whitespace-pre-wrap text-sm leading-relaxed text-slate-600">{setupForm.description}</p>
                    <div className="grid grid-cols-2 gap-2 border-t border-slate-100 pt-4">
                      <div><p className="text-[10px] font-semibold uppercase tracking-wide text-slate-400">Daily</p><p className="mt-1 text-base font-bold text-slate-900">{setupForm.dailyRate ? `RM ${Number(setupForm.dailyRate).toFixed(2)}` : 'Not offered'}</p></div>
                      <div><p className="text-[10px] font-semibold uppercase tracking-wide text-slate-400">Monthly</p><p className="mt-1 text-base font-bold text-slate-900">{setupForm.monthlyRate ? `RM ${Number(setupForm.monthlyRate).toFixed(2)}` : 'Not offered'}</p></div>
                    </div>
                  </div>
                </div>
                <div className="flex gap-2 border-t border-slate-100 pt-3 sm:pt-5">
                  <button type="button" onClick={() => setSetupStep(3)} className="inline-flex min-h-12 flex-1 items-center justify-center gap-2 rounded-2xl border border-slate-200 bg-white px-4 text-sm font-semibold text-slate-700 hover:bg-slate-50"><ChevronLeft className="h-4 w-4" aria-hidden="true" /> Edit</button>
                  <button type="button" onClick={continueToPublish} disabled={!setupIsComplete || setupBusy} className="inline-flex min-h-12 flex-[1.6] items-center justify-center gap-2 rounded-2xl bg-blue-600 px-4 text-sm font-semibold text-white hover:bg-blue-700 disabled:cursor-not-allowed disabled:opacity-50">Continue <ChevronRight className="h-4 w-4" aria-hidden="true" /></button>
                </div>
              </motion.div>
            )}

            {setupStep === 5 && (
              <motion.div key="publish-step" initial={prefersReducedMotion ? false : { opacity: 0, y: 6 }} animate={{ opacity: 1, y: 0 }} transition={prefersReducedMotion ? { duration: 0 } : calmMotion.transition} className="space-y-3 text-center sm:space-y-5">
                <div className={`mx-auto grid h-16 w-16 place-items-center rounded-full ${activeSetup.published ? 'bg-emerald-100 text-emerald-600' : 'bg-blue-100 text-blue-600'}`}>{activeSetup.published ? <CheckCircle2 className="h-8 w-8" aria-hidden="true" /> : <ShieldCheck className="h-8 w-8" aria-hidden="true" />}</div>
                <div><h3 className="text-2xl font-bold tracking-tight text-slate-950">{activeSetup.published ? 'Your parking is live' : 'Ready to publish'}</h3><p className="mx-auto mt-2 max-w-md text-sm leading-relaxed text-slate-500">{activeSetup.published ? 'Commuters can now see this listing. Open bookable dates in the availability timetable.' : 'Publishing makes this listing visible. Dates remain closed until you open them in the timetable.'}</p></div>
                <div className="mx-auto grid max-w-md grid-cols-3 gap-2"><div className="rounded-2xl bg-slate-50 p-3"><ImagePlus className="mx-auto h-4 w-4 text-blue-600" aria-hidden="true" /><p className="mt-1 text-[10px] font-semibold text-slate-600">{setupPhotos.length} photos</p></div><div className="rounded-2xl bg-slate-50 p-3"><FileText className="mx-auto h-4 w-4 text-blue-600" aria-hidden="true" /><p className="mt-1 text-[10px] font-semibold text-slate-600">Details ready</p></div><div className="rounded-2xl bg-slate-50 p-3"><Car className="mx-auto h-4 w-4 text-blue-600" aria-hidden="true" /><p className="mt-1 text-[10px] font-semibold text-slate-600">Rates set</p></div></div>
                <div className="flex gap-2 border-t border-slate-100 pt-3 sm:pt-5">
                  {!activeSetup.published && <button type="button" onClick={() => setSetupStep(4)} disabled={setupBusy} className="inline-flex min-h-12 flex-1 items-center justify-center gap-2 rounded-2xl border border-slate-200 bg-white px-4 text-sm font-semibold text-slate-700 hover:bg-slate-50 disabled:opacity-50"><ChevronLeft className="h-4 w-4" aria-hidden="true" /> Back</button>}
                  {activeSetup.published ? <button type="button" onClick={() => setSection('timetable')} className="inline-flex min-h-12 flex-1 items-center justify-center gap-2 rounded-2xl bg-blue-600 px-5 text-sm font-semibold text-white hover:bg-blue-700"><CalendarRange className="h-4 w-4" aria-hidden="true" /> Set availability</button> : <button type="button" onClick={() => void handlePublish()} disabled={!setupIsComplete || setupBusy} className="inline-flex min-h-12 flex-[1.6] items-center justify-center gap-2 rounded-2xl bg-blue-600 px-5 text-sm font-semibold text-white shadow-sm hover:bg-blue-700 disabled:cursor-not-allowed disabled:opacity-50"><Send className="h-4 w-4" aria-hidden="true" /> {publishing ? 'Publishing…' : 'Publish listing'}</button>}
                </div>
              </motion.div>
            )}
          </div>

        </motion.section>
      ) : (
        <motion.section id="parking-timetable-panel" role="tabpanel" aria-labelledby="parking-timetable-tab" key="timetable" initial={prefersReducedMotion ? false : calmMotion.initial} animate={calmMotion.animate} exit={prefersReducedMotion ? undefined : calmMotion.exit} transition={prefersReducedMotion ? { duration: 0.15 } : calmMotion.transition} className="space-y-5">
       <div className="rounded-2xl border border-slate-200/90 bg-white p-4 shadow-[0_14px_45px_-32px_rgba(15,23,42,0.5)] md:p-5">
            <div className="flex flex-col gap-4 lg:flex-row lg:items-start lg:justify-between">
              <div><h2 className="text-base font-bold text-slate-900">Availability timetable</h2><p className="mt-1 text-xs leading-relaxed text-slate-500">Select a day to inspect it, then explicitly open or close it. Future dates start closed; booked dates stay locked.</p></div>
              <div className="flex flex-wrap gap-2" aria-label="Availability legend">
                {(Object.keys(statusMeta) as ParkingDayStatus[]).map((status) => { const meta = statusMeta[status]; const Icon = meta.icon; return <span key={status} className={`inline-flex min-h-9 items-center gap-1.5 rounded-full border px-3 py-1.5 text-xs font-semibold ${meta.badge}`}><Icon className="h-3.5 w-3.5" aria-hidden="true" />{status === 'available' ? 'Open' : status === 'unavailable' ? 'Closed' : 'Booked'}</span>; })}
              </div>
            </div>
            <div className="mt-4 flex flex-col gap-3 rounded-xl border border-slate-100 bg-slate-50/75 p-3 sm:flex-row sm:items-center sm:justify-between">
              <div className="min-w-0 text-[11px]" aria-live="polite">
                {calendarLoading ? (
                  <span className="inline-flex items-center gap-2 font-semibold text-blue-700"><RefreshCw className="h-3.5 w-3.5 animate-spin" aria-hidden="true" />Loading {displayedMonth} availability…</span>
                ) : calendarError ? (
                  <span role="alert" className="inline-flex items-center gap-2 font-semibold text-rose-600"><AlertCircle className="h-3.5 w-3.5" aria-hidden="true" />{calendarError}</span>
                ) : (
                  <span className="text-slate-500">Time zone: {calendarTimeZone}</span>
                )}
              </div>
              <button type="button" onClick={() => void fetchAvailabilityCalendar()} disabled={calendarLoading} className="inline-flex min-h-10 shrink-0 items-center justify-center gap-2 rounded-xl border border-slate-200 bg-white px-3 text-[10px] font-bold text-slate-700 hover:bg-slate-100 disabled:cursor-wait disabled:opacity-60"><RefreshCw className={`h-3.5 w-3.5 ${calendarLoading ? 'animate-spin' : ''}`} aria-hidden="true" /> Refresh</button>
            </div>
          </div>

          <div className="grid grid-cols-1 gap-5 lg:grid-cols-[minmax(0,1.5fr)_minmax(300px,0.75fr)]">
             <div className="rounded-2xl border border-slate-200/90 bg-white p-3 shadow-[0_14px_45px_-32px_rgba(15,23,42,0.5)] md:p-5">
              <div className="flex flex-col gap-3 border-b border-slate-100 pb-4 sm:flex-row sm:items-start sm:justify-between">
                <div className="min-w-0">
                  <div className="flex items-center gap-1.5">
                    <button type="button" onClick={() => changeMonth(-1)} className="inline-flex h-8 w-8 shrink-0 items-center justify-center rounded-lg border border-slate-200 bg-white text-slate-600 transition-colors hover:border-blue-200 hover:bg-blue-50 hover:text-blue-700 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-blue-500" aria-label="View previous month" title="View previous month">
                      <ChevronLeft className="h-4 w-4" aria-hidden="true" />
                    </button>
                    <h3 className="min-w-36 text-center text-sm font-bold text-slate-900" aria-live="polite">{new Intl.DateTimeFormat('en-MY', { month: 'long', year: 'numeric' }).format(monthCursor)}</h3>
                    <button type="button" onClick={() => changeMonth(1)} className="inline-flex h-8 w-8 shrink-0 items-center justify-center rounded-lg border border-slate-200 bg-white text-slate-600 transition-colors hover:border-blue-200 hover:bg-blue-50 hover:text-blue-700 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-blue-500" aria-label="View next month" title="View next month">
                      <ChevronRight className="h-4 w-4" aria-hidden="true" />
                    </button>
                  </div>
                  <div className="mt-2 flex flex-wrap gap-1.5"><span className="rounded-full border border-emerald-200 bg-emerald-50 px-2 py-0.5 text-[10px] font-bold text-emerald-700">{monthStats.available} open</span><span className="rounded-full border border-slate-200 bg-slate-100 px-2 py-0.5 text-[10px] font-bold text-slate-600">{monthStats.unavailable} closed</span><span className="rounded-full border border-blue-200 bg-blue-50 px-2 py-0.5 text-[10px] font-bold text-blue-700">{monthStats.booked} booked</span></div>
                </div>
                <button type="button" onClick={goToCurrentMonth} className="inline-flex min-h-8 shrink-0 items-center justify-center rounded-lg border border-blue-200 bg-blue-50 px-3 text-[10px] font-bold text-blue-700 transition-colors hover:bg-blue-100 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-blue-500">Today</button>
              </div>
              <div className="mt-4 grid grid-cols-7 gap-0 text-center">{['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'].map((day) => <span key={day} className="border-b border-slate-200 py-2 text-xs font-semibold uppercase tracking-wide text-slate-400">{day}</span>)}{Array.from({ length: calendarStartOffset }, (_, index) => <span key={`calendar-offset-${index}`} aria-hidden="true" />)}{calendarDays.map((day) => { const key = localDateKey(day); const dayState = statusFor(activeSpot, key); const meta = statusMeta[dayState.status]; const past = dateKeyIsPast(key); const selected = key === selectedDate; const locked = dayState.status === 'booked'; return <button key={key} type="button" onClick={() => selectDate(key)} disabled={past} aria-selected={selected} aria-disabled={past || undefined} aria-current={key === todayKey ? 'date' : undefined} className={`group relative flex min-h-14 flex-col items-center justify-start gap-1.5 border-0 bg-transparent px-1 py-2 text-center transition-colors duration-150 hover:bg-slate-50/70 active:bg-slate-100/80 disabled:hover:bg-transparent focus-visible:z-10 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-inset focus-visible:ring-blue-500 sm:min-h-[86px] ${past ? 'cursor-default' : ''}`} aria-label={`${formatLongDate(key)}: ${meta.label}${locked ? ', locked' : ''}${past ? ', read-only' : ''}`} title={`${formatLongDate(key)} · ${meta.label}${locked ? ' · booked dates cannot be changed' : past ? ' · past dates are read-only' : ' · select to inspect'}`}><span className={`grid h-7 w-7 shrink-0 place-items-center rounded-full text-sm font-semibold transition-colors ${selected ? 'bg-[#007AFF] text-white' : key === todayKey ? 'ring-1 ring-inset ring-[#007AFF] text-[#007AFF]' : 'text-slate-800'} ${past && !selected && key !== todayKey ? 'text-slate-300' : ''}`}>{day.getDate()}</span><span className={`mt-auto flex min-h-4 max-w-full items-center justify-center gap-1 text-[9px] font-semibold leading-none ${meta.cell} ${past ? 'opacity-55' : ''}`}><span className={`h-1.5 w-1.5 shrink-0 rounded-full ${meta.dot}`} aria-hidden="true" /><span className="truncate">{meta.shortLabel}</span>{locked && <Lock className="hidden h-2.5 w-2.5 shrink-0 sm:block" aria-hidden="true" />}</span></button>; })}</div>
              <p className="mt-3 flex items-center gap-1.5 text-xs text-slate-400"><Info className="h-3.5 w-3.5" aria-hidden="true" /> Select a date to inspect it. Use the inspector action to open or close it.</p>
            </div>

             <aside className="space-y-4 rounded-2xl border border-slate-200/90 bg-white p-4 shadow-[0_14px_45px_-32px_rgba(15,23,42,0.5)] md:sticky md:top-28 md:self-start md:p-5">
              <div><p className="text-[10px] font-bold uppercase tracking-wider text-slate-400">Selected day</p><h3 className="mt-1 text-sm font-bold text-slate-900">{formatLongDate(selectedDate)}</h3></div>
              <div className={`rounded-2xl border p-4 ${selectedDayMeta.badge}`} aria-live="polite"><div className="flex items-center gap-2"><SelectedDayIcon className="h-4 w-4" aria-hidden="true" /><span className="text-xs font-bold">{selectedDay.status === 'booked' ? 'Booked · locked' : selectedDayMeta.label}</span>{daySaving && <RefreshCw className="ml-auto h-3.5 w-3.5 animate-spin" aria-label="Saving day status" />}</div>{selectedDay.status === 'booked' && <p className="mt-2 text-xs leading-relaxed">This date is locked because one commuter already has the booking.</p>}{selectedDayIsPast && selectedDay.status !== 'booked' && <p className="mt-2 text-xs leading-relaxed">Past dates are read-only.</p>}{!selectedDayIsPast && selectedDay.status !== 'booked' && <div className="mt-4 grid grid-cols-2 gap-2"><button type="button" onClick={() => void applySelectedDayStatus('available')} disabled={daySaving} aria-pressed={selectedDay.status === 'available'} className={`inline-flex min-h-11 items-center justify-center gap-2 rounded-xl border px-3 text-xs font-bold transition-transform active:scale-[0.98] disabled:cursor-wait disabled:opacity-60 ${selectedDay.status === 'available' ? 'border-emerald-300 bg-emerald-100 text-emerald-800' : 'border-slate-200 bg-white text-slate-700 hover:bg-slate-50'}`}><Check className="h-4 w-4" aria-hidden="true" /> Open</button><button type="button" onClick={() => void applySelectedDayStatus('unavailable')} disabled={daySaving} aria-pressed={selectedDay.status === 'unavailable'} className={`inline-flex min-h-11 items-center justify-center gap-2 rounded-xl border px-3 text-xs font-bold transition-transform active:scale-[0.98] disabled:cursor-wait disabled:opacity-60 ${selectedDay.status === 'unavailable' ? 'border-slate-400 bg-slate-200 text-slate-800' : 'border-slate-200 bg-white text-slate-700 hover:bg-slate-50'}`}><Ban className="h-4 w-4" aria-hidden="true" /> Closed</button></div>}</div>
              <div className="rounded-xl border border-slate-100 bg-slate-50 p-3">
                <div className="flex items-center justify-between gap-2"><span className="text-[11px] font-bold text-slate-700">Configured hours</span><span className="text-[9px] font-semibold text-slate-400">{calendarTimeZone}</span></div>
                {selectedDay.configuredHours?.length ? (
                  <div className="mt-2 flex flex-wrap gap-2">{selectedDay.configuredHours.map((hours, index) => <span key={`${hours.from}-${hours.to}-${index}`} className="rounded-lg border border-emerald-200 bg-white px-2.5 py-1.5 text-[10px] font-bold text-emerald-700">{hours.from}–{hours.to}</span>)}</div>
                ) : (
                  <p className="mt-2 text-[10px] leading-relaxed text-slate-500">No opening hours are configured for this date.</p>
                )}
              </div>
              {dayError && <p role="alert" className="flex items-center gap-1.5 text-[10px] font-semibold text-rose-600"><AlertCircle className="h-3.5 w-3.5" aria-hidden="true" />{dayError}</p>}
              {dayMessage && <p role="status" className={`flex items-center gap-1.5 text-[10px] font-semibold ${selectedDay.status === 'unavailable' ? 'text-slate-600' : 'text-emerald-700'}`}>{selectedDay.status === 'unavailable' ? <Ban className="h-3.5 w-3.5" aria-hidden="true" /> : <CheckCircle2 className="h-3.5 w-3.5" aria-hidden="true" />}{dayMessage}</p>}
              {selectedDay.status === 'booked' && <div className="space-y-2 rounded-xl border border-slate-100 bg-slate-50 p-3"><div className="flex items-center gap-2 text-[11px] font-bold text-slate-700"><Users className="h-3.5 w-3.5 text-blue-600" aria-hidden="true" /> Commuter booking</div><div className="flex items-center justify-between gap-2 text-[10px]"><span className="text-slate-500">Name</span><span className="text-right font-semibold text-slate-700">{selectedDay.booking?.commuterName || 'Booking details unavailable'}</span></div><div className="flex items-center justify-between gap-2 text-[10px]"><span className="text-slate-500">Vehicle</span><span className="inline-flex items-center gap-1 text-right font-semibold text-slate-700"><Car className="h-3 w-3" aria-hidden="true" />{selectedDay.booking?.vehicle || '—'}</span></div>{selectedDay.booking?.commuterPhone && <div className="flex items-center justify-between gap-2 text-[10px]"><span className="text-slate-500">Contact</span><span className="font-semibold text-slate-700">{selectedDay.booking.commuterPhone}</span></div>}</div>}
              <div className="rounded-xl border border-slate-100 p-3 text-[10px] leading-relaxed text-slate-500"><strong className="text-slate-700">One booking per day.</strong> Once a commuter books this spot, the day remains locked until the backend handles cancellation or reopening.</div>
            </aside>
          </div>

          <div className="rounded-2xl border border-slate-200/90 bg-white p-4 shadow-[0_14px_45px_-32px_rgba(15,23,42,0.5)] md:p-5">
            <div className="flex items-start justify-between gap-3">
              <div className="min-w-0">
                <div className="flex items-center gap-2">
                  <CalendarRange className="h-4 w-4 shrink-0 text-[#007AFF]" aria-hidden="true" />
                  <h3 className="text-sm font-bold text-slate-900">Range editor</h3>
                </div>
                <p className="mt-1 text-[11px] leading-relaxed text-slate-500">Set one schedule across several dates.</p>
              </div>
              <button
                type="button"
                onClick={() => {
                  setBulkStart(todayKey);
                  setBulkEnd(todayKey);
                  setBulkFromTime('09:00');
                  setBulkToTime('19:00');
                  setBulkDayPattern('Weekdays');
                  setBulkStatus('available');
                  setBulkMessage(null);
                  setBulkError(null);
                }}
                disabled={availabilitySaving}
                className="inline-flex min-h-9 shrink-0 items-center justify-center gap-1.5 rounded-lg px-2.5 text-[11px] font-semibold text-slate-500 hover:bg-slate-100 hover:text-slate-800 disabled:opacity-50"
              >
                <RotateCcw className="h-3.5 w-3.5" aria-hidden="true" /> Reset
              </button>
            </div>

            <div className="mt-4 grid grid-cols-2 gap-1 rounded-xl bg-slate-100 p-1" aria-label="Availability action">
              <button type="button" onClick={() => setBulkStatus('available')} disabled={availabilitySaving} className={`min-h-10 rounded-lg text-xs font-semibold transition-colors disabled:opacity-50 ${bulkStatus === 'available' ? 'bg-white text-emerald-700 shadow-sm' : 'text-slate-500 hover:text-slate-700'}`} aria-pressed={bulkStatus === 'available'}><span className="inline-flex items-center gap-1.5"><Check className="h-4 w-4" aria-hidden="true" /> Open dates</span></button>
              <button type="button" onClick={() => setBulkStatus('unavailable')} disabled={availabilitySaving} className={`min-h-10 rounded-lg text-xs font-semibold transition-colors disabled:opacity-50 ${bulkStatus === 'unavailable' ? 'bg-white text-slate-800 shadow-sm' : 'text-slate-500 hover:text-slate-700'}`} aria-pressed={bulkStatus === 'unavailable'}><span className="inline-flex items-center gap-1.5"><Ban className="h-4 w-4" aria-hidden="true" /> Close dates</span></button>
            </div>

            <div className={`mt-4 grid gap-3 ${bulkStatus === 'available' ? 'lg:grid-cols-2' : ''}`}>
              <section className="rounded-xl border border-slate-200 bg-slate-50/60 p-3" aria-labelledby="range-dates-title">
                <div className="flex flex-wrap items-center justify-between gap-2">
                  <h4 id="range-dates-title" className="text-[11px] font-semibold text-slate-700">Date range</h4>
                  <div className="flex gap-1.5" aria-label="Date presets">
                    <button type="button" onClick={() => setPreset('week')} disabled={availabilitySaving} className="min-h-8 rounded-lg border border-slate-200 bg-white px-2.5 text-[10px] font-semibold text-slate-600 hover:bg-slate-50 disabled:opacity-50">This week</button>
                    <button type="button" onClick={() => setPreset('month')} disabled={availabilitySaving} className="min-h-8 rounded-lg border border-slate-200 bg-white px-2.5 text-[10px] font-semibold text-slate-600 hover:bg-slate-50 disabled:opacity-50">This month</button>
                  </div>
                </div>
                <div className="mt-3 grid grid-cols-2 gap-2">
                  <label className="min-w-0"><span className="mb-1.5 block text-[10px] font-semibold text-slate-500">From</span><input type="date" min={todayKey} value={bulkStart} onChange={(event) => setBulkStart(event.target.value)} disabled={availabilitySaving} className="min-h-10 w-full min-w-0 rounded-lg border border-slate-200 bg-white px-2.5 text-[11px] outline-none focus:border-[#007AFF] focus:ring-2 focus:ring-blue-100 disabled:opacity-60" /></label>
                  <label className="min-w-0"><span className="mb-1.5 block text-[10px] font-semibold text-slate-500">To</span><input type="date" min={todayKey} value={bulkEnd} onChange={(event) => setBulkEnd(event.target.value)} disabled={availabilitySaving} className="min-h-10 w-full min-w-0 rounded-lg border border-slate-200 bg-white px-2.5 text-[11px] outline-none focus:border-[#007AFF] focus:ring-2 focus:ring-blue-100 disabled:opacity-60" /></label>
                </div>
              </section>

              {bulkStatus === 'available' && (
                <section className="rounded-xl border border-slate-200 bg-slate-50/60 p-3" aria-labelledby="range-schedule-title">
                  <h4 id="range-schedule-title" className="text-[11px] font-semibold text-slate-700">Opening schedule</h4>
                  <div className="mt-3 grid grid-cols-2 gap-2">
                    <label className="min-w-0"><span className="mb-1.5 block text-[10px] font-semibold text-slate-500">Opens</span><input type="time" value={bulkFromTime} onChange={(event) => setBulkFromTime(event.target.value)} disabled={availabilitySaving} className="min-h-10 w-full min-w-0 rounded-lg border border-slate-200 bg-white px-2.5 text-[11px] outline-none focus:border-[#007AFF] focus:ring-2 focus:ring-blue-100 disabled:opacity-60" /></label>
                    <label className="min-w-0"><span className="mb-1.5 block text-[10px] font-semibold text-slate-500">Closes</span><input type="time" value={bulkToTime} onChange={(event) => setBulkToTime(event.target.value)} disabled={availabilitySaving} className="min-h-10 w-full min-w-0 rounded-lg border border-slate-200 bg-white px-2.5 text-[11px] outline-none focus:border-[#007AFF] focus:ring-2 focus:ring-blue-100 disabled:opacity-60" /></label>
                  </div>
                  <label className="mt-2 block"><span className="mb-1.5 block text-[10px] font-semibold text-slate-500">Repeat on</span><input type="text" value={bulkDayPattern} onChange={(event) => setBulkDayPattern(event.target.value)} disabled={availabilitySaving} placeholder="Weekdays" className="min-h-10 w-full rounded-lg border border-slate-200 bg-white px-2.5 text-[11px] outline-none focus:border-[#007AFF] focus:ring-2 focus:ring-blue-100 disabled:opacity-60" /></label>
                </section>
              )}
            </div>

            <div className="mt-4 flex flex-col gap-3 border-t border-slate-100 pt-4 sm:flex-row sm:items-center sm:justify-between">
              <p className="text-[11px] leading-relaxed text-slate-500" aria-live="polite">{bulkPreview.total ? <><strong className="text-slate-800">{bulkPreview.changed}</strong> day{bulkPreview.changed === 1 ? '' : 's'} will change · <strong className="text-slate-800">{bulkPreview.skipped}</strong> skipped</> : 'Choose a date range to preview changes.'}</p>
              <button type="button" onClick={() => void bulkUpdate(bulkStatus)} disabled={availabilitySaving || !bulkPreview.total || bulkPreview.total > MAX_BULK_DAYS || (bulkStatus === 'available' ? !bulkPreview.editable : !bulkPreview.changed)} className="inline-flex min-h-10 w-full shrink-0 items-center justify-center gap-2 rounded-xl bg-[#007AFF] px-4 text-xs font-semibold text-white hover:bg-[#006EE6] disabled:cursor-not-allowed disabled:opacity-40 sm:w-auto"><Check className="h-4 w-4" aria-hidden="true" /> {availabilitySaving ? 'Creating rule…' : bulkStatus === 'available' ? 'Create rule' : 'Apply range'}</button>
            </div>
            {bulkError && <p role="alert" className="mt-3 flex items-center gap-1.5 text-[10px] font-semibold text-rose-600"><AlertCircle className="h-3.5 w-3.5" aria-hidden="true" />{bulkError}</p>}
            {bulkMessage && <p role="status" className="mt-3 flex items-center gap-1.5 text-[10px] font-semibold text-emerald-700"><CheckCircle2 className="h-3.5 w-3.5" aria-hidden="true" />{bulkMessage}</p>}
          </div>
        </motion.section>
      )}
      </AnimatePresence>
    </div>
  );
}
