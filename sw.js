/* sw.js — Heart PWA Service Worker：后台定时生成消息 + 系统通知 */
const DB_NAME='Heart';
const STORE='keyValuePairs';
function openDB(){return new Promise((r,j)=>{const req=indexedDB.open(DB_NAME);req.onsuccess=()=>r(req.result);req.onerror=()=>j(req.error);req.onupgradeneeded=()=>{}})}
async function getVal(k){const db=await openDB();return new Promise((r,j)=>{const tx=db.transaction(STORE,'readonly');const req=tx.objectStore(STORE).get('heart_'+k);req.onsuccess=()=>{r(req.result??null)};req.onerror=()=>j(req.error)})}
async function setVal(k,v){const db=await openDB();return new Promise((r,j)=>{const tx=db.transaction(STORE,'readwrite');tx.objectStore(STORE).put(v,'heart_'+k);tx.oncomplete=()=>r();tx.onerror=()=>j(tx.error)})}

let msgTimer=null;

function pick(arr){return arr[Math.floor(Math.random()*arr.length)]}
function uid(){return Date.now().toString(36)+Math.random().toString(36).slice(2,7)}

async function checkAndNotify(){
  const s=await getVal('settings')||{};
  const now=Date.now();
  const lastCheck=parseInt(await getVal('_bg_last_check')||'0');
  if(now-lastCheck<20000) return;
  const min=(s.activeMsgMin||5)*60000, max=(s.activeMsgMax||30)*60000;
  if(now-lastCheck < min) return;
  const shouldMsg = now-lastCheck >= min+Math.random()*(max-min);
  if(!shouldMsg) return;
  const cards=await getVal('cards')||[];
  const groups=await getVal('groups')||[];
  const disabledGroups=new Set((groups||[]).filter(g=>g.disabled).map(g=>g.id));
  const pool=cards.filter(c=>!c.disabled&&!disabledGroups.has(c.groupId));
  if(!pool.length) return;
  const cardN=Math.min(1+Math.floor(Math.random()*3),pool.length);
  const text=Array.from({length:cardN},()=>pick(pool).text).join(' ');
  const msg={id:uid(),sender:'other',senderName:s.partnerName||'TA',type:'text',text,quote:null,ts:now};
  const msgs=await getVal('messages')||[];
  msgs.push(msg);
  await setVal('messages',msgs);
  await setVal('_bg_last_check',now);
  self.registration.showNotification(s.partnerName||'TA',{body:text,icon:'assets/default-avatar.svg'});
}

function scheduleMsg(){const s=getVal('settings');const mx=s.activeMsgMax?Math.max(s.activeMsgMax*60000,60000):60000;msgTimer=setInterval(checkAndNotify,60000)}

self.addEventListener('install',()=>self.skipWaiting());
self.addEventListener('activate',e=>e.waitUntil(self.clients.claim()));
self.addEventListener('message',(e)=>{if(e.data==='startMsg'){if(!msgTimer) scheduleMsg()}});

// 首次启��也启动调度
setTimeout(()=>{scheduleMsg();self.clients.matchAll().then(clients=>clients.forEach(c=>c.postMessage('swReady')))},3000);
