/* sw.js — Heart PWA Service Worker：系统通知 + 定期唤醒 */
const DB_NAME='Heart';
const STORE='keyValuePairs';
function openDB(){return new Promise((r,j)=>{const req=indexedDB.open(DB_NAME);req.onsuccess=()=>r(req.result);req.onerror=()=>j(req.error);req.onupgradeneeded=()=>{}})}
async function getVal(k){const db=await openDB();return new Promise((r,j)=>{const tx=db.transaction(STORE,'readonly');const req=tx.objectStore(STORE).get('heart_'+k);req.onsuccess=()=>{r(req.result??null)};req.onerror=()=>j(req.error)})}

self.addEventListener('install',()=>self.skipWaiting());
self.addEventListener('activate',e=>{
  e.waitUntil(self.clients.claim());
});

// 定期唤醒 SW（防止被浏览器杀死）
self.addEventListener('periodicsync',e=>{
  if(e.tag==='heart-bg-sync'){
    // 通知客户端检查新消息
    self.clients.matchAll().then(clients=>{
      clients.forEach(c=>c.postMessage({type:'sw:checkMessages'}));
    });
  }
});

// 接收客户端消息
self.addEventListener('message',e=>{
  if(e.data==='startBg'){
    // 启动后台调度（通知客户端）
    self.clients.matchAll().then(clients=>{
      clients.forEach(c=>c.postMessage({type:'sw:startBg'}));
    });
  } else if(e.data==='stopBg'){
    // 停止后台调度（通知客户端）
    self.clients.matchAll().then(clients=>{
      clients.forEach(c=>c.postMessage({type:'sw:stopBg'}));
    });
  }
});
