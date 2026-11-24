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

> **مهم:** لا ترفع ملف `.env` إلى Git أبدًا.

### 3. تثبيت وتشغيل

```bash
cd apps/web
bun install
bun run migrate
bun run dev
```

### 4. ترحيلات قاعدة البيانات

1. `db/migrations/20261124_booking_system.sql`
2. `db/migrations/20261124_booking_hardening.sql`
3. `db/migrations/20261125_uploaded_files.sql`

أو: `cd apps/web && bun run migrate`

### 5. البناء والإنتاج

```bash
cd apps/web && bun run build && bun run start
```

**Docker:**

```bash
docker build -t hisham-academy .
docker run -p 3000:3000 --env-file apps/web/.env hisham-academy
```

## النشر على Vercel

### تحذير مهم عن المعمارية

هذا المشروع يعمل حالياً كـ **خادم Node طويل الأمد** عبر `react-router-hono-server`.

Vercel يعتمد على **Serverless Functions**. لذلك:

| المنصة | التوافق | ملاحظة |
|--------|---------|--------|
| **Railway / Render / Fly.io / Docker** | ممتاز | الأنسب بدون تعديل كبير |
| **Vercel** | محدود | يحتاج تكييف مع `@vercel/react-router` أو Web Handler |

### خطوات ربط Vercel (بعد رفع الكود الكامل)

1. [vercel.com](https://vercel.com) → **Add New Project** → استورد `hisham-academy`.
2. **Root Directory** = `apps/web`.
3. **Framework Preset** = Other.
4. أضف المتغيرات من `apps/web/.env.vercel.example`:
   - `DATABASE_URL`
   - `ACADEMY_SESSION_SECRET`
   - `AUTH_SECRET`
   - `AUTH_URL` = رابط المشروع على Vercel
   - `NEXT_PUBLIC_CREATE_ENV=PRODUCTION`
5. Deploy.

إذا فشل البناء: استخدم **Railway** أو **Render** مع الـ Dockerfile (موصى به).

### GitHub Action لـ Vercel (اختياري)

`.github/workflows/deploy-vercel.yml` يحتاج الأسرار:
`VERCEL_TOKEN` · `VERCEL_ORG_ID` · `VERCEL_PROJECT_ID`

### بديل موصى به: Railway

```bash
railway up
```

## GitHub Actions (CI)

| Workflow | الوظيفة |
|----------|--------|
| **CI** | اختبارات + typecheck + build |
| **Migrations Check** | فحص ملفات SQL |
| **Deploy to Vercel** | نشر اختياري (يحتاج أسرار) |

## الأمان

- حماية مركزية لـ `/api/*`
- جلسات HttpOnly موقّعة
- لا أسرار في الكود

## الترخيص

MIT — انظر `LICENSE`.
