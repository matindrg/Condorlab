export interface ApiErrorDetails {
  code?: string;
  message?: string;
  details?: Record<string, unknown>;
  requestId?: string;
}

export class ExamApiError extends Error {
  public readonly status: number;
  public readonly code: string;
  public readonly details?: Record<string, unknown>;

  constructor(status: number, code: string, message: string, details?: Record<string, unknown>) {
    super(message);
    this.name = 'ExamApiError';
    this.status = status;
    this.code = code;
    this.details = details;
  }
}

export interface ApiEnvelope<T> {
  data: T;
  requestId?: string;
}

/**
 * Small fetch wrapper used by the hook. It deliberately keeps the error shape
 * stable so the hook can distinguish "lock lost" from "network error".
 */
export async function postJson<T>(
  url: string,
  token: string,
  body: unknown,
  signal?: AbortSignal,
): Promise<T> {
  const response = await fetch(url, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      Authorization: `Bearer ${token}`,
    },
    body: JSON.stringify(body),
    signal,
  });

  const payload = (await response.json().catch(() => null)) as
    | (ApiEnvelope<T> & { error?: ApiErrorDetails })
    | null;

  if (!response.ok) {
    const error = payload?.error;
    throw new ExamApiError(
      response.status,
      error?.code ?? `HTTP_${response.status}`,
      error?.message ?? 'درخواست انجام نشد.',
      error?.details,
    );
  }

  if (!payload || !('data' in payload)) {
    throw new ExamApiError(response.status, 'INVALID_RESPONSE', 'پاسخ سرور نامعتبر است.');
  }

  return payload.data;
}
