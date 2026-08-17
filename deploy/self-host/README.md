# تشغيل Supabase محلياً على سيرفر الوزارة (Self-Hosting)

دليل تركيب self-hosted Supabase لسجل الجمعيات، مضبوط لحالتك:
سيرفر واحد على شبكة الوزارة، ٣ مستخدمين، ~١٤٠ جمعية، بدون إيميلات مصادقة،
بدون Sentry، وبدون الخدمات الثقيلة اللي ما تستخدمها.

> **الكومبوز جاهز ومقلّم.** `docker-compose.yml` في هذا المجلد يحتوي فقط
> الخدمات التي يستخدمها التطبيق. نجلب المستودع الرسمي مرة واحدة فقط لأخذ ملفات
> التهيئة (`volumes/db/*` و `volumes/api/kong.yml`) التي يحتاجها إقلاع Postgres
> و Kong — لا نكتبها يدوياً حتى تبقى مطابقة للمصدر المصان.

> ⚠️ **التثبيت على commit محدّد ليس تفصيلاً — هو شرط.**
> ملفات `volumes/` ووسوم الصور **طقم واحد**. جلب `volumes/` من الفرع الافتراضي
> مع إبقاء وسوم أقدم ينتج ستاك يقلع ثم يموت عند البوابة. الأمر في الخطوة ١
> مثبّت على `9e225a27` — آخر إصدار self-host متماسك يستخدم Kong، إذ استبدلته
> Supabase بـ Envoy في التحديث التالي مباشرة. **لا تغيّر هذا الـ commit** إلا
> بترقية مدروسة تُحدّث الوسوم والملفات معاً.

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

## التركيب الآلي (المسار الموصى به)

[`bootstrap.sh`](./bootstrap.sh) ينفّذ كل ما يلي في أمر واحد، مع فحص وقائي عند
كل مرحلة. المدخل الوحيد المطلوب منك هو عنوان السيرفر:

```bash
# سجل فارغ: يطبّق المايجريشن وينشئ حساب مدير
sudo ./bootstrap.sh --ip 10.0.0.5 --fresh

# أو: ابدأ من نسخة احتياطية (هذا مسار الترحيل من السحابة)
sudo ./bootstrap.sh --ip 10.0.0.5 --restore db-*.sql.gz storage-*.tar.gz

# ومعهما اختيارياً، لتحميل صورة التطبيق وتشغيلها:
#   --app-image registry-app.tar.gz
```

قبل التشغيل انسخ مجلد المايجريشن بجانب السكربت:

```bash
cp -r <repo>/src/db/migrations ./migrations
```

> **لا يحتاج Node ولا إنترنت للمايجريشن**: يطبّق ملفات SQL بـ `psql` ويكتب سجل
> drizzle بنفسه (هاش = `sha256` لمحتوى الملف). تم التحقق من ذلك عملياً:
> `drizzle-kit migrate` بعده لا يعيد تطبيق أي شيء.

> **يتوقف مبكراً وبوضوح** إذا كان منفذ مشغولاً، أو الـ daemon غير متاح، أو
> `volumes/` من إصدار Supabase خاطئ — كل فحص فيه يقابل عطلاً حدث فعلاً أثناء
> بروفة كاملة.

الأقسام التالية تشرح الخطوات يدوياً، لمن يريد فهم ما يفعله السكربت أو تنفيذها
واحدة واحدة.

---

## خطوات التركيب (يدوياً)

### 1) جهّز مجلد التركيب

نجلب المستودع الرسمي **فقط من أجل ملفات التهيئة** (`volumes/db/*` و
`volumes/api/kong.yml` و `kong-entrypoint.sh`)، **من commit مثبّت**، ثم نستبدل
الكومبوز بالنسخة المقلّمة الجاهزة من هذا المجلد.

```bash
sudo mkdir -p /opt/registry && cd /opt/registry

# clone جزئي مثبّت: بضعة ميغابايت بدل ~345MB، ومن اللحظة الزمنية الصحيحة.
git clone --depth 1 --filter=blob:none --sparse https://github.com/supabase/supabase _sb
cd _sb
git sparse-checkout set docker
git fetch --depth 1 origin 9e225a279b33e4e6e1452e573a40a6a25aa2cb2f
git checkout FETCH_HEAD
cd ..

cp -r _sb/docker/volumes ./volumes     # ملفات التهيئة (db init + kong.yml + entrypoint)
rm -rf _sb

# انسخ ملفات هذا المجلد (deploy/self-host) إلى /opt/registry:
#   docker-compose.yml   .env.sample   generate-secrets.mjs   backup.sh   restore.sh
cp .env.sample .env
```

تحقّق أن `volumes/api/` يحتوي **ملفين**: `kong.yml` و `kong-entrypoint.sh`.
غياب الثاني يعني أنك جلبت نسخة من عصر مختلف.

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

### 4) شغّل Supabase

**قبل التشغيل، تأكد أن المنافذ فاضية فعلاً** — لا تفترض:

```bash
for p in 3000 8000 8443 ${POSTGRES_PUBLISHED_PORT:-5432}; do
  ss -lntp "sport = :$p" | grep -q LISTEN && echo "المنفذ $p مشغول ✗" || echo "المنفذ $p فاضي ✓"
done
```

> **ليش هذا الفحص مهم بشكل خاص لمنفذ Postgres**: لو كان مشغولاً بقاعدة أخرى،
> فالتطبيق قد يتصل بها **بدل** قاعدتنا ويطلع خطأ `password authentication failed`
> — رسالة تقودك للبحث في كلمات السر بينما المشكلة أنك تكلّم قاعدة مختلفة
> أصلاً. بدّل `POSTGRES_PUBLISHED_PORT` في `.env` لأي منفذ فاضي.

```bash
docker compose up -d
docker compose ps          # كلها تصير healthy خلال دقيقة–دقيقتين
```

- لوحة الإدارة (Studio): `http://10.0.0.5:8000` (تسجيل الدخول بـ `DASHBOARD_USERNAME`/`PASSWORD`).
- الـ API الموحّد لـ Supabase: `http://10.0.0.5:8000`.
- Postgres مباشرة (لـ Drizzle): `10.0.0.5:5432`.

> هذا الأمر يشغّل Supabase فقط. التطبيق نفسه خدمة خلف profile — القسم التالي.

> **تعريض Postgres للتطبيق**: إذا كان التطبيق يعمل بـ Docker على **نفس
> السيرفر** فهو يصل القاعدة عبر شبكة الكومبوز ولا حاجة لفتح 5432 أصلاً —
> تقدر تحذف كتلة `ports` من خدمة `db`. إذا كان على جهاز آخر، تأكد أن المنفذ
> مربوط على شبكة الوزارة الداخلية فقط (ليس على الإنترنت).

---

## تشغيل التطبيق (Next.js) بـ Docker

التطبيق خدمة اسمها `app` داخل نفس الكومبوز، لكنها خلف
[compose profile](https://docs.docker.com/compose/profiles/) — عشان الخطوة ٤
فوق تشتغل قبل ما تكون صورة التطبيق جاهزة. الصورة **لا تُبنى على السيرفر**:
نبنيها على جهاز فيه إنترنت وننقلها.

### 1) ابنِ الصورة (على جهاز فيه إنترنت)

> ⚠️ **عنوان السيرفر ينحقن داخل الصورة وقت البناء.** متغيرات `NEXT_PUBLIC_*`
> تُطبع داخل حزمة المتصفح، فلو تغيّر الـ IP لازم إعادة بناء. **ثبّت IP ثابت
> للسيرفر (أو اسم داخلي في DNS الوزارة) قبل هذه الخطوة.**

```bash
docker build \
  --build-arg NEXT_PUBLIC_SUPABASE_URL=http://10.0.0.5:8000 \
  --build-arg NEXT_PUBLIC_SUPABASE_ANON_KEY=<ANON_KEY> \
  -t registry-app:latest .
```

الصورة تتضمن Chromium وخط عربي للنظام — تصدير الـ PDF يحتاجهما، لأن ترويسة
الصفحة وتذييلها يُرسمان خارج سياق الصفحة فلا يصلهما خط التطبيق. هذا يكبّر
الصورة بحدود ‎500MB؛ متوقّع.

### 2) انقلها للسيرفر (إذا ما عنده إنترنت)

```bash
docker save registry-app:latest | gzip > registry-app.tar.gz
# انقل الملف (USB / scp) ثم على السيرفر:
gunzip -c registry-app.tar.gz | docker load
```

نفس الشي ينطبق على صور Supabase: إذا السيرفر مقطوع عن الإنترنت نهائياً،
اسحبها على جهاز فيه إنترنت (`docker compose pull`) و`docker save` لها كلها.

### 3) شغّلها

قيم التطبيق موجودة أصلاً في نفس ملف `/opt/registry/.env` (لا يوجد
`.env.local` على السيرفر). راجع `APP_IMAGE` و`APP_PORT` و`CRON_SECRET`، ثم:

```bash
docker compose --profile app up -d
docker compose ps
```

التطبيق يصير على `http://10.0.0.5:3000` من **أي جهاز على شبكة الوزارة** —
الحاوية تستمع على `0.0.0.0` وليس `localhost`.

> لتحديث التطبيق لاحقاً: ابنِ صورة بوسم جديد، انقلها، بدّل `APP_IMAGE` في
> `.env`، ثم `docker compose --profile app up -d` (يعيد إنشاء الحاوية فقط).

### 4) بعد أول تشغيل

- **البكت الخاص**: Studio → Storage → أنشئ bucket باسم `private` و
  **"Public bucket" مطفأة**. التطبيق يقرأ عبر روابط موقّعة قصيرة فقط.
- **الكرون (إشعارات انتهاء المدة)**: على Vercel كان تلقائياً؛ محلياً أضف سطر
  crontab على السيرفر:

  ```bash
  0 7 * * *  curl -fsS -H "Authorization: Bearer <CRON_SECRET>" \
               http://127.0.0.1:3000/api/cron/term-notifications
  ```

### تشغيل التطبيق خارج Docker (بديل)

لو فضّلت تشغيله مباشرة بـ Node على السيرفر: ضع `.env.local` بقيم الكتلة
الثانية من `generate-secrets.mjs`، ثم `npm run build && npm start`. عندها
`DATABASE_URL` لازم يستخدم IP السيرفر ومنفذ 5432 المفتوح (مو اسم الخدمة `db`)،
ولازم تثبّت Chromium يدوياً وتضبط `PUPPETEER_EXECUTABLE_PATH` لأجل الـ PDF.

---

## الأمان (إلزامي لمشروع حكومي)

1. **بدّلت كل الأسرار الافتراضية؟** لا تترك أي قيمة من `.env.sample` كما هي.
2. **جدار حماية**: افتح فقط منافذ الشبكة الداخلية (`3000` للتطبيق، `8000` لـ
   Supabase، و`5432` عند اللزوم فقط). لا تعرّض أي شيء على الإنترنت.
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

### اختبر الاستعادة — النسخة غير المختبَرة ليست نسخة احتياطية

هذه ليست نصيحة عامة. الإصداران الأولان من هذين السكربتين **بدَوَا** ناجحين
وكانا يفشلان فعلياً، بطريقتين لا يكشفهما أي فحص للأحجام أو الأعداد:

| ما بدا | ما حدث فعلاً |
|---|---|
| `Done.` بعد استعادة القاعدة | كل `COPY` أُلغيت على أول مفتاح مكرر — لم يُستعد صف واحد |
| ٧ ملفات عادت بأحجامها الصحيحة | فُقدت الـ extended attributes فصار كل تحميل يرجع **500** |

الثاني هو الأخبث: الملفات تعود مطابقة بايت ببايت، ويبدو كل شيء سليماً حتى
يضغط أول مستخدم على مرفق. لذلك `tar` هنا يعمل بـ `--xattrs` وداخل صورة فيها
**GNU tar** (نسخة busybox في `alpine` تتجاهل الخيار بصمت).

اختبر الدورة كاملة **قبل الإطلاق**، على بيانات حقيقية، وقارن بصمة لا أعداداً:

```bash
# 1) بصمة قبل
docker exec supabase-db psql -U postgres -tAc \
  "select count(*)||' '||md5(string_agg(name,'|' order by id)) from public.organizations"

# 2) نسخة، ثم كارثة مُتعمَّدة، ثم استعادة
./backup.sh
docker exec supabase-db psql -U postgres -c "TRUNCATE public.organizations CASCADE"
./restore.sh <db-*.sql.gz> <storage-*.tar.gz>

# 3) البصمة يجب أن تتطابق حرفياً — ثم جرّب فتح مرفق فعلياً (يجب 200 لا 500)
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
| `docker compose up` يقول image not found لـ `app` | ما بنيت/حمّلت الصورة بعد، أو `APP_IMAGE` وسمها غلط — راجع `docker images` |
| المتصفح يتكلم مع Supabase غلط بعد تغيير الـ IP | العنوان محقون وقت البناء — أعد بناء الصورة بـ `--build-arg NEXT_PUBLIC_SUPABASE_URL` الجديد |
| معاينة الملفات المرفوعة ما تظهر (صور) | تأكد أن الصورة مبنية بنفس `NEXT_PUBLIC_SUPABASE_URL` — `next.config.ts` يشتق منه إذن `next/image` |
| تصدير PDF يفشل | `docker compose logs app`؛ تأكد أن `PUPPETEER_EXECUTABLE_PATH=/usr/bin/chromium` موجود داخل الحاوية (`docker compose exec app env \| grep PUPPETEER`) |
| تصدير PDF يعلّق أو ينتهي بمهلة | الحاوية تفتح صفحة الطباعة عبر عنوانها الخارجي؛ لو ما قدرت توصل نفسها أضف لخدمة `app`:‏ `extra_hosts: ["10.0.0.5:host-gateway"]` |
| ترويسة الـ PDF تطلع مربعات | خط النظام العربي ناقص — الصورة تثبّت `fonts-noto-core`؛ تأكد أنك تبني بأحدث `Dockerfile` |
| تحميل مرفق يرجع **500** بعد استعادة | فُقدت الـ extended attributes: `docker compose logs storage` يظهر `ENODATA`. النسخة أُخذت أو استُخرجت بـ busybox tar — أعد بـ `TAR_IMAGE` فيها GNU tar. لإصلاح ملفات موجودة: أعد رفعها عبر الـ API |
| الاستعادة تطبع `Done.` ولا شيء يتغيّر | نسخة قديمة الصيغة (`pg_dumpall` بلا `--clean`): كل `COPY` تُلغى على أول مفتاح مكرر. خذ نسخة جديدة بـ `backup.sh` الحالي |
