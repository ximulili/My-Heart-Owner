/* sw.js — Heart PWA Service Worker：后台消息生成 + 系统通知 */
const DB_NAME='Heart';
const STORE='keyValuePairs';
function openDB(){return new Promise((r,j)=>{const req=indexedDB.open(DB_NAME);req.onsuccess=()=>r(req.result);req.onerror=()=>j(req.error);req.onupgradeneeded=()=>{}})}
async function getVal(k){const db=await openDB();return new Promise((r,j)=>{const tx=db.transaction(STORE,'readonly');const req=tx.objectStore(STORE).get('heart_'+k);req.onsuccess=()=>{r(req.result??null)};req.onerror=()=>j(req.error)})}
async function setVal(k,v){const db=await openDB();return new Promise((r,j)=>{const tx=db.transaction(STORE,'readwrite');tx.objectStore(STORE).put(v,'heart_'+k);tx.oncomplete=()=>r();tx.onerror=()=>j(tx.error)})}

let bgTimer=null;
let bgActive=false;

function pick(arr){return arr[Math.floor(Math.random()*arr.length)]}
function uid(){return Date.now().toString(36)+Math.random().toString(36).slice(2,7)}

async function checkAndGenerate(){
  const s=await getVal('settings')||{};
  const cards=await getVal('cards')||[];
  const groups=await getVal('groups')||[];
  const disabledGroups=new Set((groups||[]).filter(g=>g.disabled).map(g=>g.id));
  const pool=cards.filter(c=>!c.disabled&&!disabledGroups.has(c.groupId));
  if(!pool.length) return null;
  const burst=Math.min(1+Math.floor(Math.random()*(s.burstMax||3)), s.burstCap||10);
  const texts=[];
  for(let i=0;i<burst;i++){
    const cardN=Math.min(1+Math.floor(Math.random()*(s.cardMax||3)), s.cardCap||10, pool.length);
    const picks=[];
    const copy=[...pool];
    for(let j=0;j<cardN&&copy.length;j++){const idx=Math.floor(Math.random()*copy.length);picks.push(copy.splice(idx,1)[0]);}
    texts.push(picks.map(p=>p.text).join(' '));
  }
  return {texts, partnerName:s.partnerName||'TA'};
}

async function generateAndStore(){
  const result=await checkAndGenerate();
  if(!result) return;
  const now=Date.now();
  const msgs=await getVal('messages')||[];
  const newMsgs=result.texts.map(text=>({id:uid(),sender:'other',senderName:result.partnerName,type:'text',text,quote:null,ts:now}));
  msgs.push(...newMsgs);
  await setVal('messages',msgs);
  // 通知所有客户端
  const clients=await self.clients.matchAll();
  if(clients.length){
    clients.forEach(c=>c.postMessage({type:'sw:newMessages',messages:newMsgs}));
  } else {
    // 无客户端活跃，弹通知
    const body=result.texts.join(' ');
    self.registration.showNotification(result.partnerName,{body,icon:'assets/icon-192x192.png',tag:'heart-msg'});
  }
}

function startBgSchedule(){
  if(bgActive) return;
  bgActive=true;
  const check=async()=>{
    if(!bgActive) return;
    const s=await getVal('settings')||{};
    const min=(s.activeMsgMin||5)*60000;
    const max=(s.activeMsgMax||30)*60000;
    const lastCheck=parseInt(await getVal('_bg_last')||'0');
    const now=Date.now();
    const elapsed=now-lastCheck;
    if(elapsed>=min){
      const shouldMsg = elapsed >= min + Math.random()*(max-min);
      if(shouldMsg){
        await generateAndStore();
        await setVal('_bg_last',now);
      }
    }
  };
  check();
  bgTimer=setInterval(check,30000);
}

function stopBgSchedule(){
  bgActive=false;
  if(bgTimer){clearInterval(bgTimer);bgTimer=null;}
}

self.addEventListener('install',()=>self.skipWaiting());
self.addEventListener('activate',e=>e.waitUntil(self.clients.claim()));
self.addEventListener('message',async(e)=>{
  if(e.data==='startBg') startBgSchedule();
  else if(e.data==='stopBg') stopBgSchedule();
});
