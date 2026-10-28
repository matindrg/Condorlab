# فهرست و ردگیری جامع داده‌های هاردکد، ماک و رکوردهای دستی دیتابیس (Condorlab Mock & Hardcoded Data Registry)

> **هدف این سند:**  
> ثبت و مستندسازی دقیق تمام نقاطی از سیستم که در فاز اولیه به صورت استاتیک، ماک (Mock) یا رکورد دستی در پایگاه‌داده پیاده‌سازی شده‌اند، تا در فاز توسعه پنل مدیریت (Admin Panel) و سیستم مدیریت محتوا (CMS)، تمامی آن‌ها به سیستم کاملاً داینامیک و متصل به دیتابیس تبدیل شوند.

---

## ۱. فایل‌ها و ماژول‌های حاوی داده‌های ماک (Mock Data)

### ۱.۱. بانک سؤالات و پاسخ‌نامه‌های آزمون‌ها
* **مسیر فایل:** [`apps/api/src/modules/exam-room/exam-questions.mock.ts`](file:///Users/matinmousavi/Desktop/Condorlab/apps/api/src/modules/exam-room/exam-questions.mock.ts)
* **داده‌های موجود:**
  * `MOCK_EXAM_QUESTIONS`: ۶۰ سؤال ۴ گزینه‌ای کمپبل با متن، گزینه‌ها، کلید صحیح، مبحث و جلد کمپبل.
  * `STAGE1_PILOT_QUESTIONS`: ۷۵ سؤال ۵ گزینه‌ای استاندارد مرحله اول المپیاد زیست‌شناسی با ضریب منفی ۰.۲۵-.
  * `STAGE2_PILOT_QUESTIONS`: ۴۰ سؤال آزمون مرحله دو (شامل سؤالات ۵ گزاره‌ای صحیح/غلط `ص / غ` و مسائل محاسباتی کوتاه‌پاسخ عددی ۰ تا ۹۹).
* **طرح جایگزینی در فاز ادمین:** اتصال به جدول `questions` و `exam_questions` در PostgreSQL با قابلیت بارگذاری از Word/LaTeX یا خروجی OCR بانک سؤال.

### ۱.۲. فهرست آزمون‌های کاتالوگ در فرانت‌اند
* **مسیر فایل:** [`apps/web/src/lib/catalog.ts`](file:///Users/matinmousavi/Desktop/Condorlab/apps/web/src/lib/catalog.ts)
* **داده‌های موجود:**
  * آرایه `INITIAL_CATALOG_EXAMS`: شامل متادیتاهای ۴ آزمون پایلوت (عنوان، اسلاگ، دسته‌بندی، ظرفیت، قیمت، تاریخ شروع و پایان، جلدهای کمپبل).
* **طرح جایگزینی در فاز ادمین:** واکشی ۱۰۰٪ داینامیک از اندپوینت `/api/exams` و کش سمت کلاینت با React Query یا SWR بدون اتکا به آرایه ثابت لوکال.

### ۱.۳. فهرست آزمون‌های کاتالوگ در بک‌اند (سرویس‌های تسویه‌حساب و داشبورد)
* **مسیر فایل‌ها:**
  * [`apps/api/src/modules/checkout/checkout.service.ts`](file:///Users/matinmousavi/Desktop/Condorlab/apps/api/src/modules/checkout/checkout.service.ts)
  * [`apps/api/src/modules/dashboard/dashboard.service.ts`](file:///Users/matinmousavi/Desktop/Condorlab/apps/api/src/modules/dashboard/dashboard.service.ts)
* **داده‌های موجود:**
  * آرایه `MOCK_CATALOG_EXAMS`: مقادیر پیش‌فرض برای ظرفیت‌ها، تعداد سؤالات و قیمت‌ها در صورت عدم واکشی از جدول `exams`.
* **طرح جایگزینی در فاز ادمین:** استعلام مستقیم از جدول `exams` و وابستگی‌های محصول در جدول `products`.

### ۱.۴. شرکت‌کنندگان نمونه اسکوربورد پایلوت (Pilot Leaderboard Sample Data)
* **مسیر فایل:** [`apps/api/src/modules/leaderboard/leaderboard.service.ts`](file:///Users/matinmousavi/Desktop/Condorlab/apps/api/src/modules/leaderboard/leaderboard.service.ts)
* **داده‌های موجود:**
  * آرایه `PILOT_SAMPLE_PARTICIPANTS`: اسامی، درصد نمرات، مدارس و شهرهای داوطلبان نمونه با رتبه‌بندی تساوی المپیادی (۱، ۲، ۲، ۴) جهت نمایش اسکوربورد آزمون‌های پایلوت در زمان خالی بودن جدول تلاش‌ها.
* **طرح جایگزینی در فاز ادمین:** با آغاز رسمی آزمون و برگزاری دوره‌ها، رتبه‌ها منحصراً از رکوردهای واقعی جدول `attempts` محاسبه می‌شوند.

### ۱.۵. کش‌های موقت درون‌حافظه (In-Memory Fallbacks)
* **مسیر فایل‌ها:**
  * [`apps/api/src/modules/auth/auth.service.ts`](file:///Users/matinmousavi/Desktop/Condorlab/apps/api/src/modules/auth/auth.service.ts): `inMemoryUsers` و `inMemoryCredentials` (فال‌بک در زمان قطع موقت اتصال PostgreSQL).
  * [`apps/api/src/common/redis/redis.service.ts`](file:///Users/matinmousavi/Desktop/Condorlab/apps/api/src/common/redis/redis.service.ts): `inMemorySessions` و `inMemoryRevokedSessions` (فال‌بک سشن‌ها در زمان قطع موقت ردیس).
* **طرح جایگزینی در فاز پروداکشن:** راه‌اندازی کلاستر دائمی Redis و اتصال تضمینی دیتابیس Supabase/PostgreSQL با Connection Pooling.

### ۱.۶. معماری کش دولایه کاتالوگ فروشگاه (Store Caching Architecture)
* **مسیر فایل‌ها:**
  * [`apps/web/src/context/store-cache-context.tsx`](file:///Users/matinmousavi/Desktop/Condorlab/apps/web/src/context/store-cache-context.tsx): کش لایه ۱ کلاینت درون‌حافظه (`memoryStoreCatalog`) با `staleTime: Infinity` و `gcTime: 1 hour`.
  * [`apps/web/src/app/api/exams/route.ts`](file:///Users/matinmousavi/Desktop/Condorlab/apps/web/src/app/api/exams/route.ts): کش لایه ۲ سرور با Next.js `unstable_cache` نشانه‌گذاری‌شده با تگ `'store-products'`.
  * [`apps/web/src/app/api/revalidate/route.ts`](file:///Users/matinmousavi/Desktop/Condorlab/apps/web/src/app/api/revalidate/route.ts): اندپوینت ابطال بلادرنگ کش (`revalidateTag('store-products')`).
* **طرح جایگزینی در فاز ادمین:** فراخوانی خودکار اندپوینت `/api/revalidate` به هنگام تغییر موجودی، ویرایش قیمت یا انتشار آزمون جدید توسط ادمین.

### ۱.۷. زمان‌بندی بازه پنجره آزمون‌های رسمی (Time-Window Scheduling)
* **مسیر فایل‌ها:**
  * [`apps/api/src/modules/exams/exams.service.ts`](file:///Users/matinmousavi/Desktop/Condorlab/apps/api/src/modules/exams/exams.service.ts): پارامترهای `windowStartTime` و `windowEndTime` در رکوردهای ماک آزمون‌ها.
  * [`apps/api/src/modules/exam-room/exam-room.service.ts`](file:///Users/matinmousavi/Desktop/Condorlab/apps/api/src/modules/exam-room/exam-room.service.ts): متد `autoFinalizeExpiredExams` و ارزیابی تنبل خاتمه خودکار تلاش‌ها.
* **طرح جایگزینی در فاز ادمین:** تنظیم تقویم شمسی دقیق پنجره شروع و پایان آزمون‌ها در فرم ایجاد و ویرایش آزمون در `/admin/exams` متصل به فیلدهای `start_time` و `end_time` جدول `exams`.

### ۱.۸. معماری کش سراسری کلاینت و ابطال مبتنی بر رویداد (Global Smart Caching)
* **مسیر فایل‌ها:**
  * [`apps/web/src/context/app-cache-context.tsx`](file:///Users/matinmousavi/Desktop/Condorlab/apps/web/src/context/app-cache-context.tsx): کش داده‌های پروفایل کاربر، محصولات خریداری‌شده و آزمون‌های فعال با `staleTime: Infinity` و بازیابی همگام بدون اسپینر.
  * رویدادهای ابطال مبتنی بر Mutation: `condor:invalidate:purchases`، `condor:invalidate:exams` و `condor:invalidate:user`.
* **طرح پروداکشن:** هماهنگی با سوکت‌های بلادرنگ (WebSockets / SSE) برای ابطال سمت کلاینت هنگام انتشار آزمون جدید یا فعال‌سازی صندلی.

### ۱.۹. غیرفعال‌سازی موقت دیالوگ جستجوی سراسری Cmd+K
* **مسیر فایل:** [`apps/web/src/app/layout.tsx`](file:///Users/matinmousavi/Desktop/Condorlab/apps/web/src/app/layout.tsx)
* **وضعیت:** کامنت‌گذاری شده طبق دستور کاربر در Pillar 3 تا زمان توسعه سرچ موتور کامل.

### ۱.۱۰. پنل پایه مدیریت و پنل دیباگ توسعه‌دهنده (Admin & DevTools)
* **مسیر فایل‌ها:**
  * [`apps/web/src/app/admin/`](file:///Users/matinmousavi/Desktop/Condorlab/apps/web/src/app/admin/): صفحات پیشخوان (`/admin`)، مدیریت آزمون‌ها (`/admin/exams`)، بانک سؤالات (`/admin/exams/[id]/questions`)، محصولات (`/admin/products`) و کاربران (`/admin/users`).
  * [`apps/web/src/components/dev/devtools-overlay.tsx`](file:///Users/matinmousavi/Desktop/Condorlab/apps/web/src/components/dev/devtools-overlay.tsx): پنل شناور دیباگ با شورتکات `Ctrl+Shift+D` فعال منحصراً در `process.env.NODE_ENV === 'development'`.
  * [`apps/api/src/modules/admin/`](file:///Users/matinmousavi/Desktop/Condorlab/apps/api/src/modules/admin/): اندپوینت‌های مدیریت آزمون‌ها، محصولات، سؤالات و بازنشانی تلاش آزمون.

### ۱.۱۱. سیستم هویت‌پذیری واقعی کاربران تست در DevTools (Real DB User Impersonation)
* **مسیر فایل‌ها:**
  * [`apps/api/src/modules/auth/auth.service.ts`](file:///Users/matinmousavi/Desktop/Condorlab/apps/api/src/modules/auth/auth.service.ts): آرایه `DEDICATED_TEST_USERS` و متدهای `seedTestUsers` و `impersonate`.
  * [`apps/api/src/modules/auth/auth.controller.ts`](file:///Users/matinmousavi/Desktop/Condorlab/apps/api/src/modules/auth/auth.controller.ts): اندپوینت `POST /auth/impersonate`.
* **هدف و سازوکار:**
  * حذف قطعی ماک‌های کلاینت‌ساید (Split-Brain Auth) و صدور سشن واقعی در ردیس و کوکی HttpOnly مرورگر.
  * برقراری شناسه یکتای `user_id` در ۱۰۰٪ بخش‌های کاتالوگ، لابی، آزمون و خلاصه پاسخ‌برگ.
* **طرح جایگزینی در پروداکشن:** این اندپوینت در پروداکشن مسدود یا منحصراً محدود به نقش `MasterAdmin` جهت تست پشتیبانی خواهد بود.

---

## ۲. رکوردهای ثبت‌شده در دیتابیس (Manual DB Seeds)

| شناسه جدول / موجودیت | کلید یکتا / Slug / ID | عنوان / توضیحات | نحوه ایجاد |
|---|---|---|---|
| `exams` | `campbell-vol1-vol2-pilot-1` | شبیه‌ساز جامع جلد ۱ و ۲ بیولوژی کمپبل (پایلوت ۱) | سید اولیه دیتابیس |
| `exams` | `biology-olympiad-stage-1-pilot-2` | آزمون شبیه‌ساز مرحله اول المپیاد زیست‌شناسی (پایلوت ۲) | سید اولیه دیتابیس |
| `exams` | `advanced-molecular-genetics` | شبیه‌ساز تخصصی ژنتیک مولکولی و مهندسی ژنتیک (مرحله ۲) | سید اولیه دیتابیس |
| `exams` | `campbell-vip-masterclass` | کارگاه فشرده المپیاد زیست‌شناسی (تک‌ظرفیتی VIP) | سید اولیه دیتابیس |
| `exams` | `offline-resilience-1min-test` | آزمون شبیه‌ساز تست پایداری شبکه و بازیابی (۱ دقیقه‌ای) | پایلوت تست اضطراری |
| `coupons` | `HUNTER50` | تخفیف ۵۰٪ شکاری برای ۵۰ نفر اول | سید اولیه جدول تخفیف‌ها |
| `coupons` | `OLYMPIAD100` | کد تخفیف ۱۰۰٪ بورسیه دانش‌آموزان برتر | سید اولیه جدول تخفیف‌ها |
| `users` | `a0000000-0000-4000-8000-000000000001` | حساب مدیر ارشد کندرلب (`admin@condorlab.ir` - MasterAdmin) | سید خودکار حساب‌های تست اختصاصی |
| `users` | `a0000000-0000-4000-8000-000000000002` | حساب داوطلب دهم (`student.tenth@condorlab.ir` - آرتین رادمنش) | سید خودکار حساب‌های تست اختصاصی |
| `users` | `a0000000-0000-4000-8000-000000000003` | حساب داوطلب جدید بدون آزمون (`student.fresh@condorlab.ir` - سهراب سپهری) | سید خودکار حساب‌های تست اختصاصی |
| `users` | `a0000000-0000-4000-8000-000000000004` | حساب مسئول آزمون المپیاد (`officer@condorlab.ir` - ExamOfficer) | سید خودکار حساب‌های تست اختصاصی |

---

## ۳. دستورالعمل الزام ثبت برای توسعه‌دهندگان و ایجنت‌ها
> **قانون قطعی:** هر زمان که به دلیل عدم پیاده‌سازی بخش مدیریت، قابلیتی با داده‌های هاردکدشده یا رکوردهای پیش‌فرض پیاده‌سازی می‌شود:
> ۱. بلافاصله باید متغیر، نام فایل، خط و هدف آن در این سند افزوده شود.
> ۲. کامنت `// TODO(AdminPanel): Dynamic implementation from DB` در محل کد درج گردد.
