/**
 * Shared timing/limits for the exam lock.
 *
 * Why 180s?
 * - Heartbeat is sent every 30s.
 * - A 2-minute network drop must not lose the lock, so the TTL has to be
 *   comfortably above 120s. 180s gives 6 missed heartbeats and still covers
 *   the offline grace window described in the README.
 * - A crashed device keeps the lock for at most 3 minutes, but an explicit
 *   takeover from another device is always possible (subject to the limit).
 */
export const HEARTBEAT_INTERVAL_MS = 30_000;
export const LOCK_TTL_SECONDS = 180;
export const HEARTBEAT_TTL_SECONDS = 180;

/** Max takeovers per exam attempt (anti-bounce). */
export const TAKEOVER_LIMIT = 2;
export const TAKEOVER_COUNT_TTL_SECONDS = 24 * 60 * 60;

/** Offline answers are kept briefly; the real source of truth is SQL. */
export const ANSWERS_TTL_SECONDS = 24 * 60 * 60;

export const MAX_ANSWERS_PER_SYNC = 200;
export const MAX_ANSWER_BYTES = 16 * 1024;
export const MAX_SYNC_BYTES = 256 * 1024;

export const SESSION_TTL_SECONDS = 30 * 24 * 60 * 60;
export const MAX_SESSIONS = 2;

