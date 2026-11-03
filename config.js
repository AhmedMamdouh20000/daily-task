// إعدادات الربط بـ Supabase (اختياري — من غيرها التطبيق بيشتغل محلي بس).
// الـ anon key مقصود يبقى علني؛ الأمان بييجي من Row Level Security في schema.sql.
// خطوات الإعداد كاملة في SETUP.md
export const SUPABASE_URL = '';       // مثال: https://abcdxyz.supabase.co
export const SUPABASE_ANON_KEY = '';  // Project Settings ← API ← anon public
