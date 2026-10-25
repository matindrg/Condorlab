# کندرلب — Condorlab

> **مخزن اسناد جامع محصول، معماری فنی، مشخصات امنیتی و نمونه‌ی فنی قفل آزمون**  
> پلتفرم تخصصی سنجش تحلیلی، آزمون‌های جلد‌به‌جلد کمپبل و آموزش نخبگانی المپیاد زیست‌شناسی ایران.

[![status](https://img.shields.io/badge/status-pre--development-yellow)](docs/CONDORLAB_ROADMAP_FA.md)
[![phase](https://img.shields.io/badge/phase-A%20%7C%20MVP%202.3-blue)](docs/CONDORLAB_MVP_FA.md)
[![docs](https://img.shields.io/badge/docs-PRD%203.3-informational)](docs/CONDORLAB_PRD_FA-V3.md)

---

## درباره‌ی پروژه

**کندرلب (Condorlab)** پس از ۲ سال وقفه، در حال بازگشت قدرتمند به اکوسیستم المپیاد زیست‌شناسی ایران است. هسته اصلی تمایز پلتفرم، ارائه آزمون‌های سرفصلی **جلد‌به‌جلد بیولوژی کمپبل (در دو سطح مقدماتی و پیشرفته)**، کارنامه تحلیلی متصل به بانک دانش، برگزاری آزمون در دو حالت هم‌زمان (PDF و سؤالات وب)، و سامانه فعال ضدتقلب است.

**فاز فعلی (A — بازگشت و دو پایلوت متوالی):**
- **پایلوت ۱ (رایگان):** شبیه‌ساز کمپبل جهت ایجاد هایپ بازگشت، تست بار ۲۰۰ کاربر هم‌زمان و راستی‌آزمایی قفل سشن.
- **پایلوت ۲ (پولی با کوپن شکاری):** آزمون با قیمت مصوب، سقف ظرفیت محدود (R-58) و کد تخفیف برای ۵۰ نفر اول (R-59) جهت تست درگاه پرداخت و تسویه.

---

## ساختار مخزن (Monorepo) و اسناد

```
Condorlab/
├── apps/
│   ├── web/                            # 🌐 برنامه فرانت‌اند (Next.js 15 App Router + React 19)
│   └── api/                            # ⚙️ وب‌سرویس بک‌اند و بات تلگرام (NestJS + Telegraf)
│
├── packages/
│   ├── database/                       # 🗄️ لایه داده و پایگاه‌داده (Prisma ORM + PostgreSQL)
│   ├── shared/                         # 📦 پکیج تایپ‌ها، DTOها، و دیکشنری متون R-63
│   └── config/                         # 🛠️ کانفیگ‌های اشتراکی TypeScript، ESLint و Tailwind
│
├── docs/                               # 📚 اسناد جامع معماری، محصول و مشخصات فنی
│   ├── CONDORLAB_PRODUCT_BRIEF_FA.md   # 🎯 بریف محصول (۳٫۰)
│   ├── CONDORLAB_PRD_FA-V3.md          # 📘 سند نیازمندی‌های محصول (۳٫۳)
│   ├── CONDORLAB_MVP_FA.md             # 📋 سند اجرایی فاز A (۲٫۳)
│   ├── CONDORLAB_TECH_STACK_FA.md      # ⚙️ معماری فنی و پلتفرم (۱٫۱)
│   ├── CONDORLAB_TECH_ECOSYSTEM_FA.md  # 🛠️ اکوسیستم فریم‌ورک‌ها و ابزارها (۱٫۰)
│   ├── CONDORLAB_TELEGRAM_BOT_SPEC_FA.md # 🤖 معماری و جریان‌های بات تلگرام (۱٫۰)
│   ├── CONDORLAB_DATA_ARCHITECTURE_FA.md # 🗄️ مدل داده و اسکیمای دیتابیس (۱٫۰)
│   ├── CONDORLAB_ANTI_CHEAT_FA.md      # 🛡️ سامانه ضدتقلب و سشن‌لاک (۱٫۰)
│   ├── CONDORLAB_AUTH_SPEC_FA.md       # 🔑 معماری احراز هویت (۱٫۰)
│   ├── CONDORLAB_WIREFRAMES_FA.md      # 🖼️ وایرفریم‌ها و چیدمان تعاملی (۱٫۰)
│   ├── CONDORLAB_USER_FLOW_FA.md       # 🔀 جریان‌های کاربر (۱٫۳)
│   ├── CONDORLAB_SITEMAP_FA.md         # 🗺️ سایت‌مپ و ساختار URLها (۱٫۳)
│   ├── CONDORLAB_UX_GUIDE_FA.md        # 📱 راهنمای تجربه کاربری و موبایل‌فرست (۱٫۱)
│   ├── CONDORLAB_EMAIL_TEMPLATES_FA.md # ✉️ الگوهای ایمیل‌های تراکنشی (۱٫۰)
│   ├── CONDORLAB_GAMIFICATION_SPEC_FA.md # 🏆 موتور گیمیفیکیشن Condor Arena (۱٫۰)
│   ├── CONDORLAB_SECURITY_FA.md        # 🔒 امنیت و انطباق OWASP (۱٫۰)
│   ├── CONDORLAB_LAUNCH_CHECKLIST_FA.md # 🚀 چک‌لیست عملیاتی روز لانچ (۱٫۰)
│   ├── CONDORLAB_ROADMAP_FA.md         # 🧭 نقشه راه تا دروازه سبز G1 (۱٫۲)
│   └── CONDORLAB_CONTENT_PLAN_1405_FA.md # 📚 برنامه تولید محتوای سال ۱۴۰۵
│
├── docker/                             # 🐳 فایل‌های داکر و کانتینرسازی
│   ├── docker-compose.yml              # ارکستراسیون سرویس‌های دیتابیس، ردیس و کانتینرها
│   ├── Dockerfile.web                  # کانتینر ایزوله فرانت‌اند
│   └── Dockerfile.api                  # کانتینر ایزوله بک‌اند
│
├── archive/                            # 📦 کدهای آرشیوشده و نمونه‌های مرجع
│   └── session-lock/                   # 🔒 نمونه مرجع پیاده‌سازی‌شده قفل فعال (Redis + Express)
└── README.md                           # راهنمای اصلی مخزن
```

---

## ماتریس اسناد پروژه

| سند | نسخه | حوزه | مخاطب | وضعیت |
| :--- | :---: | :--- | :--- | :---: |
| [بریف محصول](docs/CONDORLAB_PRODUCT_BRIEF_FA.md) | ۳٫۰ | استراتژی، پیام بازگشت، تمایز کمپبل و پرسونای پایه‌های ۹ تا ۱۱ | تیم محصول و مارکتینگ | مصوب |
| [PRD](docs/CONDORLAB_PRD_FA-V3.md) | ۳٫۳ | مرجع واحد کلیه قواعد سیستم، ظرفیت (R-58)، کوپن شکاری (R-59)، بانک دانش (R-60) | فنی، محصول، مدیریت | مصوب |
| [MVP](docs/CONDORLAB_MVP_FA.md) | ۲٫۳ | اسکوپ اجرایی فاز A، دو پایلوت متوالی، تیم ۱ نفره + AI در ۳–۴ هفته | تیم فنی و اجرایی | مصوب |
| [برنامه محتوا](docs/CONDORLAB_CONTENT_PLAN_1405_FA.md) | ۱۴۰۵ | بودجه، بازه انتشار، آزمون‌های کمپبل و کلاس‌های اساتید | تیم علمی و محتوا | مصوب |
| [جریان کاربر](docs/CONDORLAB_USER_FLOW_FA.md) | ۱٫۳ | ۲۳ سناریوی تعاملی کاربر، اتاق آزمون دوگانه و کارنامه متصل به کمپبل | طراحی و فرانت‌اند | مصوب |
| [سایت‌مپ](docs/CONDORLAB_SITEMAP_FA.md) | ۱٫۳ | ساختار صفحات، کنترل دسترسی، ایندکس و مسیر ایمپورت CSV | فرانت‌اند و سئو | مصوب |
| [راهنمای UX](docs/CONDORLAB_UX_GUIDE_FA.md) | ۱٫۱ | استانداردهای بارگذاری اسکلت (CLS ≈ ۰) و الزامات موبایل‌فرست ۳۲۰px | طراحی و فرانت‌اند | مصوب |
| [وایرفریم‌ها](docs/CONDORLAB_WIREFRAMES_FA.md) | ۱٫۰ | چیدمان ۶ صفحه حیاتی، اسکلت‌های تعاملی، مدال تیک‌اوور و سازگاری ۳۲۰px | فرانت‌اند و طراحی | مصوب |
| [الگوهای ایمیل](docs/CONDORLAB_EMAIL_TEMPLATES_FA.md) | ۱٫۰ | ۵ الگوی ایمیل تراکنشی، متغیرها، رکوردهای SPF/DKIM/DMARC و ضد فیشینگ | فرانت‌اند، بک‌اند و محصول | مصوب |
| [استک فنی](docs/CONDORLAB_TECH_STACK_FA.md) | ۱٫۱ | مونوپکیج TypeScript، Next.js، NestJS، Postgres و Redis | تیم توسعه | مصوب |
| [اکوسیستم و ابزارها](docs/CONDORLAB_TECH_ECOSYSTEM_FA.md) | ۱٫۰ | شناسنامه فریم‌ورک‌ها، GSAP، لایبرری‌های موشن، ORM و اسکیل‌ها | تیم توسعه و طراحی | مصوب |
| [بات تلگرام](docs/CONDORLAB_TELEGRAM_BOT_SPEC_FA.md) | ۱٫۰ | معماری Deep Linking، سرورلس کلودفلر، پشتیبانی و توزیع منابع | تیم توسعه و پروداکت | مصوب |
| [معماری Auth](docs/CONDORLAB_AUTH_SPEC_FA.md) | ۱٫۰ | کوکی‌های HttpOnly، سقف ۲ نشست (FIFO)، گوگل و آمادگی OTP | بک‌اند و امنیت | مصوب |
| [معماری داده](docs/CONDORLAB_DATA_ARCHITECTURE_FA.md) | ۱٫۰ | اسکیمای کامل جداول، ERD، دفترکل تغییرناپذیر و کلیدهای ردیس | دیتابیس و بک‌اند | مصوب |
| [سامانه ضدتقلب](docs/CONDORLAB_ANTI_CHEAT_FA.md) | ۱٫۰ | قفل سشن ردیس، Takeover دوگانه، ذخیره آفلاین و تله‌متری فرانت | بک‌اند و فرانت‌اند | مصوب |
| [گیمیفیکیشن](docs/CONDORLAB_GAMIFICATION_SPEC_FA.md) | ۱٫۰ | استریک چالش روزانه کمپبل، سطوح شش‌گانه المپیاد، ریتینگ پویا | پروداکت و گیمیفیکیشن | مصوب |
| [امنیت سیستم](docs/CONDORLAB_SECURITY_FA.md) | ۱٫۰ | چک‌لیست OWASP ASVS سطح ۲، هدرهای CSP/HSTS و محدودیت نرخ | امنیت و DevOps | مصوب |
| [چک‌لیست لانچ](docs/CONDORLAB_LAUNCH_CHECKLIST_FA.md) | ۱٫۰ | ران‌بوک عملیاتی، تست بار ۲۰۰ کاربر، T-7 فال‌بک و سناریوی روز آزمون | مدیر آزمون و DevOps | مصوب |
| [نقشه راه](docs/CONDORLAB_ROADMAP_FA.md) | ۱٫۲ | مراحل آماده‌سازی پیش از کدنویسی و دروازه سبز G1 | مالک و مدیریت | مصوب |

---

## نمونه‌ی فنی مرجع: `archive/session-lock/`

این مخزن شامل یک پیاده‌سازی واقعی و آماده با **Node.js/TypeScript + Redis 7 + React Hooks** است که در پوشه‌ی [`archive/session-lock/`](archive/session-lock/) قرار دارد و رفتار قفل فعال، مکانیزم Takeover و همگام‌سازی آفلاین را در عمل اثبات می‌کند.

```bash
cd archive/session-lock
cp .env.example .env
docker compose up -d          # اجرای ردیس ۷ محلی
npm install
npm run build                 # تایید تایپ‌چک و بیلد
npm run dev                   # اجرای سرور تست روی پورت ۳۰۰۰
```
