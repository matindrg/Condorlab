import test from 'node:test';
import assert from 'node:assert/strict';

// تست پردازش توکن سشن و جلوگیری از Double URL-Encoding
function parseSessionToken(rawSession) {
  if (!rawSession || typeof rawSession !== 'string') {
    return null;
  }

  try {
    let clean = rawSession.trim();
    if (clean.startsWith('Bearer ')) {
      clean = clean.substring(7).trim();
    }

    let safetyCounter = 0;
    while (clean.includes('%') && safetyCounter < 5) {
      safetyCounter++;
      try {
        const decoded = decodeURIComponent(clean);
        if (decoded === clean) break;
        clean = decoded;
      } catch {
        break;
      }
    }

    const decodedStr = Buffer.from(clean, 'base64').toString('utf-8');
    const separatorIdx = decodedStr.indexOf(':');
    if (separatorIdx === -1) {
      return null;
    }

    const userId = decodedStr.substring(0, separatorIdx).trim();
    const sessionId = decodedStr.substring(separatorIdx + 1).replace(/[^\w-]/g, '').trim();

    if (!userId || !sessionId) {
      return null;
    }

    return { userId, sessionId };
  } catch {
    return null;
  }
}

test('Session Token Parser - Standard Base64', () => {
  const token = 'user_123:session_abc_456';
  const base64 = Buffer.from(token).toString('base64');
  const res = parseSessionToken(base64);
  assert.equal(res?.userId, 'user_123');
  assert.equal(res?.sessionId, 'session_abc_456');
});

test('Session Token Parser - Single URL Encoded with == padding', () => {
  const token = 'usr-mvpdbg7p:95e717200bacdbdb465de8efb1d2172996b54f87729ffaf5';
  const base64 = Buffer.from(token).toString('base64'); // has ==
  const encodedOnce = encodeURIComponent(base64); // %3D%3D
  const res = parseSessionToken(encodedOnce);
  assert.equal(res?.userId, 'usr-mvpdbg7p');
  assert.equal(res?.sessionId, '95e717200bacdbdb465de8efb1d2172996b54f87729ffaf5');
});

test('Session Token Parser - Double URL Encoded (%253D%253D)', () => {
  const token = 'usr-mvpdbg7p:95e717200bacdbdb465de8efb1d2172996b54f87729ffaf5';
  const base64 = Buffer.from(token).toString('base64');
  const encodedTwice = encodeURIComponent(encodeURIComponent(base64));
  assert.ok(encodedTwice.includes('%253D'));
  const res = parseSessionToken(encodedTwice);
  assert.equal(res?.userId, 'usr-mvpdbg7p');
  assert.equal(res?.sessionId, '95e717200bacdbdb465de8efb1d2172996b54f87729ffaf5');
});

test('Session Token Parser - Bearer Header format', () => {
  const token = 'usr-test-user:session-999';
  const base64 = Buffer.from(token).toString('base64');
  const res = parseSessionToken(`Bearer ${base64}`);
  assert.equal(res?.userId, 'usr-test-user');
  assert.equal(res?.sessionId, 'session-999');
});

test('Leaderboard Tied Ranking Formula (1, 2, 2, 4)', () => {
  const rawScores = [
    { name: 'A', score: 95 },
    { name: 'B', score: 90 },
    { name: 'C', score: 90 }, // مساوی با B -> رتبه ۲
    { name: 'D', score: 85 }, // رتبه ۴ (نه ۳!)
    { name: 'E', score: 80 }, // رتبه ۵
    { name: 'F', score: 80 }, // رتبه ۵
    { name: 'G', score: 75 }, // رتبه ۷ (نه ۶!)
  ];

  let currentRank = 1;
  const ranks = [];
  for (let i = 0; i < rawScores.length; i++) {
    if (i > 0 && rawScores[i].score < rawScores[i - 1].score) {
      currentRank = i + 1;
    }
    ranks.push({ name: rawScores[i].name, rank: currentRank });
  }

  assert.deepEqual(ranks, [
    { name: 'A', rank: 1 },
    { name: 'B', rank: 2 },
    { name: 'C', rank: 2 },
    { name: 'D', rank: 4 },
    { name: 'E', rank: 5 },
    { name: 'F', rank: 5 },
    { name: 'G', rank: 7 },
  ]);
});
