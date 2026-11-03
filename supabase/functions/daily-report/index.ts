// Edge Function: بتبعت تقرير آخر اليوم على إيميل جوجل بتاع كل مستخدم مفعّل الخيار.
// بتتنده من pg_cron كل 10 دقايق (header: x-cron-secret) أو من زرار "ابعت تقرير تجريبي" (JWT المستخدم).
// أسرار لازمة:  RESEND_API_KEY  CRON_SECRET   (اختياري) REPORT_FROM
// SUPABASE_URL و SUPABASE_SERVICE_ROLE_KEY بيتحطوا تلقائي.
import { createClient } from 'npm:@supabase/supabase-js@2';
import { processUser, prayersMap } from '../_shared/run.js';
import { localParts } from '../_shared/report-core.js';

const URL_ = Deno.env.get('SUPABASE_URL')!;
const SERVICE = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;
const RESEND = Deno.env.get('RESEND_API_KEY') ?? '';
const CRON = Deno.env.get('CRON_SECRET') ?? '';
const FROM = Deno.env.get('REPORT_FROM') ?? 'مُخطّطي <onboarding@resend.dev>';
const admin = createClient(URL_, SERVICE, { auth: { persistSession: false } });

const cors = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, apikey, content-type, x-client-info',
  'Access-Control-Allow-Methods': 'POST, OPTIONS',
};
const json = (b: unknown, status = 200) => new Response(JSON.stringify(b), { status, headers: { ...cors, 'Content-Type': 'application/json' } });

async function send(m: { to: string; subject: string; html: string; text: string }) {
  if (!RESEND) throw new Error('RESEND_API_KEY مش متظبط');
  const r = await fetch('https://api.resend.com/emails', {
    method: 'POST',
    headers: { Authorization: `Bearer ${RESEND}`, 'Content-Type': 'application/json' },
    body: JSON.stringify({ from: FROM, to: [m.to], subject: m.subject, html: m.html, text: m.text }),
  });
  if (!r.ok) throw new Error(`Resend ${r.status}: ${(await r.text()).slice(0, 300)}`);
}

async function forUser(userId: string, email: string | undefined, force: boolean) {
  const { data: rows, error } = await admin.from('records').select('kind,id,data,deleted').eq('user_id', userId).in('kind', ['setting', 'task', 'prayer', 'report']).eq('deleted', false);
  if (error) throw error;
  const by = (k: string) => (rows ?? []).filter((r) => r.kind === k);
  const settings = by('setting').find((r) => r.id === 'main')?.data ?? {};
  const now = new Date();
  const today = localParts(now, settings.tz).date;
  const existing = by('report').find((r) => r.id === today)?.data;
  return processUser({
    email, settings, existing, now, force,
    tasks: by('task').map((r) => r.data),
    prayers: prayersMap(by('prayer'), today),
    send,
    save: async (report) => {
      const { error: e } = await admin.from('records').upsert({ user_id: userId, kind: 'report', id: report.date, data: report, deleted: false, updated_at: new Date().toISOString() });
      if (e) throw e;
    },
  });
}

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response('ok', { headers: cors });
  if (req.method !== 'POST') return json({ error: 'POST only' }, 405);
  try {
    // 1) استدعاء من الـ cron
    const secret = req.headers.get('x-cron-secret');
    if (secret) {
      if (!CRON || secret !== CRON) return json({ error: 'forbidden' }, 403);
      const { data: cands, error } = await admin.from('records').select('user_id,data').eq('kind', 'setting').eq('id', 'main').eq('deleted', false).filter('data->>emailReport', 'eq', 'true');
      if (error) throw error;
      let sent = 0; const errors: string[] = [];
      for (const c of cands ?? []) {
        try {
          const { data: u } = await admin.auth.admin.getUserById(c.user_id);
          const res = await forUser(c.user_id, u?.user?.email, false);
          if (res.sent) sent++;
        } catch (e) { errors.push(`${c.user_id.slice(0, 8)}: ${(e as Error).message}`); }
      }
      return json({ checked: cands?.length ?? 0, sent, errors });
    }
    // 2) استدعاء من المستخدم (تقرير تجريبي)
    const token = (req.headers.get('authorization') ?? '').replace(/^Bearer\s+/i, '');
    if (!token) return json({ error: 'unauthorized' }, 401);
    const { data: u, error: ue } = await admin.auth.getUser(token);
    if (ue || !u?.user) return json({ error: 'unauthorized' }, 401);
    const res = await forUser(u.user.id, u.user.email, true);
    return json({ ok: true, to: u.user.email, ...res });
  } catch (e) {
    return json({ error: (e as Error).message }, 500);
  }
});
