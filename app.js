'use strict';
/* مُخطّطي — كل البيانات بتتحفظ في المتصفح (localStorage) */
const KEY='planner_v2',OLD='planner_v1';
const TABS=['dash','tasks','budget','cal'];
const $=id=>document.getElementById(id);
const esc=s=>String(s).replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
const pad=n=>String(n).padStart(2,'0');
const fmt=d=>d.getFullYear()+'-'+pad(d.getMonth()+1)+'-'+pad(d.getDate());
const parse=s=>{const [y,m,d]=s.split('-').map(Number);return new Date(y,m-1,d)};
const addDays=(s,n)=>{const d=parse(s);d.setDate(d.getDate()+n);return fmt(d)};
const today=()=>fmt(new Date());
const uid=()=>Math.random().toString(36).slice(2,9);
const AR_DAYS=['الأحد','الإثنين','التلات','الأربع','الخميس','الجمعة','السبت'];
const AR_SHORT=['أحد','اتنين','تلات','أربع','خميس','جمعة','سبت'];
const AR_MON=['يناير','فبراير','مارس','أبريل','مايو','يونيو','يوليو','أغسطس','سبتمبر','أكتوبر','نوفمبر','ديسمبر'];
const dlong=s=>{const d=parse(s);return AR_DAYS[d.getDay()]+' '+d.getDate()+' '+AR_MON[d.getMonth()]};
const rel=s=>s===today()?'النهارده':s===addDays(today(),1)?'بكرة':s===addDays(today(),-1)?'امبارح':dlong(s);
const num=n=>Math.round(n).toLocaleString('en-US');
const money=n=>(n<0?'‎-':'')+num(Math.abs(n))+' ج';
const SEG=[{k:'done',n:'تمت',c:'var(--ok)'},{k:'pend',n:'لسه',c:'var(--pri)'},{k:'post',n:'اتأجلت',c:'var(--warn)'},{k:'can',n:'اتلغت',c:'var(--bad)'}];

/* ---------- الحالة ---------- */
let S;
function load(){
  let raw=null;
  try{raw=JSON.parse(localStorage.getItem(KEY))}catch(e){}
  if(!raw){try{const o=JSON.parse(localStorage.getItem(OLD));if(o){raw=o;if(raw.budget&&raw.budget.saveOn===undefined){raw.budget.saveOn=true;raw.budget.savePct=30}}}catch(e){}}
  S=(raw&&typeof raw==='object')?raw:{};
  S.tasks=Array.isArray(S.tasks)?S.tasks:[];
  S.events=Array.isArray(S.events)?S.events:[];
  S.notified=(S.notified&&typeof S.notified==='object')?S.notified:{};
  S.budget=Object.assign({salary:'',transport:'',days:22,saveOn:false,savePct:30,needs:[]},S.budget||{});
  if(!Array.isArray(S.budget.needs))S.budget.needs=[];
  S.settings=Object.assign({eve:'21:00',sound:true},S.settings||{});
}
function save(){try{localStorage.setItem(KEY,JSON.stringify(S))}catch(e){}}
load();

let cur='dash',viewDay=today(),dashDay=today(),lastDay=today(),popId=null;

/* ---------- أدوات رسم ---------- */
function animateNum(el,to,suf){
  suf=suf||'';const from=parseFloat(el.dataset.v||0);el.dataset.v=to;
  cancelAnimationFrame(el._r);const t0=performance.now(),dur=800;
  const step=t=>{const p=Math.min(1,(t-t0)/dur),e=1-Math.pow(1-p,3);el.textContent=Math.round(from+(to-from)*e)+suf;if(p<1)el._r=requestAnimationFrame(step)};
  el._r=requestAnimationFrame(step);
}
function toast(msg){const t=document.createElement('div');t.className='toast';t.textContent=msg;$('toasts').appendChild(t);setTimeout(()=>t.remove(),6000)}
function confetti(){
  const cols=['#22a559','#4f46e5','#e8912d','#e879a8','#38bdf8'];
  for(let i=0;i<28;i++){const s=document.createElement('i');s.className='conf';
    s.style.left=(Math.random()*100)+'vw';s.style.background=cols[i%cols.length];
    s.style.setProperty('--x',(Math.random()*160-80)+'px');s.style.animationDelay=(Math.random()*.35)+'s';
    document.body.appendChild(s);setTimeout(()=>s.remove(),2200)}
}
function openM(id){$(id).classList.add('show')}
function closeM(){document.querySelectorAll('.modal').forEach(m=>m.classList.remove('show'))}

/* ---------- تنقل بين التابات ---------- */
function syncFab(){$('fab').classList.toggle('hide',!(cur==='dash'||cur==='tasks'))}
function go(t){
  if(t===cur){window.scrollTo({top:0,behavior:'smooth'});return}
  const ni=TABS.indexOf(t),ci=TABS.indexOf(cur);if(ni<0)return;
  document.querySelectorAll('.tab').forEach(x=>x.classList.remove('on','from-l','from-r'));
  $('tab-'+t).classList.add('on',ni>ci?'from-l':'from-r');
  document.querySelectorAll('nav button').forEach(b=>b.classList.toggle('on',b.dataset.t===t));
  $('ind').style.right=(ni*25)+'%';
  cur=t;syncFab();window.scrollTo({top:0});render();
}
function step(dir){const i=TABS.indexOf(cur)+dir;if(i>=0&&i<TABS.length)go(TABS[i])}

/* سوايب يمين/شمال — الاتجاه RTL: السحب لليمين بيروح للتاب اللي على الشمال */
(function(){
  const main=$('main');let x0=0,y0=0,t0=0,lock=null,on=false;
  const reset=()=>{main.style.transition='transform .32s cubic-bezier(.22,1,.36,1),opacity .32s';main.style.transform='';main.style.opacity=''};
  document.addEventListener('touchstart',e=>{
    on=false;lock=null;
    if(e.touches.length!==1||document.querySelector('.modal.show'))return;
    if(e.target.closest&&e.target.closest('input,select,textarea,nav,.sheet,.alarm'))return;
    x0=e.touches[0].clientX;y0=e.touches[0].clientY;t0=Date.now();on=true;
  },{passive:true});
  document.addEventListener('touchmove',e=>{
    if(!on)return;const dx=e.touches[0].clientX-x0,dy=e.touches[0].clientY-y0;
    if(lock===null&&(Math.abs(dx)>10||Math.abs(dy)>10))lock=Math.abs(dx)>Math.abs(dy)*1.3?'x':'y';
    if(lock!=='x')return;
    const k=Math.abs(dx);main.style.transition='none';
    main.style.transform='translateX('+(dx*.35)+'px)';main.style.opacity=String(Math.max(.55,1-k/700));
  },{passive:true});
  document.addEventListener('touchend',e=>{
    if(!on)return;on=false;
    const dx=(e.changedTouches[0]?e.changedTouches[0].clientX:x0)-x0,dy=(e.changedTouches[0]?e.changedTouches[0].clientY:y0)-y0;
    const wasX=lock==='x';lock=null;
    if(wasX)reset();
    if(wasX&&Math.abs(dx)>70&&Math.abs(dx)>Math.abs(dy)*1.6&&Date.now()-t0<700)step(dx>0?1:-1);
  },{passive:true});
  document.addEventListener('touchcancel',()=>{if(on&&lock==='x')reset();on=false;lock=null},{passive:true});
  document.addEventListener('keydown',e=>{
    if(document.querySelector('.modal.show')||/INPUT|SELECT|TEXTAREA/.test((e.target.tagName||'')))return;
    if(e.key==='ArrowLeft')step(1);else if(e.key==='ArrowRight')step(-1);
  });
})();

/* ---------- المهام ---------- */
function shiftDay(n){viewDay=addDays(viewDay,n);renderTasks()}
function shiftDash(n){dashDay=addDays(dashDay,n);renderDash()}
function pickDay(d){dashDay=d;renderDash()}
function openTask(){
  $('t-title').value='';$('t-date').value=cur==='dash'?dashDay:viewDay;$('t-time').value='';$('t-far').value='0';
  openM('m-task');setTimeout(()=>$('t-title').focus(),60);
}
function planTomorrow(){viewDay=addDays(today(),1);openTask()}
function saveTask(){
  const title=$('t-title').value.trim(),date=$('t-date').value,time=$('t-time').value;
  if(!title||!date||!time){toast('كمّل العنوان والتاريخ والوقت');return}
  S.tasks.push({id:uid(),title,date,time,far:$('t-far').value==='1',status:'pending'});
  save();closeM();viewDay=date;if(cur==='dash')dashDay=date;render();
}
function setStatus(id,st){
  const t=S.tasks.find(x=>x.id===id);if(!t)return;
  if(st==='postponed'){
    if(t.status==='postponed')return;
    t.status='postponed';S.tasks.push({id:uid(),title:t.title,date:addDays(t.date,1),time:t.time,far:t.far,status:'pending'});
    toast('اتأجلت لبكرة');
  }else{t.status=(t.status===st)?'pending':st;if(t.status==='done')popId=id}
  save();render();
  if(t.status==='done'){const s=dayStats(t.date);if(s.total>0&&s.done===s.total){confetti();toast('🎉 خلصت كل مهام اليوم!')}}
}
function delTask(id){S.tasks=S.tasks.filter(x=>x.id!==id);save();render()}
function dayStats(d){
  const l=S.tasks.filter(t=>t.date===d),c=s=>l.filter(t=>t.status===s).length;
  const done=c('done'),can=c('cancelled'),post=c('postponed'),pend=c('pending');
  return{list:l,total:l.length,done,can,post,pend,pct:l.length?Math.round(done/l.length*100):0};
}
function renderTasks(){
  $('dlabel').textContent=rel(viewDay);$('dsub').textContent=dlong(viewDay);
  const list=S.tasks.filter(t=>t.date===viewDay).sort((a,b)=>a.time.localeCompare(b.time)),s=dayStats(viewDay);
  $('tptxt').textContent=s.done+' من '+s.total+' مهمة';$('tppct').textContent=s.pct+'%';$('tbar').style.width=s.pct+'%';
  const el=$('tasklist');
  if(!list.length)el.innerHTML='<div class="empty">مفيش مهام في اليوم ده 🎉<br>دوس + عشان تضيف</div>';
  else el.innerHTML=list.map(t=>{
    const st={done:'<span class="tag ok">تمت</span>',cancelled:'<span class="tag bad">ملغية</span>',postponed:'<span class="tag">اتأجلت</span>',pending:''}[t.status]||'';
    return `<div class="task ${t.status}">
      <button class="chk ${t.status==='done'?'done':''} ${popId===t.id?'pop':''}" onclick="setStatus('${t.id}','done')" aria-label="تمت">${t.status==='done'?'✓':''}</button>
      <div class="t"><b>${esc(t.title)}</b><span class="muted">🕐 ${esc(t.time)}</span>${t.far?'<span class="tag far">مشوار بعيد</span>':''}${st}</div>
      <div class="acts"><button title="تأجيل لبكرة" onclick="setStatus('${t.id}','postponed')">⏭</button><button title="إلغاء" onclick="setStatus('${t.id}','cancelled')">✕</button><button title="حذف" onclick="delTask('${t.id}')">🗑</button></div></div>`}).join('');
  popId=null;
  const tm=addDays(today(),1),hasTm=S.tasks.some(t=>t.date===tm),now=new Date(),nowHM=pad(now.getHours())+':'+pad(now.getMinutes());
  $('banner').innerHTML=(nowHM>=S.settings.eve&&!hasTm)?`<div class="banner"><span>🌙 لسه ما سجلتش مهام بكرة</span><button class="btn sm" onclick="planTomorrow()">سجّل دلوقتي</button></div>`:'';
}

/* ---------- الداشبورد ---------- */
const R=70,C=2*Math.PI*R;
function ensureDash(){
  $('kpis').innerHTML=`<div class="tile k1"><b id="k-total">0</b><span>إجمالي المهام</span></div><div class="tile k2"><b id="k-done">0</b><span>تمت</span></div><div class="tile k3"><b id="k-left">0</b><span>باقي</span></div>`;
  $('donut').innerHTML=`<svg width="176" height="176" viewBox="0 0 176 176" aria-hidden="true"><circle cx="88" cy="88" r="${R}" fill="none" stroke="var(--line)" stroke-width="16"/>${SEG.map(k=>`<circle data-k="${k.k}" cx="88" cy="88" r="${R}" fill="none" stroke="${k.c}" stroke-width="16" style="stroke-dasharray:0 ${C};stroke-dashoffset:0;transition:stroke-dasharray .95s cubic-bezier(.22,1,.36,1),stroke-dashoffset .95s cubic-bezier(.22,1,.36,1)"/>`).join('')}</svg><div class="c"><div><b id="dpct">0%</b><span class="muted">تم إنجازه</span></div></div>`;
  $('pctline').innerHTML=`<div><b id="p-done">0%</b><span id="p-donec">—</span></div><div><b id="p-left">0%</b><span id="p-leftc">—</span></div>`;
  $('sbar').innerHTML=SEG.map(k=>`<span data-b="${k.k}" style="background:${k.c};width:0"></span>`).join('');
  $('lg').innerHTML=SEG.map(k=>`<div><i style="background:${k.c}"></i>${k.n}<b id="lg-${k.k}">0</b></div>`).join('');
  $('dbudget').innerHTML=`<div class="row between"><h2 style="margin:0">ميزانية الشهر</h2><button class="btn ghost sm" onclick="go('budget')">فتح</button></div>
    <div class="bar tall" id="dbar" style="margin-top:12px">${BSEG.map(b=>`<span data-s="${b.k}" style="background:${b.c};width:0"></span>`).join('')}</div><div id="drows" style="margin-top:10px"></div>`;
}
function renderDonut(s){
  const total=s.total||1;let off=0;
  SEG.forEach(k=>{
    const len=s[k.k]/total*C,o=off,c=$('donut').querySelector(`[data-k="${k.k}"]`);
    requestAnimationFrame(()=>{c.style.strokeDasharray=`${len} ${C}`;c.style.strokeDashoffset=String(-o)});off+=len;
  });
  animateNum($('dpct'),s.pct,'%');
}
function streak(){
  let n=0,d=today();
  if(!S.tasks.some(t=>t.date===d&&t.status==='done'))d=addDays(d,-1);
  while(S.tasks.some(t=>t.date===d&&t.status==='done')){n++;d=addDays(d,-1)}
  return n;
}
function mins(at){return Math.max(0,Math.round((at-new Date())/60000))}
function ctext(m){if(m<1)return 'دلوقتي';const h=Math.floor(m/60),r=m%60;return 'بعد '+(h?h+' ساعة ':'')+(r?r+' دقيقة':'')}
function renderNext(){
  const now=new Date(),t0=today();
  const pend=S.tasks.filter(t=>t.date===t0&&t.status==='pending').map(t=>{const [h,m]=t.time.split(':').map(Number);return{t,at:new Date(now.getFullYear(),now.getMonth(),now.getDate(),h,m)}});
  const up=pend.filter(x=>x.at>=now).sort((a,b)=>a.at-b.at),late=pend.filter(x=>x.at<now).length;
  let h;
  if(up.length){const n=up[0];h=`<div class="row"><div class="ico">⏰</div><div style="flex:1;min-width:0"><div class="muted">المهمة الجاية${n.t.far?' (مشوار بعيد)':''}</div><b style="overflow-wrap:anywhere">${esc(n.t.title)}</b><div class="muted">🕐 ${esc(n.t.time)}</div></div><div class="cd"><b>${ctext(mins(n.at))}</b></div></div>`}
  else if(late)h=`<div class="row"><div class="ico">⚠️</div><div><b>فاتك ${late} مهمة النهارده</b><div class="muted">راجعهم من تاب المهام وأجّلهم أو كمّلهم</div></div></div>`;
  else h=`<div class="row"><div class="ico">🌿</div><div><b>مفيش مهام جاية النهارده</b><div class="muted">استمتع بوقتك أو ضيف مهمة جديدة</div></div></div>`;
  const bd=S.events.map(e=>({e,n:daysTo(nextOcc(e))})).filter(x=>x.n>=0&&x.n<=5).sort((a,b)=>a.n-b.n);
  if(bd.length)h+=bd.map(x=>`<div class="muted" style="margin-top:10px">${x.e.yearly?'🎂':'📌'} ${esc(x.e.name)} — ${x.n===0?'النهارده':'بعد '+x.n+' يوم'}</div>`).join('');
  $('nextcard').innerHTML=h;
}
function renderWeek(){
  const w=$('week'),t0=today();
  if(w.dataset.k!==t0){
    w.dataset.k=t0;let h='';
    for(let i=6;i>=0;i--){const d=addDays(t0,-i);h+=`<div class="wcol" data-d="${d}" onclick="pickDay('${d}')"><div class="wtrack"><div class="wbar"><div class="wfill"></div></div></div><b></b><span>${AR_SHORT[parse(d).getDay()]}</span></div>`}
    w.innerHTML=h;
  }
  w.querySelectorAll('.wcol').forEach(c=>{
    const d=c.dataset.d,x=dayStats(d),bar=c.querySelector('.wbar'),fill=c.querySelector('.wfill');
    c.classList.toggle('sel',d===dashDay);bar.classList.toggle('empty',!x.total);
    requestAnimationFrame(()=>{bar.style.height=x.total?'100%':'8px';fill.style.height=x.pct+'%'});
    c.querySelector('b').textContent=x.total?x.done+'/'+x.total:'—';
  });
  const n=streak();$('streak').textContent=n?'🔥 '+n+' يوم متواصل':'';
}
function renderDash(){
  const s=dayStats(dashDay);
  $('dlabel2').textContent=rel(dashDay);$('dsub2').textContent=dlong(dashDay);
  animateNum($('k-total'),s.total);animateNum($('k-done'),s.done);animateNum($('k-left'),s.total-s.done);
  renderDonut(s);
  const left=s.total?100-s.pct:0;
  animateNum($('p-done'),s.pct,'%');animateNum($('p-left'),left,'%');
  $('p-donec').textContent=s.total?s.done+' من '+s.total+' مهمة تمت':'مفيش مهام';
  $('p-leftc').textContent=s.total?(s.total-s.done)+' مهمة باقية':'—';
  SEG.forEach(k=>{document.querySelector(`#sbar [data-b="${k.k}"]`).style.width=(s.total?s[k.k]/s.total*100:0)+'%';$('lg-'+k.k).textContent=s[k.k]});
  renderNext();renderWeek();renderDashBudget();
  const ic={done:'✅',cancelled:'❌',postponed:'⏭',pending:'⏳'};
  $('rlist').innerHTML=s.list.length?s.list.slice().sort((a,b)=>a.time.localeCompare(b.time)).map(t=>`<div class="kv"><span>${ic[t.status]} ${esc(t.title)}</span><span class="muted">${esc(t.time)}</span></div>`).join(''):'<div class="empty">مفيش مهام في اليوم ده</div>';
}

/* ---------- الميزانية ---------- */
const BSEG=[{k:'sav',c:'var(--ok)'},{k:'needs',c:'var(--pri)'},{k:'tr',c:'var(--warn)'},{k:'ent',c:'var(--pink)'}];
function calc(){
  const b=S.budget,sal=parseFloat(b.salary)||0,tr=(parseFloat(b.transport)||0)*(parseFloat(b.days)||0);
  const needs=b.needs.reduce((a,n)=>a+n.price,0),paid=b.needs.filter(n=>n.paid).reduce((a,n)=>a+n.price,0);
  const pct=Math.min(100,Math.max(0,parseFloat(b.savePct)||0)),sav=b.saveOn?sal*pct/100:0,ent=sal-sav-needs-tr;
  const now=new Date(),dim=new Date(now.getFullYear(),now.getMonth()+1,0).getDate(),left=dim-now.getDate()+1;
  return{sal,tr,needs,paid,sav,pct,ent,left,perDay:ent/left,on:b.saveOn};
}
function fillBar(el,c){
  const p=v=>c.sal?Math.max(0,v/c.sal*100):0,v={sav:p(c.sav),needs:p(c.needs),tr:p(c.tr),ent:p(Math.max(c.ent,0))};
  Object.keys(v).forEach(k=>{el.querySelector(`[data-s="${k}"]`).style.width=v[k]+'%'});
}
function ensureBudget(){
  $('summary').innerHTML=`<h2>الملخص</h2><div class="bar tall" id="sumbar">${BSEG.map(b=>`<span data-s="${b.k}" style="background:${b.c};width:0"></span>`).join('')}</div><div id="sumrows" style="margin-top:10px"></div><div id="sumday"></div>`;
}
function saveBudget(){
  const b=S.budget;
  b.salary=$('b-salary').value;b.transport=$('b-transport').value;b.days=$('b-days').value;
  b.saveOn=$('b-saveon').checked;b.savePct=$('b-savepct').value;
  save();syncSave();renderSummary();renderDashBudget();
}
function syncSave(){const on=S.budget.saveOn;$('savebox').className=on?'on':'off';$('b-savepct').disabled=!on}
function openNeed(){$('n-name').value='';$('n-price').value='';$('n-day').value='';openM('m-need')}
function saveNeed(){
  const name=$('n-name').value.trim(),price=parseFloat($('n-price').value);
  if(!name||!(price>=0)){toast('اكتب الاسم والسعر');return}
  S.budget.needs.push({id:uid(),name,price,day:parseInt($('n-day').value)||0,paid:false});save();closeM();render();
}
function togglePaid(id){const n=S.budget.needs.find(x=>x.id===id);if(n){n.paid=!n.paid;save();render()}}
function delNeed(id){S.budget.needs=S.budget.needs.filter(x=>x.id!==id);save();render()}
function renderBudget(){
  const b=S.budget,a=document.activeElement&&document.activeElement.id;
  if(a!=='b-salary')$('b-salary').value=b.salary;
  if(a!=='b-transport')$('b-transport').value=b.transport;
  if(a!=='b-days')$('b-days').value=b.days;
  if(a!=='b-savepct')$('b-savepct').value=b.savePct;
  $('b-saveon').checked=!!b.saveOn;syncSave();
  const c=calc();
  $('needlist').innerHTML=b.needs.length?`<div class="muted" style="margin:6px 0">اتدفع ${money(c.paid)} من ${money(c.needs)}</div>`+b.needs.map(n=>`<div class="task ${n.paid?'done':''}"><button class="chk ${n.paid?'done':''}" onclick="togglePaid('${n.id}')" aria-label="اتدفع">${n.paid?'✓':''}</button><div class="t"><b>${esc(n.name)}</b><span class="muted">${money(n.price)}${n.day?' • يوم '+n.day:''}</span></div><div class="acts"><button onclick="delNeed('${n.id}')">🗑</button></div></div>`).join(''):'<div class="empty">ضيف احتياجاتك الشهرية (إيجار، فواتير...)</div>';
  renderSummary();
}
function renderSummary(){
  const c=calc();fillBar($('sumbar'),c);
  $('sumrows').innerHTML=(c.on?`<div class="kv"><span>🟢 ادخار (${num(c.pct)}%)</span><b>${money(c.sav)}</b></div>`:'')+
    `<div class="kv"><span>🟣 احتياجات الشهر</span><b>${money(c.needs)}</b></div>
     <div class="kv"><span>🟠 مواصلات الشهر</span><b>${money(c.tr)}</b></div>
     <div class="kv"><span>🩷 ${c.on?'المتبقي للترفيه':'المتبقي للصرف'}</span><b class="${c.ent<0?'neg':''}">${money(c.ent)}</b></div>`;
  $('sumday').innerHTML=c.sal?`<div class="card" style="margin:12px 0 0;background:var(--pri-soft);border:0;box-shadow:none"><div class="muted">تقدر تصرف في اليوم (باقي ${c.left} يوم)</div><div class="big ${c.perDay<0?'neg':''}">${money(c.perDay)}</div></div>`+(c.ent<0?'<div class="banner" style="margin:12px 0 0">⚠️ المصاريف أكتر من الراتب</div>':''):'<div class="muted" style="margin-top:10px">اكتب الراتب علشان يتحسب الباقي.</div>';
}
function renderDashBudget(){
  const c=calc();fillBar($('dbar'),c);
  $('drows').innerHTML=c.sal?`<div class="kv"><span>الراتب</span><b>${money(c.sal)}</b></div>`+(c.on?`<div class="kv"><span>🟢 ادخار</span><b>${money(c.sav)}</b></div>`:'')+`<div class="kv"><span>🩷 تقدر تصرف في اليوم</span><b class="${c.perDay<0?'neg':''}">${money(c.perDay)}</b></div>`:'<div class="muted">ضيف راتبك من تاب الميزانية علشان تشوف الحسبة هنا.</div>';
}

/* ---------- المناسبات ---------- */
function openEvent(){$('e-name').value='';$('e-date').value='';$('e-yearly').value='1';openM('m-event')}
function saveEvent(){
  const name=$('e-name').value.trim(),date=$('e-date').value;
  if(!name||!date){toast('اكتب الاسم والتاريخ');return}
  S.events.push({id:uid(),name,date,yearly:$('e-yearly').value==='1'});save();closeM();render();
}
function delEvent(id){S.events=S.events.filter(x=>x.id!==id);save();render()}
function nextOcc(e){
  const d=parse(e.date);if(!e.yearly)return d;
  const n=new Date(),t=new Date(n.getFullYear(),n.getMonth(),n.getDate());
  let o=new Date(t.getFullYear(),d.getMonth(),d.getDate());if(o<t)o=new Date(t.getFullYear()+1,d.getMonth(),d.getDate());return o;
}
function daysTo(d){const n=new Date();return Math.round((d-new Date(n.getFullYear(),n.getMonth(),n.getDate()))/864e5)}
function renderEvents(){
  const arr=S.events.map(e=>({e,o:nextOcc(e)})).filter(x=>daysTo(x.o)>=0).sort((a,b)=>a.o-b.o);
  $('eventlist').innerHTML=arr.length?arr.map(({e,o})=>{
    const n=daysTo(o),tag=n===0?'<span class="tag ok">النهارده 🎉</span>':n<=5?`<span class="tag far">بعد ${n} يوم</span>`:`<span class="tag">بعد ${n} يوم</span>`;
    return `<div class="task"><div style="font-size:24px">${e.yearly?'🎂':'📌'}</div><div class="t"><b>${esc(e.name)}</b><span class="muted">${dlong(fmt(o))}</span>${tag}</div><div class="acts"><button onclick="delEvent('${e.id}')">🗑</button></div></div>`}).join(''):'<div class="empty">مفيش مناسبات جاية</div>';
}
function importICS(inp){
  const f=inp.files[0];if(!f)return;const r=new FileReader();
  r.onload=()=>{
    const txt=String(r.result).replace(/\r?\n[ \t]/g,'');let c=0;
    txt.split('BEGIN:VEVENT').slice(1).forEach(b=>{
      const sm=b.match(/SUMMARY[^:\r\n]*:(.*)/),dm=b.match(/DTSTART[^:\r\n]*:(\d{4})(\d{2})(\d{2})/);if(!sm||!dm)return;
      const date=dm[1]+'-'+dm[2]+'-'+dm[3],yearly=/RRULE:[^\n]*FREQ=YEARLY/.test(b);
      const name=sm[1].trim().replace(/\\,/g,',').replace(/\\;/g,';').slice(0,80);
      if(!name||S.events.some(e=>e.name===name&&e.date===date))return;
      S.events.push({id:uid(),name,date,yearly});c++;
    });
    save();render();toast('اتضاف '+c+' مناسبة من الملف');inp.value='';
  };
  r.readAsText(f);
}

/* ---------- التنبيهات ---------- */
let actx=null,ringT=null,ringStop=null,titleT=null,alarmQ=[];
const baseTitle=document.title;
function primeAudio(){
  try{
    if(!actx){const AC=window.AudioContext||window.webkitAudioContext;if(AC)actx=new AC()}
    if(actx&&actx.state==='suspended')actx.resume();
  }catch(e){}
}
['pointerdown','keydown','touchstart'].forEach(ev=>document.addEventListener(ev,primeAudio,{passive:true}));
function beepOnce(){
  if(S.settings.sound===false||!actx)return;
  const go=()=>{
    try{
      const t=actx.currentTime;
      [[0,880],[.28,880],[.56,1175]].forEach(([d,f])=>{
        const o=actx.createOscillator(),g=actx.createGain();
        o.type='sine';o.frequency.value=f;
        g.gain.setValueAtTime(0.0001,t+d);g.gain.linearRampToValueAtTime(.35,t+d+.02);g.gain.exponentialRampToValueAtTime(.001,t+d+.24);
        o.connect(g);g.connect(actx.destination);o.start(t+d);o.stop(t+d+.26);
      });
    }catch(e){}
  };
  if(actx.state==='running')go();else actx.resume().then(()=>{if(actx.state==='running')go()}).catch(()=>{});
}
function startRing(){
  stopRing();
  if(S.settings.sound===false)return;
  primeAudio();beepOnce();
  ringT=setInterval(beepOnce,2200);
  ringStop=setTimeout(stopRing,40000);
}
function stopRing(){clearInterval(ringT);clearTimeout(ringStop);ringT=ringStop=null}
function flashTitle(msg){
  clearInterval(titleT);titleT=null;
  if(!document.hidden)return;
  let on=false;
  titleT=setInterval(()=>{on=!on;document.title=on?msg:baseTitle},900);
}
function stopFlash(){clearInterval(titleT);titleT=null;document.title=baseTitle}
document.addEventListener('visibilitychange',()=>{if(!document.hidden)stopFlash()});
window.addEventListener('focus',stopFlash);

/* نافذة المنبّه: بتفضل ظاهرة والصوت شغال لحد ما تقفلها */
function showAlarm(a){alarmQ.push(a);if(!$('m-alarm').classList.contains('show'))nextAlarm();else $('al-more').textContent='+ '+(alarmQ.length-1)+' تنبيه تاني'}
function nextAlarm(){
  const a=alarmQ[0];
  if(!a){$('m-alarm').classList.remove('show');stopRing();stopFlash();return}
  $('al-title').textContent=a.title;$('al-body').textContent=a.body||'';
  $('al-more').textContent=alarmQ.length>1?'+ '+(alarmQ.length-1)+' تنبيه تاني':'';
  $('al-done').style.display=a.taskId?'':'none';
  $('m-alarm').classList.add('show');
  startRing();
}
function dismissAlarm(){alarmQ.shift();nextAlarm()}
function alarmDone(){
  const a=alarmQ[0];
  if(a&&a.taskId){const t=S.tasks.find(x=>x.id===a.taskId);if(t&&t.status!=='done')setStatus(a.taskId,'done')}
  dismissAlarm();
}
function snooze(min){
  const a=alarmQ[0];
  if(a){
    setTimeout(()=>{
      if(a.taskId){const t=S.tasks.find(x=>x.id===a.taskId);if(!t||t.status!=='pending')return}
      notify(a.title,'تذكير تاني',{alarm:true,taskId:a.taskId,tag:a.tag});
    },min*60000);
    toast('هفكّرك بعد '+min+' دقايق');
  }
  dismissAlarm();
}

function notify(title,body,opt){
  opt=opt||{};
  if(opt.alarm){showAlarm({title,body,taskId:opt.taskId,tag:opt.tag});flashTitle('🔔 '+title)}
  else{toast(title+(body?' — '+body:''));beepOnce()}
  try{if(navigator.vibrate&&(!navigator.userActivation||navigator.userActivation.hasBeenActive))navigator.vibrate([200,100,200])}catch(e){}
  try{
    if('Notification' in window&&Notification.permission==='granted'){
      const o={body,requireInteraction:!!opt.alarm,tag:opt.tag||undefined,icon:'icon-192.png'};
      const plain=()=>{const n=new Notification(title,o);n.onclick=()=>{window.focus();n.close()}};
      if(navigator.serviceWorker&&navigator.serviceWorker.getRegistration)navigator.serviceWorker.getRegistration().then(r=>r?r.showNotification(title,o):plain()).catch(plain);
      else plain();
    }
  }catch(e){}
}
function permText(){
  if(!('Notification' in window))return 'المتصفح ده مش بيدعم إشعارات النظام';
  return {granted:'✅ إشعارات النظام مفعّلة',denied:'❌ الإشعارات مقفولة. افتحها من أيقونة القفل جنب اللينك ← الإشعارات ← سماح',default:'🔔 إشعارات النظام لسه مش مفعّلة. دوس "فعّل الإشعارات"'}[Notification.permission]||'';
}
function askPerm(){
  primeAudio();
  if(!('Notification' in window)){toast('المتصفح مش بيدعم الإشعارات');return}
  Notification.requestPermission().then(p=>{toast(p==='granted'?'الإشعارات اشتغلت ✅':'الإشعارات مقفولة');$('s-stat').textContent=permText()});
}
function testNotif(){primeAudio();notify('⏰ تنبيه تجريبي','كده التذكيرات هتوصلك',{alarm:true,tag:'test'})}
function once(key){
  if(S.notified[key])return false;
  if(Object.keys(S.notified).length>400)S.notified={};
  S.notified[key]=1;save();return true;
}
function tick(){
  const now=new Date(),t0=today(),nowHM=pad(now.getHours())+':'+pad(now.getMinutes());
  if(lastDay!==t0){lastDay=t0;render();}
  S.tasks.filter(t=>t.date===t0&&t.status==='pending').forEach(t=>{
    const [h,m]=t.time.split(':').map(Number),at=new Date(now.getFullYear(),now.getMonth(),now.getDate(),h,m),lead=t.far?30:15,diff=(at-now)/60000;
    if(diff<=lead&&diff>-30&&once('t-'+t.id))notify('⏰ '+t.title,diff>1?'بعد '+Math.ceil(diff)+' دقيقة'+(t.far?' (مشوار بعيد)':''):diff>-1?'دلوقتي':'فات ميعادها بـ '+Math.ceil(-diff)+' دقيقة',{alarm:true,taskId:t.id,tag:'t-'+t.id});
  });
  if(nowHM>=S.settings.eve&&!S.tasks.some(t=>t.date===addDays(t0,1))&&once('eve-'+t0)){notify('🌙 سجّل مهام بكرة','خد دقيقة ورتّب يومك');renderTasks()}
  S.budget.needs.forEach(n=>{
    if(!n.day||n.paid)return;
    const dim=new Date(now.getFullYear(),now.getMonth()+1,0).getDate(),due=new Date(now.getFullYear(),now.getMonth(),Math.min(n.day,dim));
    if(Math.round((due-new Date(now.getFullYear(),now.getMonth(),now.getDate()))/864e5)===1&&once('n-'+n.id+'-'+t0))notify('💸 بكرة ميعاد '+n.name,money(n.price));
  });
  S.events.forEach(e=>{
    const o=nextOcc(e),n=daysTo(o);
    if(n>0&&n<=5&&once('e-'+e.id+'-'+fmt(o)))notify('🎂 '+e.name,'بعد '+n+' يوم');
    if(n===0&&once('e0-'+e.id+'-'+fmt(o)))notify('🎉 النهارده: '+e.name,'');
  });
  if(cur==='dash')renderNext();
}

/* ---------- إعدادات ---------- */
function openSettings(){$('s-eve').value=S.settings.eve;$('s-sound').checked=S.settings.sound!==false;$('s-stat').textContent=permText();openM('m-set')}
function saveSettings(){S.settings.eve=$('s-eve').value||'21:00';S.settings.sound=$('s-sound').checked;save();render()}
function resetAll(){if(confirm('تمسح كل البيانات؟')){try{localStorage.removeItem(KEY);localStorage.removeItem(OLD)}catch(e){}load();closeM();render()}}
function demo(){
  if(S.tasks.length&&!confirm('ده هيضيف بيانات تجريبية جنب بياناتك. كمّل؟'))return;
  const t=today(),y=addDays(t,-1),soon=new Date(Date.now()+16*60000);
  S.tasks.push(
    {id:uid(),title:'مهمة تجريبية (تنبيه بعد ~15 دقيقة)',date:fmt(soon),time:pad(soon.getHours())+':'+pad(soon.getMinutes()),far:false,status:'pending'},
    {id:uid(),title:'مشوار للعميل في 6 أكتوبر',date:t,time:'23:00',far:true,status:'pending'},
    {id:uid(),title:'مراجعة كود Flutter',date:t,time:'10:00',far:false,status:'done'},
    {id:uid(),title:'مكالمة الشغل',date:t,time:'12:00',far:false,status:'cancelled'},
    {id:uid(),title:'تمرين',date:t,time:'19:00',far:false,status:'postponed'});
  const pat=[['done','done','done','cancelled'],['done','done','postponed'],['done','cancelled','pending','done','done'],['done','done','done'],['postponed','done','cancelled','done'],['done','done','done','done','postponed']];
  pat.forEach((row,i)=>{const d=addDays(y,-i);row.forEach((st,j)=>S.tasks.push({id:uid(),title:['اجتماع الفريق','سداد فاتورة','مذاكرة BLoC','شراء احتياجات','مراجعة PR'][j%5],date:d,time:pad(9+j*2)+':00',far:false,status:st}))});
  if(!S.budget.salary)S.budget=Object.assign(S.budget,{salary:15000,transport:60,days:22,saveOn:true,savePct:30,needs:[{id:uid(),name:'إيجار',price:3000,day:1,paid:true},{id:uid(),name:'إنترنت',price:300,day:15,paid:false},{id:uid(),name:'كهربا ومياه',price:500,day:20,paid:false}]});
  S.events.push({id:uid(),name:'عيد ميلاد صديق',date:fmt(new Date(2000,new Date().getMonth(),new Date().getDate()+4)),yearly:true});
  save();closeM();render();toast('اتحملت بيانات تجريبية');
}

/* ---------- تشغيل ---------- */
function render(){
  $('hdate').textContent=dlong(today());
  renderTasks();renderDash();renderBudget();renderEvents();
}
ensureDash();ensureBudget();syncFab();render();tick();
setInterval(tick,20000);
document.addEventListener('visibilitychange',()=>{if(!document.hidden)tick()});
if('serviceWorker' in navigator&&/^https?:$/.test(location.protocol))navigator.serviceWorker.register('sw.js').catch(()=>{});
