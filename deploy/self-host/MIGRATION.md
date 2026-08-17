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

**ثلاث عمليات تصدير منفصلة، لا واحدة.** السبب مهم:

| المخطط | الطريقة | لماذا |
|---|---|---|
| `public` | مخطط + بيانات | جداولك أنت — تُنقل كاملة |
| `auth` | **بيانات فقط** | البنية يملكها GoTrue المحلي وقد تختلف نسخته عن السحابة؛ استيراد بنيتها فوق المحلية قد يعطّل تسجيل الدخول |
| `storage` | **بيانات فقط** | نفس السبب — `storage-api` المحلي أنشأ بنيته أصلاً |

> إجراء `--clean --schema=auth` على المخططات الثلاث معاً — وهو ما كان مكتوباً هنا
> سابقاً — يحذف جداول الخدمة المحلية ويضع مكانها بنية نسخة أخرى. تجنّبه.

لا تحتاج تثبيت `postgresql-client`: نفّذ `pg_dump` داخل نفس صورة Postgres.

```bash
CLOUD_DB="postgresql://postgres.<ref>:<PASSWORD>@aws-0-<region>.pooler.supabase.com:5432/postgres"

docker run --rm -v "$PWD:/out" -e PGURL="$CLOUD_DB" supabase/postgres:17.6.1.136 sh -c '
  pg_dump "$PGURL" --data-only --table=auth.users --table=auth.identities -f /out/cloud-auth.sql
  pg_dump "$PGURL" --schema=public --clean --if-exists                    -f /out/cloud-public.sql
  pg_dump "$PGURL" --data-only --table=storage.objects                    -f /out/cloud-storage.sql
'
```

> استخدم **منفذ 5432** (session)، لا 6543 — `pg_dump` لا يعمل عبر pooler المعاملات.

## 2) استورد إلى القاعدة المحلية

**الترتيب إلزامي**: `auth` أولاً، لأن `public.user_roles` يشير إلى `auth.users`.

```bash
for f in cloud-auth cloud-public cloud-storage; do
  docker exec -i supabase-db psql -U postgres -d postgres -q < "$f.sql"
done
```

**ثلاثة أخطاء متوقعة وغير ضارة** أثناء `cloud-public` — لا توقف الاستيراد بسببها:

```
ERROR: cannot drop schema public because other objects depend on it
ERROR: schema "public" already exists
ERROR: permission denied to change default privileges     (×12)
```

سببها أن `--clean` يحاول حذف مخطط `public` نفسه وتعديل صلاحيات افتراضية يملكها
`supabase_admin`. الجداول والبيانات تُنقل بالكامل رغمها.

## 2ب) تحقّق بالمقارنة، لا بالتخمين

شغّل نفس الاستعلام على الاثنين وقارن — الأرقام يجب أن تتطابق:

```bash
docker exec supabase-db psql -U postgres -d postgres -tAc "
select 'organizations: ' || count(*) from public.organizations
union all select 'correspondences: ' || count(*) from public.correspondences
union all select 'board_renewals: '  || count(*) from public.board_renewals
union all select 'auth.users: '      || count(*) from auth.users
union all select 'storage.objects: ' || count(*) from storage.objects;"
```

ثم افحص ما لا تكشفه الأعداد:

```bash
docker exec supabase-db psql -U postgres -d postgres -tAc "
-- ترميز عربي سليم؟ يجب أن يظهر الاسم مقروءاً لا رموزاً
select name from public.organizations limit 1;
-- كلمات السر انتقلت؟ يجب أن يساوي العدد الكلي (bcrypt يبدأ بـ \$2)
select count(*) from auth.users where encrypted_password like '\$2%';"
```

> `auth.users` قد يزيد بواحد إن كنت أنشأت حساب اختبار محلياً قبل الاستيراد —
> الاستيراد يضيف ولا يستبدل.

---

## 3) نقل ملفات التخزين — **خطوة إلزامية لا تُهمَل**

الـ dump نقل جدول `storage.objects`، أي **فهرس** الملفات لا محتواها. بدون هذه
الخطوة كل مرفق يبدو موجوداً في الواجهة، ثم يفشل تحميله بـ **HTTP 500** لأن
الملف غير موجود في مخزن الملفات المحلي. هذا العطل لا يظهر في أي فحص أعداد.

أنشئ البكت أولاً (غير عام):

```bash
curl -X POST "$LOCAL_URL/storage/v1/bucket" \
  -H "apikey: $LOCAL_SERVICE_KEY" -H "Authorization: Bearer $LOCAL_SERVICE_KEY" \
  -H 'Content-Type: application/json' \
  -d '{"id":"private","name":"private","public":false}'
```

ثم انسخ الملفات بـ [`copy-storage.mjs`](./copy-storage.mjs) — يقرأ قائمة الملفات
من الفهرس المحلي نفسه، فينسخ بالضبط ما تتوقعه القاعدة وبنفس المسارات:

```bash
CLOUD_URL=https://<ref>.supabase.co \
CLOUD_SERVICE_KEY=<service_role من لوحة السحابة> \
LOCAL_URL=http://10.0.0.5:8000 \
LOCAL_SERVICE_KEY=<SERVICE_ROLE_KEY المحلي> \
node copy-storage.mjs private
```

السكربت **لا يحذف شيئاً** من أي طرف، وإعادة تشغيله آمنة — يستبدل الموجود
(`x-upsert`)، فنسخة انقطعت في منتصفها تحتاج تشغيلة أخرى فقط.

**تحقّق** بأن ملفاً فعلياً صار يُجلب (لا 500):

```bash
OBJ=$(docker exec supabase-db psql -U postgres -d postgres -tAc \
  "select name from storage.objects limit 1;" | tr -d '\r')
SIGNED=$(curl -s -X POST "$LOCAL_URL/storage/v1/object/sign/private/$OBJ" \
  -H "apikey: $LOCAL_SERVICE_KEY" -H "Authorization: Bearer $LOCAL_SERVICE_KEY" \
  -H 'Content-Type: application/json' -d '{"expiresIn":60}' \
  | node -pe "JSON.parse(require('fs').readFileSync(0)).signedURL")
curl -s -o /dev/null -w "%{http_code}\n" "$LOCAL_URL/storage/v1$SIGNED"   # 200 = تمام
```

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
