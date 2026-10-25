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

/**
 * نگاشت رسمی پایه‌های تحصیلی به صورت حروفی فارسی (استاندارد R-66)
 */
export const GRADE_PERSIAN_NAMES: Record<string, string> = {
  '7': 'هفتم',
  '8': 'هشتم',
  '9': 'نهم',
  '10': 'دهم',
  '11': 'یازدهم',
  '12': 'دوازدهم',
  Grade7: 'هفتم',
  Grade8: 'هشتم',
  Grade9: 'نهم',
  Grade10: 'دهم',
  Grade11: 'یازدهم',
};

/**
 * تبدیل کد یا شماره پایه تحصیلی به نگارش رسمی حروفی («پایه دهم»، «پایه یازدهم»، و...)
 * بر اساس استاندارد PRD (قاعده R-66) نباید از ارقام مانند «پایه ۱۰» در رابط کاربری استفاده شود.
 */
export function formatGrade(
  grade: string | number | null | undefined,
  includePrefix: boolean = true
): string {
  if (grade === null || grade === undefined || grade === '') return '';
  const rawStr = grade.toString().trim();
  const cleaned = rawStr.replace(/^پایه\s*/, '').trim();
  const normalizedKey = toEnglishDigits(cleaned);

  const ordinalName = GRADE_PERSIAN_NAMES[normalizedKey] || GRADE_PERSIAN_NAMES[cleaned] || cleaned;

  return includePrefix ? `پایه ${ordinalName}` : ordinalName;
}
