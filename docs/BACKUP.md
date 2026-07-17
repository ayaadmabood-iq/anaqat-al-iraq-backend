# دليل النسخ الاحتياطية

يوافق ملف IRPB رقم 3 §10 والملف رقم 6 §6.

## المكوّنات التي يجب نسخها

| المكوّن                        | الأداة                                   | التكرار      |
|--------------------------------|-------------------------------------------|--------------|
| قاعدة البيانات PostgreSQL      | `pg_dump --format=custom`                 | يومي         |
| مجلد الكتب الأصلية `storage/books/`     | `rsync` أو `tar` مضغوط              | يومي         |
| مجلد النسخ المُنتَجة `storage/generated/` | `rsync`                              | يومي (سريع)  |
| صور الحوالات `storage/transfers/`       | `rsync`                              | يومي         |
| ملف البيئة `.env`             | نسخ يدوي مشفَّر (مرة عند النشر ثم عند التعديل) | حسب الحاجة |

النسخ اليومية تُحفَظ 30 يوماً، الأسبوعية 8 أسابيع، الشهرية 12 شهراً،
وتُحفَظ نسخة إضافية خارج الخادم (Object Storage أو محرك خارجي).

## سكربت يومي `/usr/local/bin/qasdiya-backup.sh`

```bash
#!/usr/bin/env bash
set -euo pipefail

TS="$(date +%Y%m%d-%H%M%S)"
DEST="/home/qasdiya/backups"
mkdir -p "$DEST/daily/$TS"

# 1) قاعدة البيانات
PGPASSWORD="$DB_PASSWORD" pg_dump \
  --host="$DB_HOST" --port="$DB_PORT" --username="$DB_USERNAME" \
  --format=custom "$DB_DATABASE" \
  > "$DEST/daily/$TS/db.dump"

# 2) الملفات
tar -C /home/qasdiya -czf "$DEST/daily/$TS/storage.tgz" storage

# 3) checksum
sha256sum "$DEST/daily/$TS/"* > "$DEST/daily/$TS/SHA256"

# 4) تنظيف النسخ القديمة (>30 يوم)
find "$DEST/daily" -maxdepth 1 -mindepth 1 -type d -mtime +30 -exec rm -rf {} \;

echo "✔ backup $TS done"
```

```bash
sudo chmod +x /usr/local/bin/qasdiya-backup.sh
```

## Cron

```
# /etc/cron.d/qasdiya-backup
0 2 * * *   qasdiya   /usr/local/bin/qasdiya-backup.sh >> /home/qasdiya/backups/backup.log 2>&1
```

## استعادة (Restore Drill)

يُختبَر شهرياً على خادم منفصل:

```bash
createdb -O qasdiya qasdiya_restore
pg_restore --no-owner --dbname=qasdiya_restore db.dump
tar -xzf storage.tgz -C /tmp/restore
```

ثم يشغَّل التطبيق مع متغيرات بيئة معدَّلة وتُختبَر:
- تسجيل الدخول للمدير.
- إعادة إنشاء نسخة لطلب فُلفِلَ سابقاً — يجب أن يعطي نفس `copyUuid`.

## نسخة خارج الموقع

- MinIO/S3 مع سياسة `lifecycle` تنقل النسخ الأقدم من شهر إلى `GLACIER`.
- أو محرك تخزين خارجي يُحدَّث أسبوعياً برفع `daily/*` الحديثة عبر `rclone`.
