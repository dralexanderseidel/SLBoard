import { NextResponse } from 'next/server';

export type ApiErrorCode =
  | 'AUTH_REQUIRED'
  | 'AUTH_INVALID'
  | 'FORBIDDEN'
  | 'NOT_FOUND'
  | 'BAD_REQUEST'
  | 'VALIDATION_ERROR'
  | 'SERVICE_UNAVAILABLE'
  | 'STORAGE_ERROR'
  | 'INTERNAL_ERROR'
  | 'SCHOOL_INACTIVE'
  | 'ACCOUNT_INACTIVE'
  | 'DELETE_REQUEST_OPEN'
  | 'FEATURE_AI_DISABLED'
  | 'FEATURE_DRAFTS_DISABLED'
  | 'QUOTA_EXCEEDED';

export function apiError(
  status: number,
  code: ApiErrorCode,
  message: string,
  details?: unknown
) {
  return NextResponse.json(
    {
      error: message,
      code,
      ...(details === undefined ? {} : { details }),
    },
    { status }
  );
}
