# دليل النشر — منصة القراءة القصدية

يوافق هذا الدليل ملف IRPB رقم 3 §9 والملف رقم 6 §5.

## 1) البيئة الموصى بها

- **VPS**: Ubuntu LTS 22.04 أو 24.04 (2 vCPU / 4 GB RAM كحد أدنى).
- **Node.js**: 18+ أو 20 LTS.
- **PostgreSQL**: 15+.
- **Nginx**: عاكس + إنهاء TLS.
- **Redis** (اختياري في v1، ضروري لاحقاً للـcache وقفل الاعتمادات).
- **Object Storage** (اختياري v1 — ننصح بـMinIO أو S3 لتخزين النسخ الشخصية والحوالات).
- **بريد احترافي**: صندوق مؤسسي `no-reply@your-domain` + دومين مرسل.
- **مراقبة**: أي أداة صحية (Uptime Kuma / UptimeRobot) + تنبيهات على البريد.

## 2) الخطوات

```bash
# 1. المستخدم والدلائل
sudo useradd -m -s /bin/bash qasdiya
sudo -u qasdiya mkdir -p /home/qasdiya/{app,storage/{books,generated,transfers},backups}

# 2. جلب الكود
sudo -u qasdiya git clone https://github.com/<owner>/anaqat-al-iraq-backend /home/qasdiya/app
cd /home/qasdiya/app
sudo -u qasdiya npm ci --omit=dev

# 3. تجهيز .env
sudo -u qasdiya cp .env.example .env
# عدّل:
#  DB_PASSWORD, JWT_SECRET (>= 32 بايت عشوائي)
#  STORAGE_ROOT=/home/qasdiya/storage
#  CORS_ORIGIN=https://your-frontend-domain
#  ADMIN_EMAIL, ADMIN_PASSWORD, MAIL_DRIVER

# 4. PostgreSQL + قاعدة البيانات
sudo -u postgres createuser qasdiya --pwprompt
sudo -u postgres createdb qasdiya_platform --owner qasdiya

# 5. البذر (يُنشئ الشيمة + المدير + الكتب الثلاثة + الحسابات + CMS)
sudo -u qasdiya npm run seed

# 6. بناء التشغيل
sudo -u qasdiya npm run build
```

## 3) systemd

`/etc/systemd/system/qasdiya-api.service`:

```ini
[Unit]
Description=Qasdiya Platform API
After=network.target postgresql.service

[Service]
User=qasdiya
WorkingDirectory=/home/qasdiya/app
EnvironmentFile=/home/qasdiya/app/.env
ExecStart=/usr/bin/node dist/main.js
Restart=always
RestartSec=5
LimitNOFILE=65536

[Install]
WantedBy=multi-user.target
```

```bash
sudo systemctl daemon-reload
sudo systemctl enable --now qasdiya-api
sudo systemctl status qasdiya-api
```

## 4) Nginx + TLS

`/etc/nginx/sites-available/qasdiya`:

```nginx
server {
    listen 443 ssl http2;
    server_name your-domain.tld;

    ssl_certificate     /etc/letsencrypt/live/your-domain.tld/fullchain.pem;
    ssl_certificate_key /etc/letsencrypt/live/your-domain.tld/privkey.pem;

    client_max_body_size 10M;

    location /api/ {
        proxy_pass http://127.0.0.1:3000;
        proxy_set_header Host              $host;
        proxy_set_header X-Real-IP         $remote_addr;
        proxy_set_header X-Forwarded-For   $proxy_add_x_forwarded_for;
        proxy_set_header X-Forwarded-Proto $scheme;
        proxy_read_timeout 120s;
    }
}
```

```bash
sudo ln -s /etc/nginx/sites-available/qasdiya /etc/nginx/sites-enabled/
sudo certbot --nginx -d your-domain.tld
sudo systemctl reload nginx
```

## 5) البريد

- في MVP: `MAIL_DRIVER=log` يطبع رابط التحقق في السجلات.
- عند تشغيل الإنتاج: أنشئ صندوقاً مؤسسياً (Zoho / Google Workspace / Postmark)
  وضع بيانات SMTP في `.env`، وسنستبدل `MailService` بمُنفِّذ SMTP فعلي دون
  لمس أي استدعاء لاحق (Adapter مغلق).

## 6) قائمة تحقق قبل الإطلاق

- [ ] `JWT_SECRET` ≥ 32 بايت عشوائي.
- [ ] `ADMIN_PASSWORD` مُغيَّر ولا يحتوي كلمة `change-me`.
- [ ] رفع `master.pdf` لكل كتاب إلى `storage/books/<slug>/`.
- [ ] رفع `sample.pdf` (المقدمة المجانية) لكل كتاب.
- [ ] تحديث أرقام حسابات الرافدين وTBI بالدينار والدولار من `/admin/bank-accounts`.
- [ ] تحديث `page.about`, `page.founder`, `page.faq`, `page.contact` من `/admin/content`.
- [ ] تفعيل النسخ الاحتياطية اليومية (انظر `docs/BACKUP.md`).
- [ ] اختبار استعادة نسخة احتياطية على خادم تجريبي.
- [ ] مراقبة عمل التطبيق بعد النشر لمدة 24 ساعة.
