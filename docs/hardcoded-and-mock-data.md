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

---

## ۲. رکوردهای ثبت‌شده در دیتابیس (Manual DB Seeds)

| شناسه جدول / موجودیت | کلید یکتا / Slug | عنوان / توضیحات | نحوه ایجاد |
|---|---|---|---|
| `exams` | `campbell-vol1-vol2-pilot-1` | شبیه‌ساز جامع جلد ۱ و ۲ بیولوژی کمپبل (پایلوت ۱) | سید اولیه دیتابیس |
| `exams` | `biology-olympiad-stage-1-pilot-2` | آزمون شبیه‌ساز مرحله اول المپیاد زیست‌شناسی (پایلوت ۲) | سید اولیه دیتابیس |
| `exams` | `advanced-molecular-genetics` | شبیه‌ساز تخصصی ژنتیک مولکولی و مهندسی ژنتیک (مرحله ۲) | سید اولیه دیتابیس |
| `exams` | `campbell-vip-masterclass` | کارگاه فشرده المپیاد زیست‌شناسی (تک‌ظرفیتی VIP) | سید اولیه دیتابیس |
| `exams` | `offline-resilience-1min-test` | آزمون شبیه‌ساز تست پایداری شبکه و بازیابی (۱ دقیقه‌ای) | پایلوت تست اضطراری |
| `coupons` | `HUNTER50` | تخفیف ۵۰٪ شکاری برای ۵۰ نفر اول | سید اولیه جدول تخفیف‌ها |
| `coupons` | `OLYMPIAD100` | کد تخفیف ۱۰۰٪ بورسیه دانش‌آموزان برتر | سید اولیه جدول تخفیف‌ها |

---

## ۳. دستورالعمل الزام ثبت برای توسعه‌دهندگان و ایجنت‌ها
> **قانون قطعی:** هر زمان که به دلیل عدم پیاده‌سازی بخش مدیریت، قابلیتی با داده‌های هاردکدشده یا رکوردهای پیش‌فرض پیاده‌سازی می‌شود:
> ۱. بلافاصله باید متغیر، نام فایل، خط و هدف آن در این سند افزوده شود.
> ۲. کامنت `// TODO(AdminPanel): Dynamic implementation from DB` در محل کد درج گردد.
