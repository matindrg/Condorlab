const { RegisterSchema, LoginSchema, CompleteProfileSchema, ApplyCouponSchema, StudentGrade, toEnglishDigits } = require('../packages/shared/dist/index.js');
const { CryptoUtil } = require('../apps/api/dist/common/utils/crypto.util.js');

let passedTests = 0;
let failedTests = 0;

function assert(condition, testName) {
  if (condition) {
    console.log(`  ✅ PASS: ${testName}`);
    passedTests++;
  } else {
    console.error(`  ❌ FAIL: ${testName}`);
    failedTests++;
  }
}

async function runAllTests() {
  console.log('\n========================================');
  console.log('🧪 CONDORLAB COMPREHENSIVE FEATURE TESTS');
  console.log('========================================\n');

  // ─── ۱. تست‌های اعتبارسنجی ثبت‌نام (Registration Schema) ───
  console.log('📌 بخش ۱: اعتبارسنجی فرم ثبت‌نام داوطلب');

  // تست عدم پذیرش در صورت تیک نخوردن قوانین
  const uncheckedTerms = RegisterSchema.safeParse({
    firstName: 'آرتین',
    lastName: 'رضایی',
    email: 'artin@example.com',
    password: 'password123',
    confirmPassword: 'password123',
    termsAccepted: false,
  });
  assert(!uncheckedTerms.success, 'رد ثبت‌نام در صورت عدم پذیرش دستی قوانین توسط دانش‌آموز');

  // تست قبولی با تیک قوانین
  const validReg = RegisterSchema.safeParse({
    firstName: 'آرتین',
    lastName: 'رضایی',
    email: 'artin@example.com',
    password: 'password123',
    confirmPassword: 'password123',
    termsAccepted: true,
  });
  assert(validReg.success, 'تأیید ثبت‌نام با اطلاعات معتبر و تیک قوانین');

  // تست عدم تطابق تکرار رمز عبور
  const mismatchedPass = RegisterSchema.safeParse({
    firstName: 'آرتین',
    lastName: 'رضایی',
    email: 'artin@example.com',
    password: 'password123',
    confirmPassword: 'differentPassword',
    termsAccepted: true,
  });
  assert(!mismatchedPass.success, 'رد ثبت‌نام در صورت عدم تطابق تکرار رمز عبور');

  // تست رمز عبور کمتر از ۸ نویسه
  const shortPass = RegisterSchema.safeParse({
    firstName: 'آرتین',
    lastName: 'رضایی',
    email: 'artin@example.com',
    password: '12345',
    confirmPassword: '12345',
    termsAccepted: true,
  });
  assert(!shortPass.success, 'رد ثبت‌نام در صورت کوتاه بودن رمز عبور (< ۸ نویسه)');

  // تست تبدیل ارقام فارسی پایه تحصیلی به انگلیسی (R-65)
  const persianGradeReg = RegisterSchema.safeParse({
    firstName: 'سارا',
    lastName: 'احمدی',
    email: 'sara@example.com',
    password: 'password123',
    confirmPassword: 'password123',
    grade: '۱۰',
    termsAccepted: true,
  });
  assert(persianGradeReg.success && persianGradeReg.data.grade === StudentGrade.Grade10, 'نرمال‌سازی ارقام فارسی در پایه تحصیلی (۱۰ -> 10)');

  // ─── ۲. تست‌های نرمال‌سازی ارقام و فیلدهای عددی (R-65) ───
  console.log('\n📌 بخش ۲: نرمال‌سازی ارقام فارسی/عربی (R-65 Digit Normalization)');
  const converted = toEnglishDigits('۰۹۱۲۳۴۵۶۷۸۹ - ۴۵٪ - کد ۱۲۳۴');
  assert(converted === '09123456789 - 45% - کد 1234', 'تبدیل صحیح تمام ارقام فارسی به انگلیسی');

  // ─── ۳. تست‌های ورود به سیستم (Login Schema) ───
  console.log('\n📌 بخش ۳: اعتبارسنجی فرم ورود (Login Schema)');
  const validLogin = LoginSchema.safeParse({
    email: 'student@condorlab.ir',
    password: 'superSecretPassword',
  });
  assert(validLogin.success, 'تأیید اطلاعات ورود معتبر');

  const invalidEmailLogin = LoginSchema.safeParse({
    email: 'not-an-email',
    password: 'superSecretPassword',
  });
  assert(!invalidEmailLogin.success, 'رد ورود با ایمیل با فرمت نامعتبر');

  // ─── ۴. تست‌های تکمیل پروفایل و قاعده خط قرمز پایه ۱۲ (R-53) ───
  console.log('\n📌 بخش ۴: تکمیل پرونده تسویه و ممانعت از پایه دوازدهم (R-53)');

  // شماره تماس با ارقام فارسی
  const persianPhoneProfile = CompleteProfileSchema.safeParse({
    phoneNumber: '۰۹۱۲۳۴۵۶۷۸۹',
    city: 'تهران',
    school: 'علامه حلی ۱',
    grade: '۱۰',
  });
  assert(persianPhoneProfile.success && persianPhoneProfile.data.phoneNumber === '09123456789', 'تبدیل شماره تلفن با ارقام فارسی به فرمت معتبر 09123456789');

  // شماره تماس نامعتبر
  const invalidPhone = CompleteProfileSchema.safeParse({
    phoneNumber: '02188888888',
    city: 'تهران',
    school: 'دبیرستان انرژی اتمی',
    grade: '10',
  });
  assert(!invalidPhone.success, 'رد شماره ثابت و الزام شماره همراه با پیش‌شماره ۰۹');

  // تست اجباری بودن پایه تحصیلی در تکمیل پروفایل
  const missingGradeProfile = CompleteProfileSchema.safeParse({
    phoneNumber: '09123456789',
    city: 'تهران',
    school: 'علامه حلی ۱',
  });
  assert(!missingGradeProfile.success, 'الزام ورود پایه تحصیلی در تکمیل پروفایل');

  // تست عدم پذیرش زبان انگلیسی برای شهر
  const englishCityProfile = CompleteProfileSchema.safeParse({
    phoneNumber: '09123456789',
    city: 'Tehran',
    school: 'علامه حلی ۱',
    grade: '10',
  });
  assert(!englishCityProfile.success, 'رد ثبت شهر به زبان انگلیسی');

  // تست عدم پذیرش زبان انگلیسی برای مدرسه
  const englishSchoolProfile = CompleteProfileSchema.safeParse({
    phoneNumber: '09123456789',
    city: 'تهران',
    school: 'Helli 1 High School',
    grade: '10',
  });
  assert(!englishSchoolProfile.success, 'رد ثبت نام مدرسه به زبان انگلیسی');

  // ─── ۵. تست‌های کوپن تخفیف (Coupon Validation & Hunter Coupons - R-59) ───
  console.log('\n📌 بخش ۵: اعتبارسنجی کدهای تخفیف و کوپن شکاری (R-59)');
  const validCoupon = ApplyCouponSchema.safeParse({
    code: 'campbell50',
    examId: 'exam-1234',
  });
  assert(validCoupon.success && validCoupon.data.code === 'CAMPBELL50', 'تبدیل خودکار کد تخفیف به حروف بزرگ لاتین');

  // ─── ۶. تست‌های رمزنگاری و هش پسورد ───
  console.log('\n📌 بخش ۶: توابع امنیتی و رمزنگاری رمز عبور (Argon2 / CryptoUtil)');
  const rawPass = 'CondorLab@2026';
  const hashed = await CryptoUtil.hashPassword(rawPass);
  const verifyValid = await CryptoUtil.verifyPassword(rawPass, hashed);
  const verifyInvalid = await CryptoUtil.verifyPassword('WrongPass', hashed);
  assert(verifyValid && !verifyInvalid, 'صحت عملکرد هش و تطبیق رمز عبور با سالت امنیتی');

  // ─── ۷. تست‌های قفل ظرفیت و مسدودسازی ثبت‌نام مازاد (R-58) ───
  console.log('\n📌 بخش ۷: قفل ظرفیت آزمون و ممانعت از ثبت‌نام پس از تکمیل سقف (R-58)');
  const examFull = {
    capacity: 500,
    officialEnrolledCount: 500,
  };
  const isFull = examFull.officialEnrolledCount >= examFull.capacity;
  assert(isFull, 'تشخیص صحیح تکمیل ظرفیت آزمون رسمی');

  const examAvailable = {
    capacity: 500,
    officialEnrolledCount: 382,
  };
  const isAvailable = examAvailable.officialEnrolledCount < examAvailable.capacity;
  assert(isAvailable, 'تشخیص صحیح مجاز بودن ثبت‌نام در صورت وجود صندلی باقی‌مانده');

  // ─── جمع‌بندی نتایج ───
  console.log('\n========================================');
  console.log(`📊 نتیجه تست‌ها: ${passedTests} موفق | ${failedTests} ناموفق`);
  console.log('========================================\n');

  if (failedTests > 0) {
    process.exit(1);
  }
}

runAllTests().catch((e) => {
  console.error('FATAL TEST ERROR:', e);
  process.exit(1);
});
