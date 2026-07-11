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

async function generateAndStore(){
  const s=await getVal('settings')||{};
  const cards=await getVal('cards')||[];
  const groups=await getVal('groups')||[];
  const disabledGroups=new Set((groups||[]).filter(g=>g.disabled).map(g=>g.id));
  const pool=cards.filter(c=>!c.disabled&&!disabledGroups.has(c.groupId));
  if(!pool.length) return false;

  // 生成消息
  const burst=Math.min(1+Math.floor(Math.random()*(s.burstMax||3)), s.burstCap||10);
  const texts=[];
  for(let i=0;i<burst;i++){
    const cardN=Math.min(1+Math.floor(Math.random()*(s.cardMax||3)), s.cardCap||10, pool.length);
    const picks=[];
    const copy=[...pool];
    for(let j=0;j<cardN&&copy.length;j++){const idx=Math.floor(Math.random()*copy.length);picks.push(copy.splice(idx,1)[0]);}
    texts.push(picks.map(p=>p.text).join(' '));
  }

  // 写入存储
  const now=Date.now();
  const msgs=await getVal('messages')||[];
  const newMsgs=texts.map((text,i)=>({
    id:uid()+i,
    sender:'other',
    senderName:s.partnerName||'TA',
    type:'text',
    text,
    quote:null,
    ts:now+i // 每条消息间隔1ms确保顺序
  }));
  msgs.push(...newMsgs);
  await setVal('messages',msgs);

  // 弹通知
  const body=texts.join(' ');
  try{
    await self.registration.showNotification(s.partnerName||'TA',{
      body,
      icon:'assets/icon-192x192.png',
      tag:'heart-msg',
      renotify:true
    });
  }catch(e){}

  // 通知活跃客户端
  const clients=await self.clients.matchAll();
  clients.forEach(c=>c.postMessage({type:'sw:newMessages',count:newMsgs.length}));

  return true;
}

function startBgSchedule(){
  if(bgActive) return;
  bgActive=true;
  const check=async()=>{
    if(!bgActive) return;
    try{
      const s=await getVal('settings')||{};
      const min=(s.activeMsgMin||5)*60000;
      const max=(s.activeMsgMax||30)*60000;
      const nextCheck=parseInt(await getVal('_bg_next')||'0');
      const now=Date.now();
      if(now>=nextCheck){
        await generateAndStore();
        // 计算下次发送时间
        const delay=min+Math.random()*(max-min);
        await setVal('_bg_next',now+delay);
      }
    }catch(e){}
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
