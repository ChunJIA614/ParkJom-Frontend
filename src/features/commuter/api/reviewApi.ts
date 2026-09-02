import { apiRequest, authorizationHeaders, readApiError } from '@/services/apiClient';

export interface CreateReviewRequest {
  bookingId: number;
  rating: number;
  comment?: string;
}

export interface UpdateReviewRequest {
  rating: number;
  comment?: string;
}

export interface OwnerReplyRequest {
  ownerReply: string;
}

export interface ReviewApiData {
  reviewId: number;
  parkingSpotId: number;
  rating: number;
  comment: string;
  reviewerDisplayName: string;
  isVerifiedBooking: boolean;
  ownerReply: string | null;
  ownerReplyAt: string | null;
  createdAt: string;
  updatedAt: string;
}

export interface CreateReviewResponse {
  code: number;
  success: boolean;
  message: string;
  data: ReviewApiData;
}

export type UpdateReviewResponse = CreateReviewResponse;
export type OwnerReplyResponse = CreateReviewResponse;

export interface DeleteReviewResponse {
  code: number;
  success: boolean;
  message: string;
}

export interface GetParkingReviewsResponse {
  code: number;
  success: boolean;
  message: string;
  parkingSpotId: number;
  totalCount: number;
  averageRating: number;
  page: number;
  pageSize: number;
  totalPages: number;
  data: ReviewApiData[];
}

export interface GetRoleParkingReviewsResponse {
  code: number;
  success: boolean;
  message: string;
  totalCount: number;
  page: number;
  pageSize: number;
  totalPages: number;
  data: ReviewApiData[];
}

export interface AdminReviewListOptions {
  search?: string;
  rating?: number;
  page?: number;
  pageSize?: number;
  signal?: AbortSignal;
}

export interface GetAdminReviewsResponse {
  code: number;
  success: boolean;
  message: string;
  totalCount: number;
  page: number;
  pageSize: number;
  totalPages: number;
  data: ReviewApiData[];
}

type ReviewWireData = Partial<ReviewApiData> & {
  ReviewId?: number;
  ParkingSpotId?: number;
  Rating?: number;
  Comment?: string;
  ReviewerDisplayName?: string;
  IsVerifiedBooking?: boolean;
  OwnerReply?: string | null;
  OwnerReplyAt?: string | null;
  CreatedAt?: string;
  UpdatedAt?: string;
};

type CreateReviewWireResponse = {
  code?: number;
  Code?: number;
  success?: boolean;
  Success?: boolean;
  message?: string;
  Message?: string;
  data?: ReviewWireData;
  Data?: ReviewWireData;
};

type GetParkingReviewsWireResponse = {
  code?: number;
  Code?: number;
  success?: boolean;
  Success?: boolean;
  message?: string;
  Message?: string;
  parkingSpotId?: number;
  ParkingSpotId?: number;
  totalCount?: number;
  TotalCount?: number;
  averageRating?: number;
  AverageRating?: number;
  page?: number;
  Page?: number;
  pageSize?: number;
  PageSize?: number;
  totalPages?: number;
  TotalPages?: number;
  total?: number;
  Total?: number;
  hasNextPage?: boolean;
  HasNextPage?: boolean;
  search?: string | null;
  Search?: string | null;
  rating?: number | null;
  Rating?: number | null;
  pagination?: {
    page?: number;
    currentPage?: number;
    pageSize?: number;
    totalCount?: number;
    totalPages?: number;
    hasNextPage?: boolean;
  };
  Pagination?: {
    Page?: number;
    CurrentPage?: number;
    PageSize?: number;
    TotalCount?: number;
    TotalPages?: number;
    HasNextPage?: boolean;
  };
  data?: ReviewWireData[];
  Data?: ReviewWireData[];
  reviews?: ReviewWireData[];
  Reviews?: ReviewWireData[];
};

function normalizeReview(data: ReviewWireData): ReviewApiData | null {
  const reviewId = data.reviewId ?? data.ReviewId;
  const parkingSpotId = data.parkingSpotId ?? data.ParkingSpotId;
  const rating = data.rating ?? data.Rating;
  const isVerifiedBooking = data.isVerifiedBooking ?? data.IsVerifiedBooking;
  if (
    typeof reviewId !== 'number'
    || typeof parkingSpotId !== 'number'
    || typeof rating !== 'number'
    || typeof isVerifiedBooking !== 'boolean'
  ) return null;

  return {
    reviewId,
    parkingSpotId,
    rating,
    comment: data.comment ?? data.Comment ?? '',
    reviewerDisplayName: data.reviewerDisplayName ?? data.ReviewerDisplayName ?? '',
    isVerifiedBooking,
    ownerReply: data.ownerReply ?? data.OwnerReply ?? null,
    ownerReplyAt: data.ownerReplyAt ?? data.OwnerReplyAt ?? null,
    createdAt: data.createdAt ?? data.CreatedAt ?? '',
    updatedAt: data.updatedAt ?? data.UpdatedAt ?? '',
  };
}

export async function createReview(
  token: string,
  review: CreateReviewRequest,
  signal?: AbortSignal,
): Promise<CreateReviewResponse> {
  const response = await apiRequest('/reviews', {
    method: 'POST',
    headers: authorizationHeaders(token, 'application/json'),
    body: JSON.stringify(review),
    signal,
  });

  if (!response.ok) {
    throw new Error(await readApiError(response, 'Unable to publish this review.'));
  }

  const payload = await response.json().catch(() => null) as CreateReviewWireResponse | null;
  const data = payload?.data ?? payload?.Data;
  const normalizedReview = data ? normalizeReview(data) : null;
  if (!payload || !normalizedReview) {
    throw new Error('The review service returned an unreadable response.');
  }

  const result: CreateReviewResponse = {
    code: payload.code ?? payload.Code ?? response.status,
    success: payload.success ?? payload.Success ?? false,
    message: payload.message ?? payload.Message ?? '',
    data: normalizedReview,
  };

  if (!result.success) {
    throw new Error(result.message || 'Unable to publish this review.');
  }

  return result;
}

export async function updateReview(
  token: string,
  reviewId: number,
  review: UpdateReviewRequest,
  signal?: AbortSignal,
): Promise<UpdateReviewResponse> {
  const response = await apiRequest(`/reviews/${encodeURIComponent(String(reviewId))}`, {
    method: 'PUT',
    headers: authorizationHeaders(token, 'application/json'),
    body: JSON.stringify(review),
    signal,
  });

  if (!response.ok) {
    throw new Error(await readApiError(response, 'Unable to update this review.'));
  }

  const payload = await response.json().catch(() => null) as CreateReviewWireResponse | null;
  const data = payload?.data ?? payload?.Data;
  const normalizedReview = data ? normalizeReview(data) : null;
  if (!payload || !normalizedReview) {
    throw new Error('The review service returned an unreadable update response.');
  }

  const result: UpdateReviewResponse = {
    code: payload.code ?? payload.Code ?? response.status,
    success: payload.success ?? payload.Success ?? false,
    message: payload.message ?? payload.Message ?? '',
    data: normalizedReview,
  };

  if (!result.success) {
    throw new Error(result.message || 'Unable to update this review.');
  }
  if (result.data.reviewId !== reviewId) {
    throw new Error('The review update response did not match the selected review.');
  }

  return result;
}

export async function updateOwnerReply(
  token: string,
  reviewId: number,
  reply: OwnerReplyRequest,
  signal?: AbortSignal,
): Promise<OwnerReplyResponse> {
  const response = await apiRequest(
    `/reviews/${encodeURIComponent(String(reviewId))}/owner-reply`,
    {
      method: 'PUT',
      headers: authorizationHeaders(token, 'application/json'),
      body: JSON.stringify(reply),
      signal,
    },
  );

  if (!response.ok) {
    throw new Error(await readApiError(response, 'Unable to publish this owner reply.'));
  }

  const payload = await response.json().catch(() => null) as CreateReviewWireResponse | null;
  const data = payload?.data ?? payload?.Data;
  const normalizedReview = data ? normalizeReview(data) : null;
  if (!payload || !normalizedReview) {
    throw new Error('The review service returned an unreadable owner reply response.');
  }

  const result: OwnerReplyResponse = {
    code: payload.code ?? payload.Code ?? response.status,
    success: payload.success ?? payload.Success ?? false,
    message: payload.message ?? payload.Message ?? '',
    data: normalizedReview,
  };

  if (!result.success) {
    throw new Error(result.message || 'Unable to publish this owner reply.');
  }
  if (result.data.reviewId !== reviewId) {
    throw new Error('The owner reply response did not match the selected review.');
  }

  return result;
}

export async function getParkingReviews(
  token: string,
  parkingSpotId: number,
  page = 1,
  pageSize = 10,
  signal?: AbortSignal,
): Promise<GetParkingReviewsResponse> {
  const params = new URLSearchParams({
    page: String(page),
    pageSize: String(pageSize),
  });
  const response = await apiRequest(
    `/reviews/parking/${encodeURIComponent(String(parkingSpotId))}?${params.toString()}`,
    {
      method: 'GET',
      headers: authorizationHeaders(token),
      signal,
    },
  );

  if (!response.ok) {
    throw new Error(await readApiError(response, 'Unable to load parking reviews.'));
  }

  const payload = await response.json().catch(() => null) as GetParkingReviewsWireResponse | null;
  const wireData = payload?.data ?? payload?.Data;
  if (!payload || !Array.isArray(wireData)) {
    throw new Error('The review service returned an unreadable review list.');
  }

  const data = wireData.map(normalizeReview).filter((review): review is ReviewApiData => Boolean(review));
  if (data.length !== wireData.length) {
    throw new Error('The review service returned incomplete review details.');
  }

  const result: GetParkingReviewsResponse = {
    code: payload.code ?? payload.Code ?? response.status,
    success: payload.success ?? payload.Success ?? false,
    message: payload.message ?? payload.Message ?? '',
    parkingSpotId: payload.parkingSpotId ?? payload.ParkingSpotId ?? parkingSpotId,
    totalCount: payload.totalCount ?? payload.TotalCount ?? data.length,
    averageRating: payload.averageRating ?? payload.AverageRating ?? 0,
    page: payload.page ?? payload.Page ?? page,
    pageSize: payload.pageSize ?? payload.PageSize ?? pageSize,
    totalPages: payload.totalPages ?? payload.TotalPages ?? (data.length > 0 ? 1 : 0),
    data,
  };

  if (!result.success) {
    throw new Error(result.message || 'Unable to load parking reviews.');
  }
  if (result.parkingSpotId !== parkingSpotId) {
    throw new Error('The review response did not match the selected parking spot.');
  }

  return result;
}

async function getRoleParkingReviews(
  token: string,
  path: string,
  parkingSpotId: number,
  page = 1,
  pageSize = 10,
  signal?: AbortSignal,
): Promise<GetRoleParkingReviewsResponse> {
  const params = new URLSearchParams({
    page: String(page),
    pageSize: String(pageSize),
  });
  const response = await apiRequest(
    `${path}/${encodeURIComponent(String(parkingSpotId))}?${params.toString()}`,
    {
      method: 'GET',
      headers: authorizationHeaders(token),
      signal,
    },
  );

  if (!response.ok) {
    throw new Error(await readApiError(response, 'Unable to load parking reviews.'));
  }

  const payload = await response.json().catch(() => null) as GetParkingReviewsWireResponse | null;
  const wireData = payload?.data ?? payload?.Data;
  if (!payload || !Array.isArray(wireData)) {
    throw new Error('The review service returned an unreadable review list.');
  }

  const data = wireData.map(normalizeReview).filter((review): review is ReviewApiData => Boolean(review));
  if (data.length !== wireData.length) {
    throw new Error('The review service returned incomplete review details.');
  }

  const result: GetRoleParkingReviewsResponse = {
    code: payload.code ?? payload.Code ?? response.status,
    success: payload.success ?? payload.Success ?? false,
    message: payload.message ?? payload.Message ?? '',
    totalCount: payload.totalCount ?? payload.TotalCount ?? data.length,
    page: payload.page ?? payload.Page ?? page,
    pageSize: payload.pageSize ?? payload.PageSize ?? pageSize,
    totalPages: payload.totalPages ?? payload.TotalPages ?? (data.length > 0 ? 1 : 0),
    data,
  };

  if (!result.success) {
    throw new Error(result.message || 'Unable to load parking reviews.');
  }

  return result;
}

export function getOwnerParkingReviews(
  token: string,
  parkingSpotId: number,
  page = 1,
  pageSize = 10,
  signal?: AbortSignal,
) {
  return getRoleParkingReviews(token, '/reviews/owner/parking', parkingSpotId, page, pageSize, signal);
}

export function getAdminParkingReviews(
  token: string,
  parkingSpotId: number,
  page = 1,
  pageSize = 10,
  signal?: AbortSignal,
) {
  return getRoleParkingReviews(token, '/reviews/admin/parking', parkingSpotId, page, pageSize, signal);
}

export async function getAdminReviews(
  token: string,
  options: AdminReviewListOptions = {},
): Promise<GetAdminReviewsResponse> {
  const params = new URLSearchParams();
  if (options.search?.trim()) params.set('search', options.search.trim());
  if (options.rating && options.rating >= 1 && options.rating <= 5) params.set('rating', String(Math.floor(options.rating)));
  if (options.page && options.page > 0) params.set('page', String(Math.floor(options.page)));
  if (options.pageSize && options.pageSize > 0) params.set('pageSize', String(Math.floor(options.pageSize)));

  const query = params.toString();
  const response = await apiRequest(`/reviews/admin${query ? `?${query}` : ''}`, {
    method: 'GET',
    headers: authorizationHeaders(token),
    signal: options.signal,
  });

  if (!response.ok) {
    throw new Error(await readApiError(response, 'Unable to load admin reviews.'));
  }

  const payload = await response.json().catch(() => null) as unknown;
  const isEnvelope = payload !== null && !Array.isArray(payload) && typeof payload === 'object';
  const envelope = isEnvelope ? payload as GetParkingReviewsWireResponse : {};
  const wireData = Array.isArray(payload)
    ? payload as ReviewWireData[]
    : envelope.data ?? envelope.Data ?? envelope.reviews ?? envelope.Reviews;

  if (!Array.isArray(wireData)) {
    throw new Error('The admin review service returned an unreadable review list.');
  }

  const data = wireData.map(normalizeReview).filter((review): review is ReviewApiData => Boolean(review));
  if (data.length !== wireData.length) {
    throw new Error('The admin review service returned incomplete review details.');
  }

  const pagination = envelope.pagination;
  const pascalPagination = envelope.Pagination;
  const page = envelope.page
    ?? envelope.Page
    ?? pagination?.page
    ?? pagination?.currentPage
    ?? pascalPagination?.Page
    ?? pascalPagination?.CurrentPage
    ?? options.page
    ?? 1;
  const pageSize = envelope.pageSize
    ?? envelope.PageSize
    ?? pagination?.pageSize
    ?? pascalPagination?.PageSize
    ?? options.pageSize
    ?? (data.length || 1);
  const totalCount = envelope.totalCount
    ?? envelope.TotalCount
    ?? envelope.total
    ?? envelope.Total
    ?? pagination?.totalCount
    ?? pascalPagination?.TotalCount
    ?? data.length;
  const totalPages = envelope.totalPages
    ?? envelope.TotalPages
    ?? pagination?.totalPages
    ?? pascalPagination?.TotalPages
    ?? (totalCount > 0 ? Math.ceil(totalCount / pageSize) : 0);
  const result: GetAdminReviewsResponse = {
    code: envelope.code ?? envelope.Code ?? response.status,
    success: envelope.success ?? envelope.Success ?? !isEnvelope,
    message: envelope.message ?? envelope.Message ?? '',
    totalCount,
    page,
    pageSize,
    totalPages,
    data,
  };

  if (!result.success) {
    throw new Error(result.message || 'Unable to load admin reviews.');
  }

  return result;
}

export async function deleteReview(
  token: string,
  reviewId: number,
  signal?: AbortSignal,
): Promise<DeleteReviewResponse> {
  const response = await apiRequest(`/reviews/${encodeURIComponent(String(reviewId))}`, {
    method: 'DELETE',
    headers: authorizationHeaders(token),
    signal,
  });

  if (!response.ok) {
    throw new Error(await readApiError(response, 'Unable to delete this review.'));
  }

  const payload = await response.json().catch(() => null) as {
    code?: number;
    Code?: number;
    success?: boolean;
    Success?: boolean;
    message?: string;
    Message?: string;
  } | null;
  if (!payload) {
    throw new Error('The review service returned an unreadable delete response.');
  }

  const result: DeleteReviewResponse = {
    code: payload.code ?? payload.Code ?? response.status,
    success: payload.success ?? payload.Success ?? false,
    message: payload.message ?? payload.Message ?? '',
  };
  if (!result.success) {
    throw new Error(result.message || 'Unable to delete this review.');
  }

  return result;
}
