# إعداد مُخطّطي

التطبيق بيشتغل **فورًا بوضع "على جهازي بس"** من غير أي إعداد. الخطوات دي لازمة **بس** لو عايز "سجّل بجوجل" + التقرير على Gmail.

## 1) النشر على Vercel (زي ما عملت قبل كده)
- ارفع محتويات المجلد ده على GitHub (فيه `index.html` في الجذر).
- Vercel: New Project ← اختار الريبو ← Framework: **Other** ← Root Directory: `./` ← Deploy. مفيش build.

## 2) Supabase (التخزين السحابي)
1. اعمل مشروع على supabase.com (الخطة المجانية تكفي).
2. **SQL Editor ← New query** ← الصق محتوى `supabase/schema.sql` ← Run.
3. **Project Settings ← API**: انسخ `Project URL` و`anon public key` وحطهم في `config.js`، وارفع التعديل.

## 3) تسجيل الدخول بجوجل
1. Google Cloud Console ← APIs & Services ← **Credentials ← Create OAuth client ID** (Web application).
2. **Authorized redirect URI**: `https://<REF>.supabase.co/auth/v1/callback`
3. Supabase ← **Authentication ← Providers ← Google**: فعّله والصق Client ID وSecret.
4. Supabase ← **Authentication ← URL Configuration**: Site URL = رابط Vercel بتاعك، وضيفه كمان في Redirect URLs.

## 4) تقرير آخر اليوم على الإيميل (اختياري)
1. حساب على resend.com ← انسخ API key.
   - بدون دومين متوثّق، Resend بيسمح بالإرسال **لإيميل صاحب الحساب بس**. استخدم نفس إيميل جوجل بتاعك عند التسجيل في Resend، أو وثّق دومين لو هتبعت لناس تانيين.
2. ثبّت Supabase CLI وسجّل دخول، وبعدين:
```
supabase link --project-ref <REF>
supabase secrets set RESEND_API_KEY=... CRON_SECRET=<أي نص طويل عشوائي>
supabase functions deploy daily-report --no-verify-jwt
```
3. Database ← Extensions: فعّل **pg_cron** و**pg_net**، وشغّل الأمر الموجود آخر `schema.sql` (بعد ما تبدّل `<REF>` و`<CRON_SECRET>`).
4. في التطبيق: المزيد ← الإيميل ← فعّل التقرير واضغط **ابعت تقرير تجريبي**.

لو قفلت الخيار، التقرير بيتحفظ محلي (وفي حسابك) بس ومبيتبعتش إيميل.

## الاختبارات
```
node tests/unit.mjs && node scripts/check-shared.mjs
python3 -m http.server 8123 &   # وبعدين:
npm i playwright && node tests/e2e.js
```
> لو عدّلت `js/core/report-core.js` انسخه فوق `supabase/functions/_shared/report-core.js` وأعد نشر الدالة.
