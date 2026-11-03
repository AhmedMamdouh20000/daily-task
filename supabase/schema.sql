-- مُخطّطي — قاعدة البيانات (Supabase / Postgres)
-- شغّل الملف ده كله مرة واحدة من: SQL Editor ← New query ← Run

-- جدول واحد لكل البيانات. كل صف = سجل واحد (مهمة/احتياج/مناسبة/صلاة/إعداد/تقرير)
create table if not exists public.records (
  user_id    uuid        not null default auth.uid() references auth.users(id) on delete cascade,
  kind       text        not null check (kind in ('task','need','event','prayer','setting','report')),
  id         text        not null check (char_length(id) between 1 and 80),
  data       jsonb       not null default '{}'::jsonb check (pg_column_size(data) < 20000),
  deleted    boolean     not null default false,
  updated_at timestamptz not null default now(),  -- وقت التعديل عند العميل (الأحدث يكسب)
  server_at  timestamptz not null default now(),  -- وقت وصوله للسيرفر (للمزامنة التزايدية)
  primary key (user_id, kind, id)
);

create index if not exists records_pull_idx on public.records (user_id, server_at);

-- أمان: كل مستخدم يشوف ويعدّل صفوفه هو بس
alter table public.records enable row level security;

drop policy if exists "own rows select" on public.records;
drop policy if exists "own rows insert" on public.records;
drop policy if exists "own rows update" on public.records;
drop policy if exists "own rows delete" on public.records;
create policy "own rows select" on public.records for select to authenticated using (user_id = auth.uid());
create policy "own rows insert" on public.records for insert to authenticated with check (user_id = auth.uid());
create policy "own rows update" on public.records for update to authenticated using (user_id = auth.uid()) with check (user_id = auth.uid());
create policy "own rows delete" on public.records for delete to authenticated using (user_id = auth.uid());

-- ترتيب التعديلات: السيرفر بيختم server_at، وبيتجاهل أي تعديل أقدم من اللي عنده
create or replace function public.records_guard() returns trigger
language plpgsql as $$
begin
  if tg_op = 'UPDATE' and new.updated_at < old.updated_at then
    return null;               -- تعديل قديم وصل متأخر: نتجاهله
  end if;
  new.server_at := clock_timestamp();
  return new;
end $$;

drop trigger if exists records_guard on public.records;
create trigger records_guard before insert or update on public.records
  for each row execute function public.records_guard();

-- صلاحيات صريحة (المستخدم المجهول مالوش دعوة)
revoke all on public.records from anon;
grant select, insert, update, delete on public.records to authenticated;

-- ============================================================
-- (اختياري) إرسال التقرير اليومي على الإيميل — بعد ما تنشر الدالة:
--   supabase functions deploy daily-report --no-verify-jwt
-- فعّل الإضافتين من Database ← Extensions: pg_cron و pg_net
-- وبعدين شغّل ده (بدّل <REF> و<CRON_SECRET>):
--
-- select cron.schedule('daily-report-every-10-min', '*/10 * * * *', $$
--   select net.http_post(
--     url     := 'https://<REF>.supabase.co/functions/v1/daily-report',
--     headers := jsonb_build_object('Content-Type','application/json','x-cron-secret','<CRON_SECRET>'),
--     body    := '{}'::jsonb
--   );
-- $$);
-- ============================================================
