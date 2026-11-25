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
| **Auth** | Signed HttpOnly cookies + Auth.js | جلسات موقّعة حسب الدور |

## الإعداد السريع

```bash
git clone https://github.com/mrhishamismail95-jpg/hisham-academy.git
cd hisham-academy
cp apps/web/.env.example apps/web/.env
# عدّل DATABASE_URL و ACADEMY_SESSION_SECRET و AUTH_SECRET
cd apps/web && bun install && bun run migrate && bun run dev
```

## النشر على Railway (موصى به)

1. [railway.app](https://railway.app) → **New Project** → **Deploy from GitHub** → `hisham-academy`
2. يكتشف تلقائياً `Dockerfile` و `railway.toml`
3. في **Variables** أضف:
   - `DATABASE_URL` (Neon)
   - `ACADEMY_SESSION_SECRET` / `AUTH_SECRET`
   - `AUTH_URL` = الرابط العام للخدمة
   - `NEXT_PUBLIC_CREATE_ENV=PRODUCTION`
4. (اختياري) فعّل `releaseCommand` في `railway.toml` لتشغيل الترحيلات
5. Deploy → اختبر `/api/health`

## النشر على Render

1. [render.com](https://render.com) → **New** → **Blueprint** → اختر `render.yaml`
2. أو Web Service + Docker (Root `.`, Dockerfile `Dockerfile`)
3. Health Check = `/api/health`
4. نفس متغيرات البيئة

## النشر بـ Docker

```bash
docker build -t hisham-academy .
docker run -p 3000:3000 --env-file .env hisham-academy
```

## النشر على Vercel

محدود لهذا المشروع (خادم Node طويل الأمد). التفاصيل في المستودع. الأفضل Railway/Render.

Root Directory عند التجربة: `apps/web`.

## GitHub Actions

- **CI** — اختبارات + بناء
- **Migrations Check** — فحص SQL
- **Deploy to Vercel** — اختياري (يحتاج أسرار)

## الأمان

لا ترفع `.env`. استخدم `.env.example` و `.env.deploy.example` كقوالب فقط.

## ربط التسجيل والباقات بقاعدة PostgreSQL

بعد ضبط `DATABASE_URL`، شغّل الترحيلات من مجلد التطبيق:

```bash
cd apps/web
npm install
npm run migrate
npm run build
npm start
```

ينشئ آخر migration جدولين: `registrations` لطلبات الطلاب وأولياء الأمور والمعلمين، و`academy_packages` للباقات والأسعار وعدد الحصص والعملات وحالة الظهور. الصفحة الرئيسية تجلب الباقات النشطة تلقائياً، ونموذج التسجيل يحفظ كل طلب مع كود مثل `HA-XXXXXX`.

واجهات API المتاحة:

```text
GET    /api/academy/packages          الباقات النشطة للصفحة العامة
POST   /api/academy/registrations     حفظ نموذج التسجيل العام
GET    /api/academy/registrations     قراءة الطلبات للإدارة
POST   /api/academy/packages          إضافة باقة
PATCH  /api/academy/packages/:id      تعديل باقة
DELETE /api/academy/packages/:id      إخفاء باقة
```

ضع `ADMIN_API_KEY` في بيئة الخادم لحماية عمليات إدارة الباقات وقراءة الطلبات. يظل جلب الباقات وتسجيل الطلبات متاحين للصفحة العامة. لاحقاً يُفضّل استبدال مفتاح الإدارة بتسجيل الدخول والجلسة الموقعة الموجودة في المشروع.

## الترخيص

MIT — انظر `LICENSE`.
