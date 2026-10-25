import type Redis from 'ioredis';

/**
 * Lua scripts make every lock transition atomic:
 * check owner + mutate + refresh TTL in one Redis round-trip.
 */

export const ACQUIRE_LUA = `
-- KEYS[1] exam_lock:{attemptId}
-- KEYS[2] exam_heartbeat:{attemptId}
-- KEYS[3] exam_takeover_count:{attemptId}
-- ARGV[1] deviceId, [2] sessionId, [3] userId, [4] nowMs, [5] ttlSeconds, [6] takeoverLimit
local lock = redis.call('HMGET', KEYS[1], 'deviceId', 'sessionId', 'userId', 'version', 'lastHeartbeatAt')
if lock[1] then
  if lock[1] == ARGV[1] then
    redis.call('HSET', KEYS[1], 'lastHeartbeatAt', ARGV[4])
    redis.call('EXPIRE', KEYS[1], ARGV[5])
    redis.call('HSET', KEYS[2], 'deviceId', ARGV[1], 'sessionId', ARGV[2], 'lastSeen', ARGV[4])
    redis.call('EXPIRE', KEYS[2], ARGV[5])
    return {2, tonumber(lock[4]) or 1}
  end
  return {0, tonumber(lock[4]) or 1, lock[5] or ''}
end

-- If the lock expired after the takeover budget was exhausted, a new /start
-- must not become a silent third takeover.
local takeoverCount = tonumber(redis.call('GET', KEYS[3]) or '0') or 0
if takeoverCount >= (tonumber(ARGV[6]) or 2) then
  return {-1, takeoverCount}
end

redis.call('HSET', KEYS[1],
  'deviceId', ARGV[1],
  'sessionId', ARGV[2],
  'userId', ARGV[3],
  'version', 1,
  'acquiredAt', ARGV[4],
  'lastHeartbeatAt', ARGV[4])
redis.call('EXPIRE', KEYS[1], ARGV[5])

redis.call('HSET', KEYS[2], 'deviceId', ARGV[1], 'sessionId', ARGV[2], 'lastSeen', ARGV[4])
redis.call('EXPIRE', KEYS[2], ARGV[5])

return {1, 1}
`;

export const HEARTBEAT_LUA = `
-- KEYS[1] exam_lock:{attemptId}
-- KEYS[2] exam_heartbeat:{attemptId}
-- KEYS[3] exam_answers:{attemptId}
-- KEYS[4] exam_answer_meta:{attemptId}
-- ARGV[1] deviceId, [2] sessionId, [3] userId, [4] nowMs, [5] lockTtl,
-- ARGV[6] clientSeq, [7] answersTtl, [8..] questionId, jsonValue pairs
local lock = redis.call('HMGET', KEYS[1], 'deviceId', 'sessionId', 'userId', 'version')
if not lock[1] then
  return {-1, 0, 0}
end
if lock[1] ~= ARGV[1] or lock[2] ~= ARGV[2] or lock[3] ~= ARGV[3] then
  return {0, tonumber(lock[4]) or 1, 0}
end

redis.call('HSET', KEYS[1], 'lastHeartbeatAt', ARGV[4])
redis.call('EXPIRE', KEYS[1], ARGV[5])
redis.call('HSET', KEYS[2], 'deviceId', ARGV[1], 'sessionId', ARGV[2], 'lastSeen', ARGV[4])
redis.call('EXPIRE', KEYS[2], ARGV[5])

local clientSeq = tonumber(ARGV[6]) or 0
local lastSeq = tonumber(redis.call('HGET', KEYS[4], 'lastClientSeq') or '0') or 0

-- Idempotency guard: a retried heartbeat with an older sequence is a no-op.
if clientSeq > lastSeq then
  local i = 8
  while i < #ARGV do
    redis.call('HSET', KEYS[3], ARGV[i], ARGV[i + 1])
    i = i + 2
  end
  redis.call('HSET', KEYS[4], 'lastClientSeq', clientSeq, 'updatedAt', ARGV[4])
  redis.call('EXPIRE', KEYS[3], ARGV[7])
  redis.call('EXPIRE', KEYS[4], ARGV[7])
  lastSeq = clientSeq
end

return {1, tonumber(lock[4]) or 1, lastSeq}
`;

export const TAKEOVER_LUA = `
-- KEYS[1] exam_lock:{attemptId}
-- KEYS[2] exam_heartbeat:{attemptId}
-- KEYS[3] exam_takeover_count:{attemptId}
-- ARGV[1] deviceId, [2] sessionId, [3] userId, [4] nowMs,
-- ARGV[5] lockTtl, [6] limit, [7] countTtl
local lock = redis.call('HMGET', KEYS[1], 'deviceId', 'sessionId', 'userId', 'version', 'lastHeartbeatAt')

-- No active lock: treat as initial acquisition, not a takeover.
if not lock[1] then
  redis.call('HSET', KEYS[1],
    'deviceId', ARGV[1], 'sessionId', ARGV[2], 'userId', ARGV[3],
    'version', 1, 'acquiredAt', ARGV[4], 'lastHeartbeatAt', ARGV[4])
  redis.call('EXPIRE', KEYS[1], ARGV[5])
  redis.call('HSET', KEYS[2], 'deviceId', ARGV[1], 'sessionId', ARGV[2], 'lastSeen', ARGV[4])
  redis.call('EXPIRE', KEYS[2], ARGV[5])
  return {2, 1, 0, '', 0}
end

-- Same device/session: idempotent success, never consumes the takeover budget.
if lock[1] == ARGV[1] and lock[2] == ARGV[2] then
  redis.call('HSET', KEYS[1], 'lastHeartbeatAt', ARGV[4])
  redis.call('EXPIRE', KEYS[1], ARGV[5])
  redis.call('HSET', KEYS[2], 'deviceId', ARGV[1], 'sessionId', ARGV[2], 'lastSeen', ARGV[4])
  redis.call('EXPIRE', KEYS[2], ARGV[5])
  local count = tonumber(redis.call('GET', KEYS[3]) or '0') or 0
  return {3, tonumber(lock[4]) or 1, count, lock[1], 0}
end

-- A lock must never be mutated across users.
if lock[3] ~= ARGV[3] then
  return {-2, 0, 0, lock[1] or '', 0}
end

local count = tonumber(redis.call('GET', KEYS[3]) or '0') or 0
local limit = tonumber(ARGV[6]) or 2
if count >= limit then
  return {0, tonumber(lock[4]) or 1, count, lock[1] or '', 0}
end

count = redis.call('INCR', KEYS[3])
redis.call('EXPIRE', KEYS[3], ARGV[7])

local newVersion = (tonumber(lock[4]) or 1) + 1
local previousDevice = lock[1] or ''

redis.call('HSET', KEYS[1],
  'deviceId', ARGV[1],
  'sessionId', ARGV[2],
  'userId', ARGV[3],
  'version', newVersion,
  'lastHeartbeatAt', ARGV[4],
  'takeoverAt', ARGV[4])
redis.call('EXPIRE', KEYS[1], ARGV[5])
redis.call('HSET', KEYS[2], 'deviceId', ARGV[1], 'sessionId', ARGV[2], 'lastSeen', ARGV[4])
redis.call('EXPIRE', KEYS[2], ARGV[5])

return {1, newVersion, count, previousDevice, 1}
`;

export const ASSERT_OWNER_LUA = `
-- KEYS[1] exam_lock:{attemptId}
-- ARGV[1] deviceId, [2] sessionId, [3] userId
local lock = redis.call('HMGET', KEYS[1], 'deviceId', 'sessionId', 'userId', 'version')
if not lock[1] then
  return {-1, 0}
end
if lock[1] ~= ARGV[1] or lock[2] ~= ARGV[2] or lock[3] ~= ARGV[3] then
  return {0, tonumber(lock[4]) or 1}
end
return {1, tonumber(lock[4]) or 1}
`;

export interface ExamLockScripts {
  examAcquire(
    lockKey: string,
    heartbeatKey: string,
    takeoverCountKey: string,
    deviceId: string,
    sessionId: string,
    userId: string,
    nowMs: string,
    ttlSeconds: number,
    takeoverLimit: number,
  ): Promise<[number, number, string?]>;

  examHeartbeat(
    lockKey: string,
    heartbeatKey: string,
    answersKey: string,
    answerMetaKey: string,
    deviceId: string,
    sessionId: string,
    userId: string,
    nowMs: string,
    lockTtl: number,
    clientSeq: number,
    answersTtl: number,
    ...pairs: string[]
  ): Promise<[number, number, number]>;

  examTakeover(
    lockKey: string,
    heartbeatKey: string,
    countKey: string,
    deviceId: string,
    sessionId: string,
    userId: string,
    nowMs: string,
    lockTtl: number,
    limit: number,
    countTtl: number,
  ): Promise<[number, number, number, string?, number?]>;

  examAssertOwner(
    lockKey: string,
    deviceId: string,
    sessionId: string,
    userId: string,
  ): Promise<[number, number]>;
}

export function registerExamLockScripts(redis: Redis): ExamLockScripts {
  redis.defineCommand('examAcquire', { numberOfKeys: 3, lua: ACQUIRE_LUA });
  redis.defineCommand('examHeartbeat', { numberOfKeys: 4, lua: HEARTBEAT_LUA });
  redis.defineCommand('examTakeover', { numberOfKeys: 3, lua: TAKEOVER_LUA });
  redis.defineCommand('examAssertOwner', { numberOfKeys: 1, lua: ASSERT_OWNER_LUA });

  return redis as unknown as ExamLockScripts;
}
