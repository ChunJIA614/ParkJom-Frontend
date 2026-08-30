export interface ParkingReview {
  reviewId: number;
  bookingId: string;
  parkingSpotId: number;
  reviewerId: number;
  reviewerName: string;
  rating: number;
  comment: string;
  ownerReply: string | null;
  ownerReplyAt: string | null;
  createdAt: string;
  updatedAt: string;
  parkingName?: string;
  stationName?: string;
}

const STORAGE_KEY = 'parkjom.parkingReviews';
const DELETED_KEY = 'parkjom.deletedParkingReviewIds';
export const PARKING_REVIEWS_CHANGED_EVENT = 'parkjom:parking-reviews-changed';

export const SAMPLE_REVIEWS: ParkingReview[] = [
  {
    reviewId: 1,
    bookingId: 'SAMPLE-001',
    parkingSpotId: 0,
    reviewerId: 0,
    reviewerName: 'Aina R.',
    rating: 5,
    comment: 'Easy to find and only a short walk to the station. The bay felt secure even after dark.',
    ownerReply: 'Thank you, Aina. We are glad the arrival instructions helped!',
    ownerReplyAt: '2026-08-19T10:00:00.000Z',
    createdAt: '2026-08-18T08:30:00.000Z',
    updatedAt: '2026-08-18T08:30:00.000Z',
    parkingName: 'KL Gateway Residence Bay A-12',
    stationName: 'Universiti LRT',
  },
  {
    reviewId: 2,
    bookingId: 'SAMPLE-002',
    parkingSpotId: 0,
    reviewerId: 0,
    reviewerName: 'Daniel L.',
    rating: 4,
    comment: 'Clean, well marked and the smart bollard worked immediately. The entrance is a little narrow.',
    ownerReply: null,
    ownerReplyAt: null,
    createdAt: '2026-08-09T14:20:00.000Z',
    updatedAt: '2026-08-09T14:20:00.000Z',
    parkingName: 'Mutiara Damansara Private Bay',
    stationName: 'Mutiara Damansara MRT',
  },
];

function loadStoredReviews() {
  try {
    const parsed = JSON.parse(localStorage.getItem(STORAGE_KEY) || '[]') as ParkingReview[];
    return Array.isArray(parsed) ? parsed : [];
  } catch {
    return [];
  }
}

function loadDeletedReviewIds() {
  try {
    const parsed = JSON.parse(localStorage.getItem(DELETED_KEY) || '[]') as number[];
    return Array.isArray(parsed) ? parsed : [];
  } catch {
    return [];
  }
}

export function loadAllParkingReviews() {
  const deleted = new Set(loadDeletedReviewIds());
  return [...loadStoredReviews(), ...SAMPLE_REVIEWS].filter((review) => !deleted.has(review.reviewId));
}

export function loadParkingReviews(parkingSpotId: number) {
  return loadAllParkingReviews().filter((review) => review.parkingSpotId === parkingSpotId || review.parkingSpotId === 0);
}

export function loadCachedParkingReviews(parkingSpotId: number) {
  return loadStoredReviews().filter((review) => review.parkingSpotId === parkingSpotId);
}

export function saveParkingReview(review: ParkingReview) {
  const current = loadStoredReviews();
  localStorage.setItem(STORAGE_KEY, JSON.stringify([
    review,
    ...current.filter((item) => item.reviewId !== review.reviewId),
  ]));
  window.dispatchEvent(new CustomEvent(PARKING_REVIEWS_CHANGED_EVENT));
  return review;
}

export function deleteParkingReview(
  reviewId: number,
  actor: { requesterId?: number; isAdmin?: boolean },
) {
  const review = loadAllParkingReviews().find((item) => item.reviewId === reviewId);
  if (!review || (!actor.isAdmin && review.reviewerId !== actor.requesterId)) return false;

  const stored = loadStoredReviews();
  localStorage.setItem(STORAGE_KEY, JSON.stringify(stored.filter((item) => item.reviewId !== reviewId)));
  if (SAMPLE_REVIEWS.some((item) => item.reviewId === reviewId)) {
    localStorage.setItem(DELETED_KEY, JSON.stringify([...new Set([...loadDeletedReviewIds(), reviewId])]));
  }
  window.dispatchEvent(new CustomEvent(PARKING_REVIEWS_CHANGED_EVENT));
  return true;
}
