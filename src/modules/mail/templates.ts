/**
 * Bilingual (Arabic + English) email templates. Each returns the subject,
 * a plain-text body, and an HTML body. Kept simple on purpose — dependency-
 * free string templates so we can review the exact bytes sent to users.
 */

const wrap = (bodyAr: string, bodyEn: string): string => `<!doctype html>
<html dir="rtl" lang="ar">
<head><meta charset="utf-8"><title>منصة القراءة القصدية</title></head>
<body style="font-family:Amiri,serif;line-height:1.6;color:#111;padding:24px;">
${bodyAr}
<hr style="margin:32px 0;border:0;border-top:1px solid #ddd;">
<div dir="ltr" style="font-family:sans-serif;color:#333;">${bodyEn}</div>
</body></html>`;

export function verifyEmail(link: string, fullName: string) {
  return {
    subject: 'تأكيد بريدك — منصة القراءة القصدية',
    text: `مرحباً ${fullName}،

لتأكيد بريدك الإلكتروني افتح الرابط التالي (صالح 48 ساعة):
${link}

إن لم تنشئ هذا الحساب فتجاهل هذه الرسالة.

— منصة القراءة القصدية
`,
    html: wrap(
      `<h2>مرحباً ${fullName}</h2>
       <p>لتأكيد بريدك الإلكتروني اضغط الرابط التالي (صالح 48 ساعة):</p>
       <p><a href="${link}" style="background:#0b5;color:#fff;padding:12px 20px;border-radius:4px;text-decoration:none;">تأكيد البريد</a></p>
       <p style="color:#666;font-size:13px;">إن لم تعمل الأداة اذهب إلى الرابط مباشرة:<br><code>${link}</code></p>`,
      `<h3>Confirm your e-mail</h3>
       <p>Hello ${fullName}, click the link (valid 48h): <a href="${link}">${link}</a>.<br>
       If you did not create this account, ignore this message.</p>`,
    ),
  };
}

export function passwordReset(link: string, fullName: string) {
  return {
    subject: 'استعادة كلمة المرور — منصة القراءة القصدية',
    text: `مرحباً ${fullName}،

طلبتَ استعادة كلمة المرور. افتح الرابط التالي (صالح ساعة واحدة فقط):
${link}

إن لم تطلب هذا فتجاهل الرسالة؛ لن يتغير شيء في حسابك.

— منصة القراءة القصدية
`,
    html: wrap(
      `<h2>استعادة كلمة المرور</h2>
       <p>مرحباً ${fullName}، طلبتَ استعادة كلمة المرور. الرابط صالح لساعة واحدة:</p>
       <p><a href="${link}" style="background:#0b5;color:#fff;padding:12px 20px;border-radius:4px;text-decoration:none;">إعادة تعيين كلمة المرور</a></p>
       <p style="color:#666;font-size:13px;">إن لم تطلب هذا فلا داعي لأي إجراء.</p>`,
      `<h3>Password reset</h3>
       <p>Hello ${fullName}, use the link within 1 hour: <a href="${link}">${link}</a>.<br>
       If you did not request this, ignore this message.</p>`,
    ),
  };
}

export function orderApproved(orderNumber: string, downloadUrl: string, fullName: string) {
  return {
    subject: `تم اعتماد طلبك ${orderNumber} — منصة القراءة القصدية`,
    text: `مرحباً ${fullName}،

تم اعتماد طلبك ${orderNumber}. النسخة الشخصية جاهزة للتنزيل من حسابك.

استخدم لوحة حسابك على المنصة لإصدار رابط التنزيل الآمن.

— منصة القراءة القصدية
`,
    html: wrap(
      `<h2>تم اعتماد طلبك</h2>
       <p>مرحباً ${fullName}، تم اعتماد طلبك <strong>${orderNumber}</strong>.
       افتح لوحة حسابك على المنصة لتحصل على رابط التنزيل الآمن (صالح لدقائق فقط).</p>
       ${downloadUrl ? `<p><a href="${downloadUrl}">افتح حسابك</a></p>` : ''}`,
      `<h3>Your order was approved</h3>
       <p>Hello ${fullName}, order <strong>${orderNumber}</strong> is approved.
       Open your account dashboard to mint a short-lived download URL.</p>`,
    ),
  };
}
