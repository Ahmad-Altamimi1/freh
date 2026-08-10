# تشغيل Supabase محلياً على سيرفر الوزارة (Self-Hosting)

دليل تركيب self-hosted Supabase لسجل الجمعيات، مضبوط لحالتك:
سيرفر واحد على شبكة الوزارة، ٣ مستخدمين، ~١٤٠ جمعية، بدون إيميلات مصادقة،
بدون Sentry، وبدون الخدمات الثقيلة اللي ما تستخدمها.

> **الكومبوز جاهز ومقلّم.** `docker-compose.yml` في هذا المجلد يحتوي فقط
> الخدمات التي يستخدمها التطبيق. نجلب المستودع الرسمي مرة واحدة فقط لأخذ ملفات
> التهيئة (`volumes/db/*` و `volumes/api/kong.yml`) التي يحتاجها إقلاع Postgres
> و Kong — لا نكتبها يدوياً حتى تبقى مطابقة للمصدر المصان.

---

## ما الذي تستخدمه فعلاً (وما الذي نحذفه)

فحص الكود أثبت إنك تستخدم ٣ خدمات فقط: **المصادقة، قاعدة البيانات، التخزين**.

| خدمة | تبقى؟ | السبب |
|---|:---:|---|
| `db` (Postgres) | ✅ | قاعدة بياناتك |
| `auth` (GoTrue) | ✅ | تسجيل الدخول |
| `storage` + `imgproxy` | ✅ | ملفاتك (bucket خاص) |
| `rest` (PostgREST) | ✅ | يحتاجه Storage و Studio (خفيف) |
| `kong` | ✅ | بوابة الـ API الموحّدة |
| `meta` + `studio` | ✅ | لوحة الإدارة |
| **`realtime`** | ❌ | لا تستخدم اشتراكات لحظية |
| **`functions`** (Deno) | ❌ | لا تستخدم Edge Functions |
| **`analytics`** (Logflare) | ❌ | الأثقل والأكثر إزعاجاً — بلا فائدة لك |
| **`vector`** | ❌ | تابع للـ analytics |
| **`supavisor`** (pooler) | ❌ | pooler لا حاجة له لـ ٣ مستخدمين |

---

## المتطلبات

- سيرفر Linux (Ubuntu 22.04 LTS مثلاً) على شبكة الوزارة، RAM ≥ 8GB.
- Docker + Docker Compose plugin.
- عنوان IP داخلي ثابت للسيرفر — في هذا الدليل نسمّيه `10.0.0.5` (**بدّله بالفعلي**).

```bash
# تثبيت Docker (السيرفر عنده إنترنت)
curl -fsSL https://get.docker.com | sh
sudo usermod -aG docker "$USER"   # سجّل خروج/دخول بعدها
```

---

## خطوات التركيب

### 1) جهّز مجلد التركيب

نجلب المستودع الرسمي **فقط من أجل ملفات التهيئة** (`volumes/db/*` و
`volumes/api/kong.yml`)، ثم نستبدل الكومبوز بالنسخة المقلّمة الجاهزة من هذا المجلد.

```bash
sudo mkdir -p /opt/registry && cd /opt/registry
git clone --depth 1 https://github.com/supabase/supabase
cp -r supabase/docker/volumes ./volumes     # ملفات التهيئة (db init + kong.yml)
rm -rf supabase

# انسخ ملفات هذا المجلد (deploy/self-host) إلى /opt/registry:
#   docker-compose.yml   .env.sample   generate-secrets.mjs   backup.sh   restore.sh
cp .env.sample .env
```

> الكومبوز المقلّم **جاهز** — لا خدمات تُحذف يدوياً. `realtime` و`functions`
> و`analytics` و`vector` و`supavisor` غير موجودة أصلاً.

### 2) ولّد الأسرار

```bash
node generate-secrets.mjs
```

يطبع كتلتين: واحدة لـ Supabase (`.env`) وواحدة للتطبيق (`.env.local`). الصق
قيم الكتلة الأولى في `.env`:
`POSTGRES_PASSWORD`, `JWT_SECRET`, `ANON_KEY`, `SERVICE_ROLE_KEY`, `DASHBOARD_PASSWORD`.

### 3) اضبط عنوان الشبكة

في `.env` بدّل `10.0.0.5` بعنوان سيرفر الوزارة الحقيقي (في `SITE_URL`,
`API_EXTERNAL_URL`, `SUPABASE_PUBLIC_URL`, `ADDITIONAL_REDIRECT_URLS`).
إيقاف الإيميلات والتسجيل الذاتي **مضبوط مسبقاً** في `.env.sample`
(`ENABLE_EMAIL_AUTOCONFIRM=true`, `DISABLE_SIGNUP=true`).

> **استعادة كلمة المرور**: لأن الإيميل موقوف، لو نسي مستخدم كلمته تعيّنها يدوياً
> من Studio (Authentication → المستخدم → Reset password). عملي لثلاثة مستخدمين.

### 4) شغّل

```bash
docker compose up -d
docker compose ps          # كلها تصير healthy خلال دقيقة–دقيقتين
```

- لوحة الإدارة (Studio): `http://10.0.0.5:8000` (تسجيل الدخول بـ `DASHBOARD_USERNAME`/`PASSWORD`).
- الـ API الموحّد لـ Supabase: `http://10.0.0.5:8000`.
- Postgres مباشرة (لـ Drizzle): `10.0.0.5:5432`.

> **تعريض Postgres للتطبيق**: إذا كان التطبيق يعمل على **نفس السيرفر** فلا
> حاجة لفتح 5432 خارجياً. إذا كان على جهاز آخر، تأكد أن منفذ 5432 مربوط على
> شبكة الوزارة الداخلية فقط (ليس على الإنترنت) في `docker-compose.yml`.

---

## توصيل التطبيق (Next.js)

بعد ما تصدّر بياناتك (انظر [MIGRATION.md](./MIGRATION.md))، ضع ملف `.env.local`
في مشروع التطبيق بالقيم اللي طبعها `generate-secrets.mjs` (الكتلة الثانية)،
مع عنوان السيرفر الحقيقي. أهم المتغيرات:

```dotenv
NEXT_PUBLIC_SUPABASE_URL=http://10.0.0.5:8000
NEXT_PUBLIC_SUPABASE_ANON_KEY=<ANON_KEY نفسه>
SUPABASE_SERVICE_ROLE_KEY=<SERVICE_ROLE_KEY نفسه>
SUPABASE_STORAGE_BUCKET=private
DATABASE_URL=postgresql://postgres:<POSTGRES_PASSWORD>@10.0.0.5:5432/postgres
DIRECT_DATABASE_URL=postgresql://postgres:<POSTGRES_PASSWORD>@10.0.0.5:5432/postgres
CRON_SECRET=<من السكربت>
NEXT_PUBLIC_SENTRY_DISABLED=true     # يوقف Sentry بالكامل
```

ثم ابنِ التطبيق على جهاز فيه إنترنت وانقله (كما تفضّل)، أو شغّله بـ Docker.
تشغيل سريع للتحقق:

```bash
npm run build && npm start   # يخدم على :3001 حسب إعداد المشروع
```

> **البكت الخاص**: أول تشغيل، ادخل Studio → Storage وأنشئ bucket باسم
> `private` و **"Public bucket" مطفأة**. التطبيق يقرأ عبر روابط موقّعة قصيرة فقط.

> **الكرون (إشعارات انتهاء المدة)**: على Vercel كان تلقائياً. محلياً أضف سطر
> crontab على السيرفر ينادي `/api/cron/term-notifications` يومياً مع
> `Authorization: Bearer <CRON_SECRET>`.

---

## الأمان (إلزامي لمشروع حكومي)

1. **بدّلت كل الأسرار الافتراضية؟** لا تترك أي قيمة من `.env.example` كما هي.
2. **جدار حماية**: افتح فقط منافذ الشبكة الداخلية (`8000`, و`5432` عند اللزوم،
   و`3000/3001` للتطبيق). لا تعرّض أي شيء على الإنترنت.
3. **النسخ الاحتياطي**: فعّل [`backup.sh`](./backup.sh) في crontab يومياً. اختبر
   الاستعادة بـ [`restore.sh`](./restore.sh) مرة قبل الإطلاق.
4. **مزامنة الوقت**: تأكد أن `systemd-timesyncd`/NTP شغّال — المصادقة تعتمد على
   وقت صحيح.
5. **HTTPS (تحسين لاحق)**: للإنتاج ضع reverse proxy (Caddy/nginx) بشهادة داخلية
   أمام المنفذين 3000 و8000 عشان يصير الوصول `https://`.

---

## النسخ الاحتياطي

```bash
# مرة يدوياً للتأكد
BACKUP_DIR=/var/backups/registry ./backup.sh

# ثم في crontab (يومياً 2 فجراً)
0 2 * * *  /opt/registry/backup.sh >> /var/log/registry-backup.log 2>&1
```

---

## استكشاف الأعطال

| العرض | الحل |
|---|---|
| `db` يفشل الإقلاع / ملف init مفقود | تأكد أن `./volumes/` منسوخ من المستودع الرسمي (خطوة ١) |
| فشل سحب صورة (image tag) | راجع الوسم الحالي في كومبوز المستودع الرسمي وحدّثه في `docker-compose.yml` |
| تسجيل الدخول يفشل من جهاز آخر | تأكد أن `API_EXTERNAL_URL`/`SUPABASE_PUBLIC_URL` = IP السيرفر لا `localhost`، وأنه نفسه في `NEXT_PUBLIC_SUPABASE_URL` |
| Studio ما يفتح | راجع `docker compose logs kong studio` |
| التطبيق ما يوصل القاعدة | تحقق من `DATABASE_URL` والمنفذ 5432 مفتوح داخلياً |
