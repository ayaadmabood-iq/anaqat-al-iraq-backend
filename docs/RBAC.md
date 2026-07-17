# الأدوار والصلاحيات (RBAC)

الوثيقة المرجعية للأدوار الستة المعتمدة في المرجع التأسيسي IRPB — الملف رقم 3 §7،
وطريقة توزيعها على نقاط الـAPI.

## الأدوار

| الدور              | الاسم في `users.role`   | الوصف                                                  |
|--------------------|--------------------------|---------------------------------------------------------|
| المدير الأعلى      | `super_admin`            | صاحب المنصة — كل الصلاحيات بلا استثناء                  |
| مدير عام           | `admin`                  | كل الصلاحيات باستثناء تغيير المدير الأعلى               |
| مدير محتوى         | `content_manager`        | الكتب، المقالات، التصنيفات، صفحات CMS                   |
| مدير مالي          | `finance_manager`        | الحسابات المصرفية، اعتماد ورفض الطلبات، تقارير المبيعات |
| دعم فني/عملاء     | `support`                | قراءة الطلبات والعملاء والنسخ، البحث بـUUID، التقرير الفني |
| عميل               | `customer` (افتراضي)     | التصفح، الشراء، رفع الحوالة، التنزيل                    |

> `user` و`admin` القديمان يُقبلان كأسماء بديلة لـ`customer` و`super_admin` على التوالي،
> ويُرقّى المدير القديم آلياً إلى `super_admin` عند تشغيل `npm run seed`.

## مصفوفة الصلاحيات

| المسار                                       | من يستطيع؟                                              |
|---------------------------------------------|----------------------------------------------------------|
| `POST /auth/register` / `login` / `verify`  | الجميع                                                  |
| `PATCH /auth/me` / `change-password`        | المستخدم المسجَّل                                       |
| `POST /orders`, `/transfer-proof`, `/reissue-copy` | `customer`                                        |
| `GET/POST/PATCH /admin/books`               | `super_admin`, `admin`, `content_manager`                |
| `GET/POST/PATCH/DELETE /admin/articles`     | `super_admin`, `admin`, `content_manager`                |
| `GET/POST/PATCH/DELETE /admin/book-categories` | `super_admin`, `admin`, `content_manager`             |
| `GET/PUT/DELETE /admin/content/:key`        | `super_admin`, `admin`, `content_manager`                |
| `GET/POST/PATCH/DELETE /admin/bank-accounts`| `super_admin`, `admin`, `finance_manager`                |
| `GET /admin/orders`                         | جميع أدوار الإدارة (قراءة)                              |
| `POST /admin/orders/:id/approve|reject`     | `super_admin`, `admin`, `finance_manager`                |
| `GET /admin/customers`                      | `super_admin`, `admin`, `support`                        |
| `POST /admin/customers/:id/(de)activate`    | `super_admin`, `admin`                                   |
| `GET /admin/reports/sales`                  | `super_admin`, `admin`, `finance_manager`                |
| `GET /admin/reports/best-selling`           | أدوار الإدارة (قراءة)                                    |
| `GET /admin/reports/pending-orders`         | `super_admin`, `admin`, `finance_manager`                |
| `GET /admin/lookup/copy/:uuid[/report]`     | `super_admin`, `admin`, `support`                        |
| `GET /admin/lookup/copies`                  | `super_admin`, `admin`, `support`                        |
| `GET /admin/downloads`                      | أدوار الإدارة (قراءة)                                    |

## إضافة موظف بدور محدد

يُنشئ المدير الأعلى موظفاً من قاعدة البيانات مباشرة أو عبر إجراء
مستقبلي في لوحة الإدارة، مع تعيين `role` إلى واحد من الأدوار أعلاه.
كل شخص جديد ينشئ حسابه عبر `/auth/register` يبدأ بدور `customer`.
