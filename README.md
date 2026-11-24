# Hisham Academy

منصة أكاديمية متكاملة لإدارة الطلاب والمعلمين والحجوزات والمدفوعات والحضور.

**Full-stack academy management platform** — students, teachers, bookings, payments, attendance, and admin portal.

---

## المكونات / Stack

| الجزء | التقنية | الوصف |
|-------|---------|-------|
| **Web** (`apps/web`) | React Router 7 · Vite · Bun · Tailwind · Hono | لوحة الإدارة + بوابة المعلم + بوابة الطالب + نظام الحجوزات |
| **Mobile** (`apps/mobile`) | Expo / React Native | تطبيق الجوال |
| **Database** | PostgreSQL (Neon) | ترحيلات SQL في `db/migrations/` |
| **Auth** | Signed HttpOnly cookies + Auth.js | جلسات موقّعة حسب الدور (admin / teacher / student) |

## الميزات الرئيسية

- إدارة الإداريين والمعلمين والطلاب
- نظام حجز حصص خاصة (مقعد واحد) وجماعية مع إثبات الدفع ومراجعة المعلم
- تسجيل الحضور للحجوزات
- رفع ملفات (إيصالات دفع، امتحانات) مخزنة في Postgres (حد 4MB، صور/PDF فقط)
- تقارير مالية
- حماية مركزية لجميع مسارات `/api/*` حسب الدور
- جلسة خادم موقّعة (HttpOnly cookie)

## المتطلبات

- [Bun](https://bun.sh) (موصى به) أو Node.js 20+
- PostgreSQL (Neon موصى به)
- متغيرات البيئة (انظر `apps/web/.env.example`)

## الإعداد السريع

### 1. استنساخ المستودع

```bash
git clone https://github.com/mrhishamismail95-jpg/hisham-academy.git
cd hisham-academy
```

### 2. إعداد البيئة

```bash
cp apps/web/.env.example apps/web/.env
```

عدّل القيم في `.env`:

```env
DATABASE_URL=postgresql://USER:PASSWORD@HOST/DBNAME?sslmode=require
ACADEMY_SESSION_SECRET=  # openssl rand -base64 32
AUTH_SECRET=             # openssl rand -base64 32
AUTH_URL=http://localhost:4000
NEXT_PUBLIC_CREATE_ENV=PRODUCTION
```

> **مهم:** لا ترفع ملف `.env` إلى Git أبدًا. الـ `.gitignore` يمنع ذلك.

### 3. تثبيت وتشغيل

```bash
cd apps/web
bun install
bun run migrate   # بعد أخذ نسخة احتياطية من قاعدة البيانات
bun run dev
```

التطبيق يعمل عادة على المنفذ الذي يظهره React Router (غالبًا 4000 أو 5173).

### 4. ترحيلات قاعدة البيانات

نفّذ بالترتيب (بعد نسخة احتياطية):

1. `db/migrations/20261124_booking_system.sql`
2. `db/migrations/20261124_booking_hardening.sql`
3. `db/migrations/20261125_uploaded_files.sql`

تأكد أن أنواع `students.id` و `teachers.id` متوافقة مع `BIGINT`.

أو:

```bash
cd apps/web && bun run migrate
```

### 5. البناء والإنتاج

```bash
cd apps/web
bun run build
bun run start
```

**Docker** (من جذر المشروع):

```bash
docker build -t hisham-academy .
docker run -p 3000:3000 --env-file apps/web/.env hisham-academy
```

## هيكل المشروع

```
hisham-academy/
├── apps/
│   ├── web/                    # تطبيق الويب (الأساسي)
│   │   ├── src/
│   │   │   ├── app/            # الصفحات + API routes
│   │   │   ├── components/     # admin / teacher / student
│   │   │   └── utils/          # session, apiPolicy, ...
│   │   ├── scripts/
│   │   ├── .env.example
│   │   └── package.json
│   └── mobile/                 # تطبيق Expo
├── db/migrations/              # ترحيلات SQL
├── shared/                     # كود مشترك
├── Dockerfile
├── BOOKING_SYSTEM_SETUP.md
├── IMPLEMENTATION_NOTES_AR.md
└── README.md
```

## الأمان

- كل مسارات `/api/*` محمية بسياسة مركزية (`apps/web/src/utils/apiPolicy.js`)
- الجلسات موقّعة بـ `ACADEMY_SESSION_SECRET`
- رفع الملفات: فحص النوع من المحتوى + يتطلب جلسة
- تسجيل الدخول محدود بعدد المحاولات
- لا أسرار في الكود

## الاختبارات

```bash
cd apps/web
bun run test
```

## ملاحظات

- راجع `IMPLEMENTATION_NOTES_AR.md` و `BOOKING_SYSTEM_SETUP.md` للتفاصيل التقنية عن نظام الحجز والحماية.
- بعض الملفات تحت `__create` جزء من بنية الخادم (Hono + Auth) وما زالت مستخدمة.
- تطبيق الجوال يحتاج إعداد EAS منفصل.

## GitHub Actions (CI)

يتم تشغيل الفحوصات تلقائياً على كل push و Pull Request إلى `main`:

| Workflow | الوظيفة |
|----------|--------|
| **CI** | تثبيت الاعتماديات، اختبارات الوحدة (Vitest)، typecheck، ومحاولة البناء |
| **Migrations Check** | التحقق من ملفات SQL عند تغيير الترحيلات |

يمكن تشغيلها يدوياً من تبويب **Actions** في المستودع.

## الترخيص

MIT License — انظر ملف `LICENSE`.

---

**تم تجهيز هذا المستودع للنشر على GitHub مع تنظيف الأسرار وملفات البيئة وملفات البناء.**
