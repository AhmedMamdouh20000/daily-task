/* قراءة ملفات iCalendar (.ics) من جوجل كاليندر: بنطلّع المناسبات (SUMMARY + تاريخ البداية + تكرار سنوي) */
const unesc = s => s.replace(/\\n/gi, ' ').replace(/\\([,;\\])/g, '$1').trim();

export function parseICS(text) {
  const lines = String(text).replace(/\r\n?/g, '\n').replace(/\n[ \t]/g, '').split('\n');
  const out = []; let cur = null;
  for (const ln of lines) {
    if (ln === 'BEGIN:VEVENT') { cur = {}; continue; }
    if (ln === 'END:VEVENT') {
      if (cur && cur.name && cur.date) {
        const yearly = /FREQ=YEARLY/i.test(cur.rrule || '') || /birthday|ميلاد/i.test(cur.name);
        out.push({ name: cur.name.slice(0, 100), date: cur.date, yearly });
      }
      cur = null; continue;
    }
    if (!cur) continue;
    const i = ln.indexOf(':'); if (i < 0) continue;
    const key = ln.slice(0, i).split(';')[0].toUpperCase(), val = ln.slice(i + 1);
    if (key === 'SUMMARY') cur.name = unesc(val);
    else if (key === 'DTSTART') { const m = val.match(/^(\d{4})(\d{2})(\d{2})/); if (m) cur.date = `${m[1]}-${m[2]}-${m[3]}`; }
    else if (key === 'RRULE') cur.rrule = val;
  }
  return out;
}
