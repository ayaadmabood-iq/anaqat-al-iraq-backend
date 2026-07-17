# دليل التشغيل الإداري

يوافق ملف IRPB رقم 6 §4. الغاية: تمكين المالك من تشغيل المنصة يومياً
دون الحاجة إلى فريق تقني.

## 1) الدخول

- URL: `https://your-domain.tld/admin`
- المستخدم الافتراضي: البريد المذكور في `ADMIN_EMAIL` بعد `npm run seed`.
- ⚠ يجب تغيير كلمة المرور فوراً من الملف الشخصي بعد أول دخول.

## 2) إدارة الكتب

نقاط الـAPI المستخدمة من واجهة الإدارة:

```
GET    /api/v1/admin/books
POST   /api/v1/admin/books
PATCH  /api/v1/admin/books/:id
POST   /api/v1/admin/books/:id/publish
POST   /api/v1/admin/books/:id/suspend
```

خطوات نشر كتاب جديد:

1. ارفع `master.pdf` و`sample.pdf` إلى `storage/books/<slug>/`.
2. أنشئ الكتاب عبر `POST /admin/books` مع `masterPdfPath`, `samplePdfPath`,
   `title`, `author`, `description` بحقول `ar/en`، والسعر بالدينار والدولار،
   وقائمة الكلمات المفتاحية والتصنيف.
3. راجع البيانات، ثم `POST /admin/books/:id/publish`.
4. للإيقاف: `POST /admin/books/:id/suspend` (يُخفيه فوراً عن المتصفح).

عند رفع نسخة أصلية جديدة، بدّل `editionVersion` (مثلاً "2") قبل الحفظ —
ستظهر النسخ القديمة والجديدة كإصدارات مختلفة في التقارير الفنية.

## 3) إدارة المقالات

```
GET/POST/PATCH/DELETE  /api/v1/admin/articles
```

كل مقال يقبل: `title`, `excerpt`, `body` (jsonb ar/en)، `tags[]`, `category`,
و`metaTitle` + `metaDescription` لأغراض SEO.

## 4) إدارة الطلبات

```
GET  /api/v1/admin/orders?status=awaiting_review
GET  /api/v1/admin/orders?q=<اسم أو رقم طلب>
GET  /api/v1/admin/orders/:id
POST /api/v1/admin/orders/:id/approve
POST /api/v1/admin/orders/:id/reject   { "reason": "..." }
```

عند الاعتماد: النظام يولّد النسخة الشخصية فوراً (يستغرق ثوانٍ)، ويحفظ
`copyUuid` و`fileSha256` ويسجّل الحدث في `audit_logs`.

طلب معلَّق يستطيع العميل رفع صورة حوالة جديدة له بعد رفضه.

## 5) الحسابات المصرفية

```
GET/POST/PATCH/DELETE  /api/v1/admin/bank-accounts
```

حدّث أرقام الرافدين وTBI-IQD وTBI-USD مباشرة، وضع `isActive=false` لأي
حساب متوقف بدل حذفه (لأن الطلبات القديمة تشير إليه).

## 6) العملاء

```
GET  /api/v1/admin/customers?q=<اسم/بريد>
GET  /api/v1/admin/customers/:id
POST /api/v1/admin/customers/:id/deactivate   (super_admin/admin)
POST /api/v1/admin/customers/:id/activate     (super_admin/admin)
```

## 7) البحث بواسطة UUID والتقرير الفني

```
GET /api/v1/admin/lookup/copy/:uuid
GET /api/v1/admin/lookup/copy/:uuid/report
GET /api/v1/admin/lookup/copies?buyer=<>&order=<>
```

التقرير الفني يعيد: هوية النسخة، الطلب، الكتاب، بيانات المشتري وقت الشراء،
سجل التنزيلات مع IP والمتصفح والنظام، وحمولة البصمة JSON. مخصص للاسترشاد
الداخلي — ليس دليلاً قانونياً منفرداً.

## 8) صفحات CMS

```
GET  /api/v1/content/:key                       (عام)
PUT  /api/v1/admin/content/:key   { value: ... }
```

المفاتيح المتاحة عاماً: `page.home_hero`, `page.about`, `page.founder`,
`page.faq`, `page.contact`, `purchase.agreement`.

## 9) التقارير

```
GET /api/v1/admin/summary
GET /api/v1/admin/reports/sales?from=YYYY-MM-DD&to=YYYY-MM-DD
GET /api/v1/admin/reports/best-selling?limit=10
GET /api/v1/admin/reports/pending-orders
GET /api/v1/admin/downloads?limit=200
```

## 10) اختبارات دورية

- شهرياً: تسجيل مستخدم تجريبي، شراء كتاب، رفع حوالة صورية، اعتماد،
  تنزيل، إعادة إنشاء نسخة، ثم حذف الحساب.
- شهرياً: تجربة استعادة نسخة احتياطية (`docs/BACKUP.md`).
- عند كل تحديث: `npm run build` + `npm run typecheck` قبل النشر.
