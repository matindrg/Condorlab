import { scrypt, randomBytes, timingSafeEqual } from 'crypto';
import { promisify } from 'util';

const scryptAsync = promisify(scrypt);

export class CryptoUtil {
  /**
   * هش امن رمز عبور با salt رندوم بر پایه scrypt (استاندارد OWASP ASVS سطح ۲)
   */
  static async hashPassword(password: string): Promise<string> {
    const salt = randomBytes(16).toString('hex');
    const derivedKey = (await scryptAsync(password, salt, 64)) as Buffer;
    return `${salt}:${derivedKey.toString('hex')}`;
  }

  /**
   * بررسی صحت رمز عبور با مقایسه زمان‌ثابت (Timing Safe Equal) جهت جلوگیری از حملات زمان‌بندی
   */
  static async verifyPassword(password: string, storedHash: string): Promise<boolean> {
    const [salt, key] = storedHash.split(':');
    if (!salt || !key) return false;

    const keyBuffer = Buffer.from(key, 'hex');
    const derivedKey = (await scryptAsync(password, salt, 64)) as Buffer;

    if (keyBuffer.length !== derivedKey.length) return false;
    return timingSafeEqual(keyBuffer, derivedKey);
  }

  /**
   * ساخت توکن‌های امن تصادفی (برای توکن‌های تأیید ایمیل، بازیابی و تلگرام)
   */
  static generateSecureToken(length = 32): string {
    return randomBytes(length).toString('hex');
  }

  /**
   * تولید کد عددی کوتاه‌عمر ۶ رقمی (برای تأیید سریع)
   */
  static generateNumericCode(): string {
    return Math.floor(100000 + Math.random() * 900000).toString();
  }
}
