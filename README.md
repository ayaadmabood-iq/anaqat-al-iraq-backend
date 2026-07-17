# المشروع القصدي — al-qasdi-project

> **Purposive Reading Platform** — منصة معرفية مستقلة للنشر والبحث والدراسات
> القرآنية والإنسانية، تعتمد منهج القراءة القصدية.
>
> شعار المشروع: **القرآن… كما يعرّف نفسه**.
>
> المالك: الدكتور إياد محمد عبود.
>
> الإصدار: **v1.0.0-rc1** (Release Candidate — يُنقل مستودعُه إلى
> `al-qasdi-project` عبر `bash scripts/mirror-to-new-repo.sh <url>`).

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

القيم الحساسة (JWT_SECRET, COPY_SIGNING_KEY, DB_PASSWORD, ADMIN_PASSWORD)
تُحفَظ خارج المستودع. الجدول أدناه لا يذكر أي أسرار.

| المتغير                | افتراضي/متطلب              | الوصف                                                    |
|------------------------|----------------------------|-----------------------------------------------------------|
| `NODE_ENV`             | `development`              | `production` يمنع `synchronize` الافتراضي.                |
| `PORT`                 | `3000`                     | منفذ HTTP                                                 |
| `CORS_ORIGIN`          | `*`                        | قائمة origins مسموحة                                      |
| `DB_HOST`              | `localhost`                | Postgres host                                             |
| `DB_PORT`              | `5432`                     | Postgres port                                             |
| `DB_USERNAME`          | `postgres`                 | Postgres user                                             |
| `DB_PASSWORD`          | **required**               | Postgres password (لا يُذكر هنا)                         |
| `DB_DATABASE`          | `qasdiya_platform`         | اسم قاعدة البيانات                                        |
| `DB_SYNCHRONIZE`       | `false`                    | لا تفعّله في الإنتاج مطلقاً.                              |
| `JWT_SECRET`           | **required**               | سرّ توقيع JWT (≥ 32 بايت عشوائي)                          |
| `JWT_EXPIRES_IN`       | `7d`                       | عمر التوكن                                                |
| `BCRYPT_ROUNDS`        | `12`                       | جولات تجزئة كلمة المرور                                   |
| `STORAGE_ROOT`         | `./storage`                | جذر التخزين                                               |
| `BOOKS_SOURCE_DIR`     | `${STORAGE_ROOT}/books`    | مسار الـMaster PDFs                                       |
| `GENERATED_DIR`        | `${STORAGE_ROOT}/generated`| مكان النسخ الشخصية المُنتَجة                              |
| `TRANSFERS_DIR`        | `${STORAGE_ROOT}/transfers`| صور الحوالات المرفوعة                                     |
| `COPY_SIGNING_KEY`     | **required in prod**       | Hex ≥ 32 بايت — سرّ HMAC للتوقيع (لا يُذكر هنا)          |
| `COPY_SIGNING_KEY_FILE`| —                          | بديل: مسار ملف يحوي المفتاح، بصلاحية 0600                 |
| `COPY_SIGNING_KEY_ID`  | `k1`                       | معرِّف يُخزَّن مع كل توقيع لتسهيل الدوران                 |
| `WATERMARK_TEXT_AR`    | (نص افتراضي)               | نص العلامة العربية                                        |
| `WATERMARK_TEXT_EN`    | (نص افتراضي)               | نص العلامة الإنجليزية                                     |
| `REDIS_URL`            | —                          | `redis://…` لتخزين مشترك للـRate limits. بدونه يُطبع تحذير |
| `MAIL_DRIVER`          | `log`                      | `log` يطبع الروابط في الـLog؛ SMTP لاحقاً                 |
| `MAIL_FROM`            | —                          | عنوان المرسل                                              |
| `PUBLIC_BASE_URL`      | `http://localhost:3000`    | لبناء روابط التحقق/الاستعادة                             |
| `ADMIN_EMAIL`          | **required for bootstrap** | بريد المالك (يُستخدم مرة واحدة)                          |
| `ADMIN_PASSWORD`       | **required for bootstrap** | ≥ 12 حرفاً (لا يُذكر هنا)                                |
| `ADMIN_FULL_NAME`      | `المدير الأعلى`             | اسم المالك                                                |

انظر [`.env.example`](./.env.example) للنسخة الكاملة، و [`docs/RATE-LIMITS.md`](./docs/RATE-LIMITS.md) لتفصيل الحدود.

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

## آليات التعريف والتتبع والردع (Publishing Engine — §9)

هذه **آليات تعريف وتتبع وردع**، وليست حماية تشفيرية تمنع النسخ. لكل آلية
حدود صريحة، لكنّها مجتمعةً تجعل تتبع أي تسريب ممكناً حتى بعد إزالة أي طبقة
منها.

| # | الآلية | ما تفعله | كيف تُزال |
|---|--------|----------|------------|
| 1 | تذييل مرئي أسفل كل صفحة يحمل اسم المشتري + بريده + رقم الطلب | يردع المشاركة العارضة | قصّ الصفحة يحذفه |
| 2 | Watermark قطري شبه شفاف عبر الصفحة | يزيد كلفة الإخفاء | إعادة رسم/OCR/تعتيم عالي التباين يزيله |
| 3 | UUID + رقم الطلب + رقم الإصدار في زوايا كل صفحة | معرِّف زائد يصمد بعد قص الرأس والذيل | قصّ الحواف يزيله |
| 4 | Metadata موقّعة (Title/Author/Subject/Keywords تحمل copy_uuid) | أول مكان يُظهر الهوية عند تفريغ الميتاداتا | أي أداة تجرد PDF metadata تحذفها |
| 5 | صفحة شهادة نهائية بحمولة JSON كاملة | نص هوية قابل للقراءة البشرية | حذف الصفحة الأخيرة يزيلها |
| 6 | **توقيع HMAC-SHA256 منفصل مخزَّن في قاعدة البيانات — خارج الملف** | **يُثبت سلامة الملف بايتاً ببايت ويربطه بمشترٍ/طلب/توليد محدَّد**. لا تُزال من الملف نفسه لأنها ليست فيه. | **ليست تعرّفاً على النسخ المعدَّلة**: نسخة أُعيدت رقمنتها (OCR) أو أُعيد ضغطها أو حُذفت منها كل المعرفات المرئية لن يعرفها التوقيع؛ يلزم لهذا perceptual hashing / علامات steganography (v2). |

الطبقات 1-5 داخل الملف تعطي المُحقِّق فرصةً لالتقاط أحد المعرِّفات
(UUID / رقم الطلب / رقم التوليد) من نسخة مسرَّبة، ثم يبحث عنه في
`/admin/lookup/copies`، ثم يُحضِر ملفه الأصلي من `storage/generated/`
ويُشغِّل `verify-copy` للتحقق من التطابق البتّي. أي طبقة تصمد تكفي لإطلاق
هذا المسار؛ حين تُزال كل الطبقات معاً لا يمكن للنظام تمييز الملف عن ملف
لا صلة له بالمنصة أصلاً.

### دورة حياة النسخة والتوليدات

- كل عملية شراء تُنتج صفاً واحداً في `issued_copies` مع `copyUuid` ثابت.
- كل مرة تُنتج فيها ملفاً جديداً (اعتماد أولي أو إعادة إصدار من المشتري أو
  إعادة إصدار إدارية) يُلحَق صفٌّ في `issued_copy_generations` يحمل:
  - `generationId` فريد لهذا الملف تحديداً،
  - `generationNumber` تسلسلي (1 للأول، 2 لأول إعادة إصدار...)،
  - `fileSha256` مستقل،
  - `signedPayload` + `signature` منفصلَين.
- الملفات القديمة تبقى على القرص وتبقى مسجَّلة، لتمكين المقارنة الجنائية.

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

- [`docs/PRODUCTION-READINESS.md`](./docs/PRODUCTION-READINESS.md) — قائمة تحقق الإنتاج + نتائج الاختبارات + قياسات الأداء.
- [`docs/SECURITY-ADVISORIES.md`](./docs/SECURITY-ADVISORIES.md) — تحذيرات `npm audit` واحداً واحداً مع قرار قبول/استبدال.
- [`docs/IRPB-COMPLIANCE-MATRIX.md`](./docs/IRPB-COMPLIANCE-MATRIX.md) — ربط كل بند من الملفات الستة بالكود/النقطة/الاختبار مع Implemented/Partial/Missing.
- [`docs/DB-SCHEMA.md`](./docs/DB-SCHEMA.md) — الجداول، الحقول، الفهارس، والـMigrations.
- [`docs/RATE-LIMITS.md`](./docs/RATE-LIMITS.md) — القيم الدقيقة لكل نقطة + Redis backend.
- [`docs/RBAC.md`](./docs/RBAC.md) — الأدوار الستة ومصفوفة الصلاحيات + trigger `super_admin`.
- [`docs/OPERATIONS.md`](./docs/OPERATIONS.md) — دليل التشغيل الإداري اليومي.
- [`docs/DEPLOYMENT.md`](./docs/DEPLOYMENT.md) — نشر VPS + Nginx + systemd + TLS + بريد.
- [`docs/BACKUP.md`](./docs/BACKUP.md) — نسخ احتياطية + `scripts/backup-restore-drill.sh`.
- [`docs/CONSTITUTION.md`](./docs/CONSTITUTION.md) — دستور المنصة (IRPB §8) وقائمة التسليم.

## Verify a leaked copy

```bash
# Export the signedPayload + signature for a suspected copy:
psql -c "SELECT \"signedPayload\" FROM issued_copy_generations WHERE \"generationId\"='…'" > payload.json
psql -c "SELECT signature FROM issued_copy_generations WHERE \"generationId\"='…'" > sig.json

# Verify offline (also SHA-256 the file if you have it):
COPY_SIGNING_KEY_FILE=/etc/qasdiya/copy-signing.key \
  npm run verify-copy -- --payload payload.json --sig sig.json --file suspected.pdf
```

`verify-copy` exits 0 if signature + hash both match; 1 otherwise.

## الرخصة

جميع الحقوق محفوظة للدكتور إياد محمد عبود. الاستخدام والنشر مقيّدان.
