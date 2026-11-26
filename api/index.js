const c=require('crypto'),U=process.env.SUPABASE_URL+'/rest/v1/',K=process.env.SUPABASE_SERVICE_KEY,S=process.env.SECRET||'dev';
const db=async(m,t,q='',b)=>{const r=await fetch(U+t+q,{method:m,headers:{apikey:K,...(K.startsWith('eyJ')?{Authorization:'Bearer '+K}:{}),'Content-Type':'application/json',Prefer:'return=representation'},body:b?JSON.stringify(b):undefined}),x=await r.text();if(!r.ok)throw Error(x);return x?JSON.parse(x):[]};
const sg=s=>c.createHmac('sha256',S).update(s).digest('hex');
const mk=id=>{const p=id+'.'+(Date.now()+6048e5);return p+'.'+sg(p)};
const ck=t=>{const[a,b,x]=String(t||'').split('.');return x&&sg(a+'.'+b)===x&&+b>Date.now()?a:null};
const hs=(p,s=c.randomBytes(16).toString('hex'))=>s+':'+c.scryptSync(p,s,32).toString('hex');
const same=(p,h)=>{const e=hs(p,h.split(':')[0]);return e.length===h.length&&c.timingSafeEqual(Buffer.from(e),Buffer.from(h))};
const E=encodeURIComponent,str=(v,n)=>String(v??'').trim().slice(0,n);
module.exports=async(req,res)=>{try{res.json(await run(req.body||{}))}catch(e){console.error('API',e.message);res.status(500).json({err:'server',why:String(e.message).slice(0,200)})}};
async function run({a,t,...d}){
if(a==='tip'){const r=await db('GET','tips','?active=eq.true&lang=eq.'+(d.lang==='en'?'en':'fr'));return{tip:r[Math.random()*r.length|0]||null}}
if(a==='signup'||a==='login'){const p=str(d.pseudo,20),pw=String(d.pass||'');
 if(a==='signup'){if(!/^[\w.-]{3,20}$/.test(p)||pw.length<6)return{err:'invalid'};
  if((await db('GET','users','?pseudo=eq.'+E(p)))[0])return{err:'taken'};
  const u=(await db('POST','users','',{pseudo:p,pass:hs(pw),lang:d.lang==='en'?'en':'fr',role:p===process.env.OPERATOR_PSEUDO?'op':'player'}))[0];return{t:mk(u.id)}}
 const u=(await db('GET','users','?pseudo=eq.'+E(p)))[0];return u&&same(pw,u.pass)?{t:mk(u.id)}:{err:'bad'}}
const id=ck(t),u=id&&(await db('GET','users','?id=eq.'+E(id)))[0];if(!u)return{err:'auth'};
const set=Object.fromEntries((await db('GET','settings')).map(r=>[r.k,r.v])),op=u.role==='op';
if(!op){if(u.banned_until&&new Date(u.banned_until)>new Date())return{banned:{until:u.banned_until,reason:u.ban_reason}};if(set.maintenance==='1')return{maint:1}}
if(a==='home'){const s=await db('GET','sites','?order=created_at');return{me:{pseudo:u.pseudo,lang:u.lang,role:u.role},set,sites:s.map(({url,...x})=>x),scores:await db('GET','scores')}}
if(a==='lang'){await db('PATCH','users','?id=eq.'+u.id,{lang:d.lang==='en'?'en':'fr'});return{ok:1}}
if(a==='played'){await db('PATCH','users','?id=eq.'+u.id,{last_game:str(d.g,40)});return{ok:1}}
if(a==='click'){const s=(await db('GET','sites','?id=eq.'+E(d.id)))[0];if(!s||!s.available)return{err:'off'};let w=false;
 try{const r=await fetch(s.url,{method:'HEAD',redirect:'follow',signal:AbortSignal.timeout(4000)});w=r.status<400||r.status===405}catch{}
 await db('POST','clicks','',{site_id:s.id,pseudo:u.pseudo,ok:w});return{url:s.url}}
if(a==='bug'){if(set.demo!=='1')return{err:'nodemo'};const m=str(d.msg,500);if(!m)return{err:'empty'};await db('POST','bugs','',{pseudo:u.pseudo,game:str(d.game,40),msg:m});return{ok:1}}
if(a==='score'){const s=Math.floor(+d.score),g=str(d.game,30);if(!(s>=0)||!g)return{err:'bad'};const r=(await db('GET','scores','?game=eq.'+E(g)))[0];
 if(!r)await db('POST','scores','',{game:g,pseudo:u.pseudo,score:s});else if(s>r.score)await db('PATCH','scores','?game=eq.'+E(g),{pseudo:u.pseudo,score:s});return{ok:1}}
if(!op)return{err:'forbidden'};
const q=E(d.id||''),M={
op:async()=>({set,sites:await db('GET','sites','?order=created_at'),tips:await db('GET','tips'),users:await db('GET','users','?select=id,pseudo,lang,role,last_game,banned_until&order=created_at.desc'),bugs:await db('GET','bugs','?order=at.desc&limit=50'),clicks:await db('GET','clicks','?select=*,sites(name)&order=at.desc&limit=30')}),
setting:()=>['maintenance','demo'].includes(d.k)&&db('PATCH','settings','?k=eq.'+d.k,{v:d.v?'1':'0'}),
site_add:()=>/^https?:\/\//.test(d.url)&&db('POST','sites','',{name:str(d.name,60),url:str(d.url,500),descr:str(d.descr,200),kind:d.kind==='page'?'page':'site'}),
site_toggle:async()=>{const s=(await db('GET','sites','?id=eq.'+q))[0];if(s)await db('PATCH','sites','?id=eq.'+q,{available:!s.available})},
site_del:()=>db('DELETE','sites','?id=eq.'+q),
tip_add:()=>db('POST','tips','',{lang:d.lang==='en'?'en':'fr',title:str(d.title,80),body:str(d.body,600),code:str(d.code,800)}),
tip_toggle:async()=>{const s=(await db('GET','tips','?id=eq.'+q))[0];if(s)await db('PATCH','tips','?id=eq.'+q,{active:!s.active})},
tip_del:()=>db('DELETE','tips','?id=eq.'+q),
ban:()=>db('PATCH','users','?role=neq.op&id=eq.'+q,{banned_until:new Date(Date.now()+(+d.h||1)*36e5).toISOString(),ban_reason:str(d.reason,200)}),
unban:()=>db('PATCH','users','?id=eq.'+q,{banned_until:null,ban_reason:null}),
bug_del:()=>db('DELETE','bugs','?id=eq.'+q)};
if(!M[a])return{err:'?'};const r=await M[a]();return a==='op'?r:{ok:1}}
