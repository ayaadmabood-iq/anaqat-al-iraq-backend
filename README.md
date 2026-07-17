# منصة القراءة القصدية — Backend (MVP v1)

> **Purposive Reading Platform** — منصة معرفية مستقلة للنشر والبحث والدراسات
> القرآنية والإنسانية، تعتمد منهج القراءة القصدية.
>
> شعار المشروع: **القرآن… كما يعرّف نفسه**.
>
> المالك: الدكتور إياد محمد عبود.

هذه هي الواجهة الخلفية (Backend API) للنسخة التأسيسية MVP v1، مبنية بـ
[NestJS](https://nestjs.com/) و [TypeORM](https://typeorm.io/) و PostgreSQL،
وتغطي كل ما نصّت عليه وثيقة التأسيس v1.0:

- تسجيل المستخدمين مع تحقق البريد الإلكتروني، والموافقة على سياسة الخصوصية
  وشروط الاستخدام.
- كتالوج كتب ومقالات متعدد اللغات (JSONB يقبل إضافة لغات دون تعديل الشيمة).
- تدفق شراء كامل يعتمد الحوالة المصرفية: إنشاء الطلب → عرض حسابات المصرف →
  رفع صورة الحوالة → مراجعة الإدارة → اعتماد → إنشاء نسخة شخصية → تنزيل.
- حماية كل نسخة مباعة عبر:
  - Watermark مرئي على كل صفحة يحمل اسم المشتري وبريده ورقم الطلب
  - علامة UUID + رقم الطلب في الحاشية
  - Metadata موقّعة داخل ملف PDF
  - صفحة "شهادة نسخة شخصية" في نهاية الكتاب تحمل بيانات المشتري وحمولة JSON
  - Hash تشفيري (SHA-256) لكل ملف مُنتَج، مخزَّن في سجل البصمة
- لوحة إدارة كاملة: كتب/مقالات/حسابات مصرفية/طلبات/عملاء/تقارير/سجل تنزيلات
  والبحث بواسطة UUID لأي نسخة.
- سجل تدقيق `Audit Log` لكل حدث حساس (تسجيل، دخول، رفع حوالة، اعتماد، تنزيل).

---

## المكدس التقني

| الطبقة       | التقنية                                |
|--------------|----------------------------------------|
| Runtime      | Node.js 18+                            |
| Framework    | NestJS 10 (Express)                    |
| Language     | TypeScript 5                           |
| Database     | PostgreSQL 12+ (`jsonb`)               |
| ORM          | TypeORM 0.3                            |
| Auth         | Passport + JWT + bcrypt                |
| PDF stamping | `pdf-lib`                              |
| Uploads      | Multer (disk storage)                  |
| Validation   | class-validator / class-transformer    |

---

## تشغيل سريع

```bash
# 1) تثبيت الاعتمادات
npm install

# 2) إعداد البيئة
cp .env.example .env
#   حدِّث DB_PASSWORD و JWT_SECRET و ADMIN_PASSWORD

# 3) بذر قاعدة البيانات (يُنشئ الشيمة + الأدمن + الكتب الثلاثة + حسابات المصارف)
npm run seed

# 4) تشغيل الوضع التطويري
npm run start:dev
```

الخادم يعمل على `http://localhost:3000/api/v1`.

---

## مخطط المجلدات

```
src/
├── config/                     # إعداد قاعدة البيانات
├── database/
│   ├── entities/               # 11 كيان: users, books, orders, issued_copies, ...
│   ├── seed.ts                 # بذر البيانات
│   └── index.ts                # تصدير موحد
├── modules/
│   ├── auth/                   # التسجيل، التحقق، الدخول، JWT، الأدوار
│   ├── users/                  # لوحة العملاء (إدارة)
│   ├── books/                  # كتالوج الكتب + إدارة
│   ├── articles/               # مقالات مجانية + إدارة
│   ├── bank-accounts/          # حسابات الحوالة (تديرها الإدارة)
│   ├── orders/                 # تدفق الشراء الكامل
│   ├── fingerprint/            # توليد النسخة الشخصية + Watermark + Hash
│   ├── downloads/              # التنزيل الآمن + سجل التنزيلات
│   ├── admin/                  # ملخص، تقارير، البحث بـ UUID
│   ├── audit/                  # AuditLog (Global)
│   └── mail/                   # مُرسل روابط التحقق (log driver في MVP)
├── app.module.ts
└── main.ts
storage/
├── books/                      # الأصول الرئيسية (Master PDF لكل كتاب)
├── generated/                  # النسخ الشخصية المُولَّدة
└── transfers/                  # صور الحوالات المرفوعة
```

---

## متغيرات البيئة

| المتغير               | افتراضي                | الوصف                                                       |
|-----------------------|------------------------|-------------------------------------------------------------|
| `PORT`                | `3000`                 | منفذ HTTP                                                   |
| `DB_HOST/PORT/…`      | localhost/5432         | إعداد PostgreSQL                                             |
| `DB_DATABASE`         | `qasdiya_platform`     | اسم قاعدة البيانات                                          |
| `JWT_SECRET`          | —                      | سرّ توقيع JWT (غيّره قبل النشر)                             |
| `JWT_EXPIRES_IN`      | `7d`                   | عمر التوكن                                                  |
| `BCRYPT_ROUNDS`       | `12`                   | جولات تجزئة كلمة المرور                                     |
| `STORAGE_ROOT`        | `./storage`            | جذر التخزين                                                 |
| `BOOKS_SOURCE_DIR`    | `./storage/books`      | مصدر الـ Master PDF                                          |
| `GENERATED_DIR`       | `./storage/generated`  | مكان النسخ الشخصية                                          |
| `TRANSFERS_DIR`       | `./storage/transfers`  | مكان صور الحوالات                                           |
| `MAIL_DRIVER`         | `log`                  | `log` يطبع رابط التحقق في الـLog؛ لاحقاً بدّله بـ smtp    |
| `PUBLIC_BASE_URL`     | `http://localhost:3000`| يُستخدَم في بناء رابط التحقق                                |
| `WATERMARK_TEXT_AR`   | (نص افتراضي)           | نص العلامة المرئية بالعربي                                  |
| `WATERMARK_TEXT_EN`   | (نص افتراضي)           | نص العلامة المرئية بالإنجليزي                               |
| `ADMIN_EMAIL/PASSWORD`| —                      | بيانات المدير الافتراضي (تُنشأ في `npm run seed`)          |

انظر [`.env.example`](./.env.example).

---

## نقاط API

جميع النقاط تبدأ بـ `/api/v1`.

### التوثيق (Auth)

| الطريقة | المسار                        | الوصف                                        |
|--------|-------------------------------|-----------------------------------------------|
| POST   | `/auth/register`              | تسجيل مستخدم جديد (يرسل رابط تحقق)            |
| GET    | `/auth/verify?token=…`        | تأكيد البريد                                  |
| POST   | `/auth/login`                 | دخول (يُرجع JWT)                              |
| POST   | `/auth/forgot-password`       | طلب رابط استعادة (لا يُفصح عن وجود الحساب)   |
| POST   | `/auth/reset-password`        | إعادة تعيين كلمة المرور بالتوكن               |
| POST   | `/auth/change-password`       | تغيير كلمة المرور للحساب المسجَّل            |
| GET    | `/auth/me`                    | بيانات المستخدم الحالي                        |
| PATCH  | `/auth/me`                    | تعديل الملف الشخصي                            |

### الكتب والمقالات والتصنيفات والمحتوى (عامة)

| الطريقة | المسار                                              | الوصف                                        |
|--------|-----------------------------------------------------|-----------------------------------------------|
| GET    | `/books?lang=&q=&category=&featured=`               | قائمة الكتب المنشورة (بحث/تصنيف/مميز)         |
| GET    | `/books/:slug?lang=ar`                              | تفاصيل كتاب                                   |
| GET    | `/books/:slug/sample`                               | تنزيل المقدمة المجانية (PDF)                  |
| GET    | `/book-categories?lang=ar`                          | التصنيفات المنشورة                            |
| GET    | `/articles?lang=&q=&category=&tag=`                 | قائمة المقالات المنشورة                       |
| GET    | `/articles/:slug?lang=ar`                           | قراءة مقال (مع SEO meta)                      |
| GET    | `/content/:key`                                     | صفحات CMS (home_hero/about/founder/faq/contact) |

### الحسابات المصرفية (للمستخدم عند الشراء)

| الطريقة | المسار                        | الوصف                                        |
|--------|-------------------------------|-----------------------------------------------|
| GET    | `/bank-accounts`              | الحسابات النشطة لعرضها للمشتري                |

### الطلبات (المستخدم)

| الطريقة | المسار                                    | الوصف                                       |
|--------|-------------------------------------------|----------------------------------------------|
| POST   | `/orders`                                 | إنشاء طلب + الموافقة على اتفاقية الشراء      |
| GET    | `/orders`                                 | طلبات المستخدم                               |
| GET    | `/orders/:id`                             | تفاصيل طلب                                   |
| POST   | `/orders/:id/transfer-proof` (multipart)  | رفع صورة الحوالة (image/pdf ≤ 8MB)          |
| POST   | `/orders/:id/reissue-copy`                | إعادة إنشاء النسخة الشخصية بنفس UUID       |

### التنزيل

| الطريقة | المسار                        | الوصف                                        |
|--------|-------------------------------|-----------------------------------------------|
| GET    | `/downloads/order/:orderId`   | تنزيل النسخة الشخصية (يُسجَّل في السجل)      |

### الإدارة (`admin` فقط)

| الطريقة | المسار                                    | الوصف                                       |
|--------|-------------------------------------------|----------------------------------------------|
| GET    | `/admin/summary`                                    | ملخص المنصة                                  |
| GET    | `/admin/reports/sales?from=&to=`                    | تقرير المبيعات (finance_manager)             |
| GET    | `/admin/reports/best-selling?limit=10`              | الكتب الأكثر مبيعاً                          |
| GET    | `/admin/reports/pending-orders`                     | الطلبات المعلقة                              |
| GET    | `/admin/lookup/copy/:uuid`                          | بحث سريع بالـUUID                            |
| GET    | `/admin/lookup/copy/:uuid/report`                   | تقرير فني كامل (§10 من ملف Publishing Engine) |
| GET    | `/admin/lookup/copies?buyer=&order=`                | بحث بالنسخ باسم المشتري أو رقم الطلب         |
| GET/POST/PATCH `/admin/books`                       |                                              | إدارة الكتب                                   |
| POST   | `/admin/books/:id/publish` / `/suspend`             | نشر أو إيقاف كتاب                            |
| GET/POST/PATCH/DELETE `/admin/book-categories`      |                                              | إدارة التصنيفات                               |
| GET/POST/PATCH/DELETE `/admin/articles`             |                                              | إدارة المقالات                                |
| GET/PUT/DELETE `/admin/content/:key`                |                                              | إدارة صفحات CMS                              |
| GET/POST/PATCH/DELETE `/admin/bank-accounts`        |                                              | إدارة حسابات الحوالة                          |
| GET    | `/admin/orders?status=&q=`                          | كل الطلبات مع بحث نصي                        |
| POST   | `/admin/orders/:id/approve`                         | اعتماد الطلب → يُولِّد النسخة الشخصية       |
| POST   | `/admin/orders/:id/reject`                          | رفض الطلب مع ذكر السبب                       |
| GET/POST `/admin/customers`                         |                                              | العملاء (بحث/تفعيل/تعطيل)                    |
| GET    | `/admin/downloads?limit=`                           | آخر عمليات التنزيل                          |

راجع [`docs/RBAC.md`](./docs/RBAC.md) لأي من الأدوار الست يستطيع الوصول
إلى كل نقطة.

---

## دورة حياة الطلب (§8)

```
اختيار الكتاب
      │
      ▼
POST /orders  (agreementAccepted=true)  ── حالة: pending_payment
      │
      ▼
GET /bank-accounts  (عرض حسابات الرافدين وTBI)
      │
      ▼
POST /orders/:id/transfer-proof (multipart image/pdf)  ── حالة: awaiting_review
      │
      ▼
POST /admin/orders/:id/approve
      │  ├─ توليد PDF شخصي (visible + hidden watermark + hash)
      │  ├─ حفظ IssuedCopy مع copyUuid و fileSha256
      │  └─ حالة: fulfilled
      ▼
GET /downloads/order/:orderId  (يُسجَّل في DownloadLog + AuditLog)
```

---

## حماية النسخة (§9)

كل نسخة تُولَّد فور اعتماد الطلب، وتتضمن:

1. **Watermark مرئي** قطري خفيف على كل صفحة يحمل اسم المشتري وبريده ورقم الطلب.
2. **UUID + رقم الطلب** في حواشي كل صفحة.
3. **Metadata** داخل ملف PDF (Title, Author, Subject, Keywords) تحمل
   `copy_uuid` و `order`.
4. **صفحة شهادة نهائية** فيها بيانات المشتري كاملة وحمولة JSON للبصمة.
5. **SHA-256** للنسخة كاملة، يُحفَظ في جدول `issued_copies.fileSha256`.
6. **سجل بصمة (IssuedCopy)** يربط كل ملف بالمشتري، الكتاب، والطلب، مع تاريخ
   الإصدار.

لا يُحتفَظ بنسخة جاهزة لكل عميل: النسخة تُعاد كتابتها من الأصل عند كل
اعتماد، والمعرفات ثابتة (نفس copy_uuid) عند إعادة الإصدار لنفس الطلب.

---

## الأدوار (RBAC)

المرجع التأسيسي IRPB §7 يعرّف ستة أدوار:

- `super_admin` — صاحب المنصة (يُنشأ افتراضياً عبر `npm run seed`).
- `admin` — مدير عام.
- `content_manager` — كتب، مقالات، تصنيفات، CMS.
- `finance_manager` — طلبات، حسابات مصرفية، تقارير مالية.
- `support` — قراءة العملاء والنسخ والتقارير الفنية.
- `customer` (افتراضي) — الشراء والتنزيل.

انظر [`docs/RBAC.md`](./docs/RBAC.md) للمصفوفة الكاملة.

---

## سجل التدقيق (§11)

يُسجَّل كل حدث حساس في جدول `audit_logs` مع: من فعل، ما فعل، على أي كيان،
البيانات المرفقة، وعنوان IP. الأحداث المُغطّاة حالياً:

- `user.registered`, `user.email_verified`, `user.login`
- `order.created`, `order.transfer_uploaded`, `order.approved`, `order.rejected`
- `copy.downloaded`

---

## المبادئ غير القابلة للتغيير (§13)

- القرآن هو المرجعية العليا للمشروع.
- المنهج المعتمد هو **القراءة القصدية**.
- جميع البيانات والأكواد والحقوق ملك للدكتور إياد محمد عبود.
- لا يجوز ربط المنصة بمزود أو مبرمج واحد؛ الشيمة والاعتمادات مفتوحة وقابلة
  للتراجع.
- كل التطويرات قابلة للتوسع دون إعادة بناء (لغات جديدة تُضاف كمفتاح JSONB،
  حالات جديدة تُضاف بدون كسر التدفق).

---

## خارطة الطريق (§12)

- **v1 (MVP)** — بيع الكتب بالحوالة (هذا الإصدار).
- **v2** — EPUB محمي، عضويات، قراءة داخل الموقع.
- **v3** — مساعد ذكاء اصطناعي يعتمد حصراً على محتوى المنصة.
- **v4** — دار نشر رقمية، مؤلفون، مؤتمرات، مركز أبحاث.

---

## وثائق مرفقة

- [`docs/CONSTITUTION.md`](./docs/CONSTITUTION.md) — دستور المنصة (IRPB §8) وقائمة التسليم.
- [`docs/RBAC.md`](./docs/RBAC.md) — الأدوار الستة ومصفوفة الصلاحيات.
- [`docs/OPERATIONS.md`](./docs/OPERATIONS.md) — دليل التشغيل الإداري اليومي.
- [`docs/DEPLOYMENT.md`](./docs/DEPLOYMENT.md) — نشر VPS + Nginx + systemd + TLS + بريد.
- [`docs/BACKUP.md`](./docs/BACKUP.md) — نسخ احتياطية يومية/أسبوعية/شهرية + Restore drill.

## الرخصة

جميع الحقوق محفوظة للدكتور إياد محمد عبود. الاستخدام والنشر مقيّدان.
