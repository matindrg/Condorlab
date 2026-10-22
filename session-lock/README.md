# Condorlab Exam Lock — Active Lock with Takeover

A production-oriented reference implementation of **one active exam device + explicit takeover + heartbeat + offline answer sync** for a high-stakes online exam.

- **Backend:** Node.js 20+, TypeScript, Express, Redis 7 (`ioredis`), Zod, JWT.
- **Frontend:** React 18 hook (`useExamHeartbeat`) + accessible takeover modal + integration example.
- **Storage:** Redis is used only for coordination/locks and short-lived offline answers. Attempts and final answers belong in SQL in production (see “Production notes”).
- **Verified:** `npm run typecheck` and `npm run build` pass.

---

## 1. What is implemented

| Requirement | Implementation |
|---|---|
| Max 2 active login sessions | `SessionService.registerLogin()` enforces `MAX_SESSIONS=2` atomically |
| One exam device | `exam_lock:{attemptId}` Redis hash; only the owner can heartbeat/submit |
| Heartbeat every 30s | `HEARTBEAT_INTERVAL_MS=30_000` in hook; `POST /heartbeat` refreshes TTL |
| Device B blocked + takeover | `POST /start` returns `409 EXAM_LOCKED`; `POST /takeover` steals the lock after explicit confirm |
| Kick-out of Device A | Next heartbeat/submit returns `403 EXAM_LOCK_LOST`; hook stops and redirects |
| Anti-bounce limit | `exam_takeover_count:{attemptId}`; max **2** takeovers per attempt; then `403 TAKEOVER_LIMIT_REACHED` |
| Offline grace | Lock TTL 180s > 2-minute offline; answers queued in `localStorage` and flushed with the next heartbeat |
| Atomicity | All lock transitions are Lua scripts (check owner + mutate + TTL refresh in one round-trip) |

---

## 2. Lock lifecycle

```
Device A                         Redis                         Device B
   |                               |                              |
   |-- POST /start --------------->| lock=A, version=1            |
   |<-- 200 acquired --------------|                              |
   |                               |<-- POST /start --------------|
   |                               |--- 409 EXAM_LOCKED --------->|
   |                               |                              | (shows Takeover modal)
   |-- heartbeat (30s) ----------->| refresh lock TTL             |
   |                               |<-- POST /takeover -----------|
   |                               | lock=B, version=2, count=1   |
   |                               |--- 200 taken_over ---------->|
   |-- heartbeat ----------------->|                              |
   |<-- 403 EXAM_LOCK_LOST --------|                              |
   | (redirect /dashboard)         |                              |
   |                               |<-- heartbeat (B) ------------|
   |                               |--- 200 ok ------------------>|
```

**Key rule:** a device may keep a stale local copy of answers, but it can never write them after losing the lock. Every heartbeat checks ownership **inside** the same Lua script that writes answers.

---

## 3. Redis schema and TTLs

All keys for one attempt use a Redis Cluster hash tag (`{attemptId}`) so a multi-key Lua script is slot-safe.

| Key | Type | TTL | Purpose / fields |
|---|---|---|---|
| `exam_lock:{attemptId}` | hash | **180s** | `deviceId`, `sessionId`, `userId`, `version`, `acquiredAt`, `lastHeartbeatAt`, `takeoverAt` |
| `heartbeat:{attemptId}` | hash | **180s** | `deviceId`, `sessionId`, `lastSeen` — liveness snapshot for diagnostics |
| `exam_takeover_count:{attemptId}` | string | **24h** | Number of takeovers consumed in this attempt |
| `exam_answers:{attemptId}` | hash | **24h** | `questionId -> JSON value` (demo only; SQL in production) |
| `exam_answer_meta:{attemptId}` | hash | **24h** | `lastClientSeq`, `updatedAt` (idempotent sync) |
| `session:{userId}:{sessionId}` | hash | **30d** | `userId`, `deviceId`, `createdAt`, `lastSeen` |
| `user_sessions:{userId}` | sorted set | **30d** | Member = `sessionId`, score = expiry timestamp; prunes expired sessions |
| `rate:{scope}:{userId}` | string | **60s** | Fixed-window rate limit counter |

### Why 180 seconds?

- Heartbeat interval is 30s.
- 190s would be arbitrary; **180s** gives 6 missed heartbeats and covers a **2-minute (120s) network drop** with 60s of margin.
- A crashed device keeps the lock for at most 3 minutes. Another device can still **explicitly take over immediately** — no need to wait for TTL expiry.
- If the lock expires, the next heartbeat gets `EXAM_LOCK_MISSING`; the device can re-acquire via `/takeover` (if the anti-bounce budget allows) or is kicked out.

### Constants

| Constant | Value | Location |
|---|---|---|
| Heartbeat interval | 30s | `src/constants.ts`, hook default |
| Lock TTL | 180s | `src/constants.ts` |
| Heartbeat TTL | 180s | `src/constants.ts` |
| Takeover limit | 2 per attempt | `TAKEOVER_LIMIT`, env `TAKEOVER_LIMIT` |
| Takeover count TTL | 24h | `src/constants.ts` |
| Answers TTL | 24h | `src/constants.ts` |
| Max answers per sync | 200 | `src/constants.ts` |
| Max single answer size | 16 KB | `src/constants.ts` |
| Max sync payload | 256 KB | `src/constants.ts` |
| Max login sessions | 2 | `MAX_SESSIONS`, env `MAX_SESSIONS` |
| Session TTL | 30 days | `src/constants.ts` |

---

## 4. API

Base: `/api/exam/:attemptId`

**Auth:** `Authorization: Bearer <JWT>` on every request. The JWT contains:
```json
{ "sub": "user_demo_1", "sid": "sess_...", "did": "device-a", "role": "student" }
```
- `sid` is validated against `session:{userId}:{sessionId}`.
- `did` must match the session device; it is **never** read from a client header.
- The attempt is checked against the authenticated `userId`.

All success responses use `{ "data": ... }`; all errors use:
```json
{
  "error": {
    "code": "EXAM_LOCK_LOST",
    "message": "آزمون در دستگاه دیگری ادامه یافته است...",
    "details": { "canTakeover": true, "remainingTakeovers": 1 }
  },
  "requestId": "..."
}
```

### 4.1 `POST /start`

Initial lock acquisition.

**200**
```json
{
  "data": {
    "status": "acquired",
    "version": 1,
    "expiresAt": "2026-10-22T18:33:00.000Z",
    "serverTime": "2026-10-22T18:30:00.000Z",
    "heartbeatIntervalMs": 30000
  }
}
```
- `status` is `acquired` or `already_locked` (same device retry).
- **409 `EXAM_LOCKED`** when another device holds the lock:
```json
{
  "error": {
    "code": "EXAM_LOCKED",
    "message": "آزمون روی دستگاه دیگری باز است.",
    "details": {
      "version": 1,
      "lockedAt": "2026-10-22T18:29:40.000Z",
      "expiresAt": "2026-10-22T18:33:00.000Z",
      "canTakeover": true,
      "remainingTakeovers": 2
    }
  }
}
```
- 403 `TAKEOVER_LIMIT_REACHED` if the lock expired after the 2-takeover budget was exhausted (a fresh `/start` cannot silently become a third takeover).
- 404 `ATTEMPT_NOT_FOUND`, 409 `ATTEMPT_SUBMITTED`, 409 `ATTEMPT_EXPIRED`.

### 4.2 `POST /heartbeat`

Maintains the lock and optionally syncs offline answers.

**Body**
```json
{
  "clientSeq": 12,
  "answers": [
    { "questionId": "q_17", "value": 2 },
    { "questionId": "q_18", "value": true }
  ]
}
```
- `clientSeq` is a monotonically increasing sequence. It is required if `answers` is non-empty.
- The server writes answers **only if** `clientSeq > lastClientSeq`; retries are idempotent.
- Values are JSON-serializable and size-limited per answer and per batch.

**200**
```json
{
  "data": {
    "status": "ok",
    "version": 1,
    "ackedSeq": 12,
    "takeoverCount": 0,
    "remainingTakeovers": 2,
    "expiresAt": "2026-10-22T18:33:00.000Z",
    "serverTime": "2026-10-22T18:30:00.000Z",
    "heartbeatIntervalMs": 30000
  }
}
```
- **403 `EXAM_LOCK_LOST`** — another device took over:
```json
{
  "error": {
    "code": "EXAM_LOCK_LOST",
    "message": "آزمون در دستگاه دیگری ادامه یافته است...",
    "details": {
      "status": "lock_lost",
      "version": 2,
      "remainingTakeovers": 1,
      "canTakeover": true,
      "reason": "lock_lost"
    }
  }
}
```
- **403 `EXAM_LOCK_MISSING`** — lock expired (e.g. offline > 3 min). The device may call `/takeover` if budget remains.
- 400 `VALIDATION_ERROR`, 401 `UNAUTHORIZED`, 409 `ATTEMPT_SUBMITTED`.

### 4.3 `POST /takeover`

Explicitly steals the lock from the other device.

**Body**
```json
{ "confirm": true }
```

**200**
```json
{
  "data": {
    "status": "taken_over",
    "version": 2,
    "takeoverCount": 1,
    "remainingTakeovers": 1,
    "previousDeviceId": "device-a",
    "expiresAt": "2026-10-22T18:33:00.000Z",
    "serverTime": "2026-10-22T18:30:00.000Z",
    "heartbeatIntervalMs": 30000
  }
}
```
- `status` can be `taken_over`, `acquired` (no active lock), or `already_owner` (idempotent).
- **403 `TAKEOVER_LIMIT_REACHED`** after 2 takeovers:
```json
{
  "error": {
    "code": "TAKEOVER_LIMIT_REACHED",
    "message": "سقف جابه‌جایی دستگاه در این آزمون پر شده است.",
    "details": { "takeoverCount": 2, "remainingTakeovers": 0 }
  }
}
```
- 403 `EXAM_LOCK_OWNERSHIP_MISMATCH` if the lock belongs to another user (defensive).
- The previous device’s next heartbeat/submit returns `403 EXAM_LOCK_LOST`.

### 4.4 `POST /submit`

Final submit. Verifies lock ownership, syncs the final answers, marks the attempt submitted, releases the lock.

- 200 `{ "data": { "status": "submitted", ... } }`
- 200 `{ "data": { "status": "already_submitted" } }` (idempotent)
- 403 `EXAM_LOCK_LOST` / `EXAM_LOCK_MISSING` if another device owns the attempt.
- 409 `ATTEMPT_EXPIRED`.

### 4.5 `GET /lock`

Read-only lock state for the UI (no mutation):
```json
{
  "data": {
    "locked": true,
    "isOwner": false,
    "version": 2,
    "lockedAt": "...",
    "expiresAt": "...",
    "takeoverCount": 1,
    "remainingTakeovers": 1,
    "serverTime": "..."
  }
}
```

### Error codes

| HTTP | Code | Meaning |
|---|---|---|
| 401 | `UNAUTHORIZED` / `SESSION_INVALID` | Missing/invalid token; session revoked or device mismatch |
| 403 | `EXAM_LOCK_LOST` | The device no longer owns the lock → kick out |
| 403 | `EXAM_LOCK_MISSING` | Lock expired → kick out or takeover |
| 403 | `TAKEOVER_LIMIT_REACHED` | Anti-bounce limit reached |
| 404 | `ATTEMPT_NOT_FOUND` | Unknown or foreign attempt |
| 409 | `EXAM_LOCKED` | Another device owns the lock → show takeover modal |
| 409 | `ATTEMPT_SUBMITTED` / `ATTEMPT_EXPIRED` | Attempt no longer active |
| 429 | `RATE_LIMITED` | Too many requests |
| 400 | `VALIDATION_ERROR` | Invalid body/params |

---

## 5. Frontend: `useExamHeartbeat`

Location: `src/client/useExamHeartbeat.ts`

```tsx
const {
  status,            // idle | active | offline | lock_lost | kicked | error
  started,
  pendingCount,
  takeoverInfo,
  canTakeover,
  remainingTakeovers,
  startExam,         // POST /start; opens the takeover modal on 409
  takeover,          // POST /takeover; returns true on success
  queueAnswer,       // persists to localStorage + triggers a debounced sync
  retryNow,
} = useExamHeartbeat({
  attemptId,
  getAccessToken: () => authStore.accessToken,
  onTakeoverRequired: (info) => setTakeoverOpen(true),
  onLockLost: () => router.replace('/dashboard'), // 403 kick-out
  onAuthError: () => router.replace('/login'),
});
```

### What the hook does

1. **Start:** `startExam()` calls `POST /start`. A `409 EXAM_LOCKED` populates `takeoverInfo` and calls `onTakeoverRequired` — this is the “Device B blocked initially” path.
2. **Heartbeat:** after `started`, sends every 30s, plus immediate pings on mount, `online`, and tab focus.
3. **Offline queue:** `queueAnswer(questionId, value)` writes to:
   `localStorage["condorlab:exam:{attemptId}:pending:v1"]`
   with a monotonically increasing `clientSeq`.
4. **Sync:** the next heartbeat sends the queue. On `200`, answers with `clientSeq <= ackedSeq` are removed.
5. **Kick-out:** a `403 EXAM_LOCK_LOST` / `EXAM_LOCK_MISSING` stops the interval, sets `status='lock_lost'`, and calls `onLockLost()` → redirect to dashboard. It does **not** clear local answers (a legitimate takeover by this device can still flush them; if the user is kicked, the attempt is over).
6. **Network error:** timeout/5xx/429 set `status='offline'`, keep the queue, and retry with exponential backoff (1s → 30s). A network failure is never treated as a lock loss.
7. **Takeover success:** sets `started=true`, restarts heartbeat, and immediately flushes the local queue.

### UI integration

`src/client/ExamPage.example.tsx` shows:
- `startExam()` on mount;
- answer selection → `queueAnswer`;
- `<TakeoverModal />` for the `409` path;
- `onLockLost` → dashboard.

`src/client/TakeoverModal.tsx` is accessible (`role="dialog"`, `aria-modal`, focus on confirm), shows the last activity of the other device and the remaining takeover budget, and disables the action when the limit is exhausted.

---

## 6. Edge case: internet drops for 2 minutes

Timeline with the default values:

```
t=0s     heartbeat OK, lock TTL refreshed to 180s
t=10s    network drops; answers go to localStorage (clientSeq 5,6)
t=70s    heartbeat fails → status=offline, retry scheduled
t=130s   network returns → online event → immediate heartbeat
         lock still exists (TTL was 180s), owner still this device
         server Lua: owner check + write answers + refresh TTL
         response ackedSeq=6
t=130s   hook removes acked answers from localStorage
```

Why it works:
- **Lock TTL 180s > 2-minute outage**.
- The heartbeat request carries the whole queue, so there is no separate “sync” race.
- The Lua script checks ownership and writes answers atomically; if another device took over during the outage, the old device gets `403` and **cannot overwrite** the new device’s answers.

If the outage is longer than 180s:
- The lock expires. The next heartbeat returns `403 EXAM_LOCK_MISSING`.
- The hook stops and calls `onLockLost()`. If the user wants to continue, the UI can call `takeover()` (subject to the 2-takeover limit); on success the queued answers are flushed.
- If another device already took over, the result is `403 EXAM_LOCK_LOST`; the old queue is not applied.

**Conflict policy:** server wins. A device that lost the lock never writes answers. This is deliberate: last-write-wins across devices would allow a kicked device to corrupt a live attempt.

---

## 7. Anti-bounce / takeover semantics

- Counter is **per attempt**, not per device: `exam_takeover_count:{attemptId}`.
- Same device calling `/takeover` again is idempotent (`already_owner`) and **does not** consume budget.
- Each successful steal increments the counter; at `count >= 2`, further takeovers return `403 TAKEOVER_LIMIT_REACHED`.
- The modal disables the button and tells the user to contact support.
- A support agent can manually reset the count (operational tool; not exposed in this sample) with an audit log.

Why per-attempt rather than per-device: the goal is to stop account sharing / ping-pong between devices, not to punish a specific browser. Two total moves are enough for a legitimate device switch (e.g. laptop → phone → back), while a third move is suspicious.

The acquire Lua script also checks the counter: if the lock expired after two takeovers, `/start` returns `403 TAKEOVER_LIMIT_REACHED` instead of granting a silent third move.

---

## 8. Security notes

- **Device binding** comes from the signed JWT `did`, not `X-Device-Id`; a stolen token cannot claim a different device without a new session.
- **Session validation** on every exam request: revoked sessions cannot keep heartbeating.
- **No cross-user lock mutation**: the Lua takeover script returns `-2` if `userId` differs.
- **No PII in Redis keys/values**: only opaque user/attempt/device IDs.
- **Rate limits** on start/heartbeat/takeover/submit (Redis fixed window). Rate limiting fails open; the lock itself still fails closed if Redis is unavailable.
- **Input validation**: Zod schemas, 1 MB JSON limit, max 200 answers, max 16 KB per answer, max 256 KB per sync.
- **Helmet/CORS**: allowlist via `CORS_ORIGINS`; credentials enabled only for configured origins.
- **Errors**: controlled `AppError` only; unexpected errors return a generic 500 with a request id.
- **Logs**: authorization header is redacted; no answer payloads are logged.
- **Redis**: use TLS/password in production (`rediss://`), private network, separate logical DB or key prefix.

### Important production caveat

This repository uses Redis for `exam_answers:{attemptId}` **only to make the sample runnable without SQL**. In production:
- Attempts, answers, scores and submissions belong in SQL (transactional, auditable, durable).
- Redis remains the lock/liveness layer; the answer sync should write to SQL in the same request after the lock check, or use an outbox.
- Do not treat Redis as the system of record for student answers.

---

## 9. Run locally

```bash
cd session-lock
cp .env.example .env

# Redis (Docker)
docker compose up -d redis

# or a local redis-server:
# redis-server --port 6379

npm install
npm run seed      # creates 2 sessions and prints two JWTs + attemptId
npm run dev       # http://localhost:3000
```

`npm run seed` prints something like:

```json
{
  "attemptId": "att_demo_1",
  "deviceA": { "token": "eyJ...", "deviceId": "device-a" },
  "deviceB": { "token": "eyJ...", "deviceId": "device-b" }
}
```

### Smoke test with curl

```bash
# Device A starts
curl -s -X POST http://localhost:3000/api/exam/att_demo_1/start \
  -H "Authorization: Bearer $TOKEN_A" -H 'Content-Type: application/json' -d '{}'

# Device B is blocked (409 EXAM_LOCKED)
curl -s -X POST http://localhost:3000/api/exam/att_demo_1/start \
  -H "Authorization: Bearer $TOKEN_B" -H 'Content-Type: application/json' -d '{}'

# Device B takes over
curl -s -X POST http://localhost:3000/api/exam/att_demo_1/takeover \
  -H "Authorization: Bearer $TOKEN_B" -H 'Content-Type: application/json' -d '{"confirm":true}'

# Device A heartbeat → 403 EXAM_LOCK_LOST
curl -s -X POST http://localhost:3000/api/exam/att_demo_1/heartbeat \
  -H "Authorization: Bearer $TOKEN_A" -H 'Content-Type: application/json' -d '{}'
```

---

## 10. Verification

```bash
npm run typecheck
npm run build
```

Both pass. Redis integration tests require a running Redis; this environment did not have Redis/Docker, so the Lua behavior is covered by code review and the smoke-test script above. For CI, add a Redis service container and run the curl flow or a Vitest integration suite against `REDIS_URL`.

---

## 11. File map

```
src/
  constants.ts                 TTLs and limits
  config.ts                    env validation
  errors.ts                    error codes + AppError
  redis/
    client.ts                  ioredis connection
    scripts.ts                 Lua scripts + typing
  session/
    session.service.ts         max 2 login sessions, JWT session validation
  attempts/
    attempt.repository.ts      demo in-memory store (replace with SQL)
    attempt.service.ts         ownership/status checks
  exam/
    lock.service.ts            acquire/heartbeat/takeover/assert/release
    exam.controller.ts         HTTP mapping + validation
    exam.routes.ts             routes + rate limits
  auth/
    jwt.ts                     sign/verify HS256
    auth.middleware.ts         Bearer + session + device binding
  middleware/
    request-id.ts
    error-handler.ts
    rate-limit.ts
    async-handler.ts
  client/
    useExamHeartbeat.ts        30s heartbeat, offline queue, 403 handling, takeover
    TakeoverModal.tsx          accessible modal
    ExamPage.example.tsx       integration example
    exam-api.ts                fetch wrapper + stable error shape
  scripts/
    seed.ts                    two sessions + JWTs
  app.ts / server.ts
docker-compose.yml
.env.example
```

---

## 12. Production hardening checklist

- [ ] Replace `InMemoryAttemptRepository` with SQL and create attempts transactionally on exam start.
- [ ] Store answers/scores in SQL; Redis only for lock/liveness.
- [ ] Add audit events for takeover/kick-out/limit (actor, attempt, device, IP, requestId).
- [ ] Add a support tool to reset takeover count with a mandatory reason; log it.
- [ ] Use Redis Cluster hash tags (already used) or a single Redis primary with persistence.
- [ ] Add distributed tracing/metrics: heartbeat failures, 403 rate, takeover rate, lock TTL expiries.
- [ ] Alert if heartbeat failure rate or `EXAM_LOCK_LOST` spikes during an exam window.
- [ ] Add CSRF protection if cookies are used; this sample uses Bearer tokens.
- [ ] Rotate JWT keys; keep token TTL short and refresh via a separate endpoint.
- [ ] Add per-IP + per-user rate limits at the edge (WAF/API gateway) as well.
- [ ] Load-test 200 concurrent heartbeats (≈7 req/s) and takeover bursts.
- [ ] Add a reconciliation job for “submitted in SQL but lock still exists” and vice versa.
