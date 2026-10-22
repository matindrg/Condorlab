export const ErrorCodes = {
  VALIDATION_ERROR: 'VALIDATION_ERROR',
  UNAUTHORIZED: 'UNAUTHORIZED',
  FORBIDDEN: 'FORBIDDEN',
  NOT_FOUND: 'NOT_FOUND',
  INTERNAL_ERROR: 'INTERNAL_ERROR',
  RATE_LIMITED: 'RATE_LIMITED',

  ATTEMPT_NOT_FOUND: 'ATTEMPT_NOT_FOUND',
  ATTEMPT_SUBMITTED: 'ATTEMPT_SUBMITTED',
  ATTEMPT_EXPIRED: 'ATTEMPT_EXPIRED',

  EXAM_LOCKED: 'EXAM_LOCKED',
  EXAM_LOCK_LOST: 'EXAM_LOCK_LOST',
  EXAM_LOCK_MISSING: 'EXAM_LOCK_MISSING',
  EXAM_LOCK_OWNERSHIP_MISMATCH: 'EXAM_LOCK_OWNERSHIP_MISMATCH',
  TAKEOVER_LIMIT_REACHED: 'TAKEOVER_LIMIT_REACHED',

  SESSION_INVALID: 'SESSION_INVALID',
  SESSION_LIMIT_REACHED: 'SESSION_LIMIT_REACHED',
} as const;

export type ErrorCode = (typeof ErrorCodes)[keyof typeof ErrorCodes];

/**
 * A controlled application error. Only these errors expose their message to
 * the client; unexpected errors always become a generic INTERNAL_ERROR.
 */
export class AppError extends Error {
  public readonly status: number;
  public readonly code: ErrorCode;
  public readonly details?: unknown;

  constructor(status: number, code: ErrorCode, message: string, details?: unknown) {
    super(message);
    this.name = 'AppError';
    this.status = status;
    this.code = code;
    this.details = details;
    Object.setPrototypeOf(this, AppError.prototype);
  }
}
