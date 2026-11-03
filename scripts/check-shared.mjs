import { readFileSync } from 'node:fs';
const a = readFileSync(new URL('../js/core/report-core.js', import.meta.url), 'utf8');
const b = readFileSync(new URL('../supabase/functions/_shared/report-core.js', import.meta.url), 'utf8');
if (a !== b) { console.error('report-core.js مختلف بين التطبيق والسيرفر — انسخه تاني'); process.exit(1); }
console.log('report-core متطابق');
