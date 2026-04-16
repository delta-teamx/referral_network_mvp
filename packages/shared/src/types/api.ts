/**
 * Canonical shape for all API responses.
 * Successful responses set `success: true` and populate `data`.
 * Errors set `success: false` and populate `error` (machine-readable message).
 * Paginated list endpoints fill `meta`.
 */
export interface PaginationMeta {
  page: number;
  limit: number;
  total: number;
  totalPages: number;
}

export interface ApiErrorDetail {
  field?: string;
  message: string;
}

export interface ApiResponse<T = unknown> {
  success: boolean;
  data?: T;
  error?: string;
  details?: ApiErrorDetail[];
  meta?: PaginationMeta;
}

export interface PaginatedResponse<T> extends ApiResponse<T[]> {
  meta: PaginationMeta;
}
