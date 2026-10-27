/**
 * پردازش و اعتبارسنجی امن توکن سشن احراز هویت کندرلب
 * پشتیبانی کامل از توکن‌های خام، رمزگذاری‌شده Base64 و جلوگیری از خطای Double URL-Encoding
 */
export function parseSessionToken(rawSession?: string | null): { userId: string; sessionId: string } | null {
  if (!rawSession || typeof rawSession !== 'string') {
    return null;
  }

  try {
    let clean = rawSession.trim();
    if (clean.startsWith('Bearer ')) {
      clean = clean.substring(7).trim();
    }

    // رمزگشایی حلقه‌ای هرگونه URL-encoding احتمالی (تک یا چندلایه مانند %3D یا %253D)
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

    // رمزگشایی امن Base64
    const decodedStr = Buffer.from(clean, 'base64').toString('utf-8');
    const separatorIdx = decodedStr.indexOf(':');
    if (separatorIdx === -1) {
      return null;
    }

    const userId = decodedStr.substring(0, separatorIdx).trim();
    // حذف هرگونه کاراکتر نامعتبر یا بایت کنترلی انتهایی
    const sessionId = decodedStr.substring(separatorIdx + 1).replace(/[^\w-]/g, '').trim();

    if (!userId || !sessionId) {
      return null;
    }

    return { userId, sessionId };
  } catch {
    return null;
  }
}
