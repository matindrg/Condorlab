/**
 * ابزار تبدیل و نرمال‌سازی ارقام فارسی، عربی و انگلیسی (قاعده R-65)
 * پیشگیری از خطاهای اعتبارسنجی ناشی از تفاوت زبان کیبورد کاربر
 */

const PERSIAN_DIGITS = ['۰', '۱', '۲', '۳', '۴', '۵', '۶', '۷', '۸', '۹'];
const ARABIC_DIGITS = ['٠', '١', '٢', '٣', '٤', '٥', '٦', '٧', '٨', '٩'];

/**
 * تبدیل تمامی ارقام فارسی و عربی به ارقام استاندارد انگلیسی جهت اعتبارسنجی و ذخیره در دیتابیس
 */
export function toEnglishDigits(str: string | number | null | undefined): string {
  if (str === null || str === undefined) return '';
  let value = str.toString();

  for (let i = 0; i < 10; i++) {
    const persianRegex = new RegExp(PERSIAN_DIGITS[i], 'g');
    const arabicRegex = new RegExp(ARABIC_DIGITS[i], 'g');
    value = value.replace(persianRegex, i.toString()).replace(arabicRegex, i.toString());
  }

  // نرمال‌سازی نماد درصد و ممیز اعشار فارسی
  value = value.replace(/٪/g, '%').replace(/٫/g, '.');

  return value;
}

/**
 * تبدیل ارقام انگلیسی به فارسی جهت نمایش متنی زیبا و یکدست در رابط کاربری
 */
export function toPersianDigits(str: string | number | null | undefined): string {
  if (str === null || str === undefined) return '';
  let value = str.toString();

  for (let i = 0; i < 10; i++) {
    const englishRegex = new RegExp(i.toString(), 'g');
    value = value.replace(englishRegex, PERSIAN_DIGITS[i]);
  }

  return value;
}

/**
 * قالب‌بندی قیمت و اعداد با جداکننده سه‌رقمی و ارقام فارسی
 */
export function formatPersianNumber(num: number | string): string {
  const englishNumber = toEnglishDigits(num);
  const parts = englishNumber.toString().split('.');
  parts[0] = parts[0].replace(/\B(?=(\d{3})+(?!\d))/g, '،');
  return toPersianDigits(parts.join('.'));
}

/**
 * قالب‌بندی مبلغ به تومان همراه با ارقام فارسی
 */
export function formatToman(amount: number | string): string {
  const num = typeof amount === 'string' ? parseFloat(amount) : amount;
  if (isNaN(num) || num === 0) return 'رایگان';
  return `${formatPersianNumber(num)} تومان`;
}
