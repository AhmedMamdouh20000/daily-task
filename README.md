# 📅 مُخطّطي

تطبيق ويب (PWA) للمهام والميزانية الشهرية: مهام بوقت وتاريخ وتذكيرات، داشبورد متحركة بنسبة الإنجاز، تقرير آخر اليوم، حساب الراتب والاحتياجات والمواصلات (مع ادخار اختياري)، وتذكير بأعياد الميلاد قبلها بـ 5 أيام.

HTML + CSS + JavaScript عادي، من غير أي build أو مكتبات. البيانات بتتحفظ في المتصفح (localStorage).

## تشغيل محلي
```bash
npx serve .
# أو افتح index.html مباشرة في المتصفح
```

## الرفع على GitHub
```bash
git init
git add .
git commit -m "Initial commit"
git branch -M main
git remote add origin https://github.com/<USERNAME>/<REPO>.git
git push -u origin main
```

## النشر على Vercel
1. ادخل على vercel.com واعمل **Add New → Project**.
2. اختار الـ repo من GitHub.
3. **Framework Preset: Other** — سيب Build Command و Output Directory فاضيين.
4. دوس **Deploy**. كل `git push` بعد كده بيتنشر لوحده.

أو من الـ CLI: `npx vercel --prod`

## ملاحظات
- التنبيهات بتشتغل والصفحة مفتوحة أو متثبتة كتطبيق (Add to Home Screen). التنبيهات في الخلفية محتاجة تطبيق Flutter.
- الاستيراد من Google Calendar بملف `.ics`.
