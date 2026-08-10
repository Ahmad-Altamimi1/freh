# الترحيل من Supabase Cloud إلى المحلي

نقل بياناتك الحالية (الجداول + المستخدمين + الملفات) من مشروعك على السحابة إلى
السيرفر المحلي. نفّذها **بعد** ما يشتغل الـ stack المحلي (انظر [README.md](./README.md)).

الترحيل ثلاث قطع مستقلة:
1. **قاعدة البيانات** — كل الجداول + `auth.users` (حساباتك وكلماتها المشفّرة).
2. **الملفات** — محتوى بكت التخزين `private`.
3. **متغيرات التطبيق** — تبديل الروابط والمفاتيح للمحلي.

> جهّز على جهاز فيه إنترنت وأدوات: `psql`, `pg_dump` (حزمة `postgresql-client`),
> و`supabase` CLI اختياري. تحتاج **connection string** من مشروعك السحابي:
> Supabase Dashboard → Settings → Database → Connection string (session, منفذ 5432).

---

## 1) تصدير قاعدة البيانات من السحابة

الأهم: صدّر مخطط `auth` أيضاً حتى تنتقل الحسابات بكلماتها — فلا أحد يحتاج إعادة
تعيين كلمة المرور.

```bash
# من الجهاز المتصل بالإنترنت
CLOUD_DB="postgresql://postgres.<ref>:<PASSWORD>@aws-0-<region>.pooler.supabase.com:5432/postgres"

pg_dump "$CLOUD_DB" \
  --clean --if-exists --quote-all-identifiers \
  --schema=public --schema=auth --schema=storage \
  -f registry-cloud.sql
```

> إذا فضّلت أداة Supabase: `supabase db dump --db-url "$CLOUD_DB" -f registry-cloud.sql`.

## 2) استورد إلى القاعدة المحلية

انقل `registry-cloud.sql` إلى السيرفر ثم:

```bash
# على سيرفر الوزارة
cat registry-cloud.sql | docker exec -i supabase-db psql -U postgres postgres
```

تحقق من العدد:

```bash
docker exec -it supabase-db psql -U postgres -c \
  "select count(*) as orgs from public.organizations; select count(*) as users from auth.users;"
```

يفترض ترى ~140 جمعية و3 مستخدمين. لو ظهرت، القاعدة تمام.

---

## 3) نقل ملفات التخزين

الملفات تُخزَّن في بكت `private`. نزّلها من السحابة وارفعها للمحلي.

**أ) نزّل من السحابة** — الأسهل عبر Studio السحابي (Storage → private → تحديد
الكل → تنزيل)، أو برمجياً بـ `supabase storage` CLI. ضعها في مجلد `./private/`.

**ب) ارفع للمحلي** — أنشئ البكت أولاً في Studio المحلي (`private`، غير عام)، ثم
ارفع نفس الملفات بنفس المسارات عبر Studio المحلي (Storage → private → Upload)،
أو بسكربت بسيط يستخدم `SERVICE_ROLE_KEY` المحلي.

> **بديل سريع للحجم الصغير**: لو الملفات قليلة، السحب/الإفلات في Studio المحلي
> أسرع من كتابة سكربت. حافظ على نفس أسماء المسارات حتى تبقى الروابط في القاعدة
> صحيحة.

---

## 4) بدّل متغيرات التطبيق

في `.env.local` للتطبيق، استبدل قيم السحابة بالمحلية (من مخرجات
`generate-secrets.mjs`). قبل/بعد:

```dotenv
# قبل (سحابة)
NEXT_PUBLIC_SUPABASE_URL=https://xxxx.supabase.co
DATABASE_URL=postgresql://postgres.xxxx:...@...pooler.supabase.com:6543/postgres

# بعد (محلي — بدّل 10.0.0.5 بعنوان سيرفرك)
NEXT_PUBLIC_SUPABASE_URL=http://10.0.0.5:8000
DATABASE_URL=postgresql://postgres:<POSTGRES_PASSWORD>@10.0.0.5:5432/postgres
```

القائمة الكاملة في [README.md](./README.md#توصيل-التطبيق-nextjs).

---

## 5) تحقّق نهائي

- [ ] تسجيل الدخول يعمل بحساب موجود (يثبت انتقال `auth.users` والمفاتيح صحيحة).
- [ ] قائمة الجمعيات تظهر ~140 سجل.
- [ ] فتح جمعية وتحميل ملف مرفق (يثبت التخزين والروابط الموقّعة).
- [ ] الأدوار والصلاحيات تعمل (جرّب حساب دوره "مطّلع" — تختفي أزرار الإضافة/الحذف).
- [ ] لا أخطاء Sentry في الكونسول (يثبت `NEXT_PUBLIC_SENTRY_DISABLED=true`).

بعد نجاح كل ذلك، شغّل نسخة احتياطية أولى: `./backup.sh`.

---

## ملاحظة عن migrations (Drizzle)

بيانات السحابة تحمل المخطط كاملاً أصلاً، فلا تحتاج `db:push` بعد الاستيراد. لأي
تعديل مخطط **مستقبلي**، شغّل `npm run db:migrate` (يستخدم `DIRECT_DATABASE_URL`
= منفذ 5432 المحلي). لا تستخدم pooler لأن الـ DDL لا يمر عبره.
