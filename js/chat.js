/* chat.js — 消息渲染/已读状态机/对方回复/引用 */
H.chat = (function(){
  let messages = [];
  let replyTarget = null;
  const pendingReads = new Map(); // msgId -> {ts, timer}
  let pendingReply = null; // {s, timer, fireAt}

  async function load(){ messages = await H.store.getMessages(); }
  async function save(){ await H.store.saveMessages(messages); }

  function now(){ return Date.now(); }
  function dateStr(ts){ const d=new Date(ts); return d.getFullYear()+'-'+p(d.getMonth()+1)+'-'+p(d.getDate()); }
  function timeStr(ts){ const d=new Date(ts); return p(d.getHours())+':'+p(d.getMinutes()); }
  function p(n){ return n<10?'0'+n:n; }
  function esc(s){ return String(s).replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;'); }

  async function render(){
    const s = await H.store.getSettings();
    const box = document.getElementById('chatContainer');
    box.innerHTML='';
    if(!messages.length){ box.innerHTML='<div class="empty-hint">还没有消息，发点什么吧</div>'; return; }
    let lastDate='', lastSender='';
    for(const m of messages){
      const d=dateStr(m.ts);
      if(d!==lastDate){ box.insertAdjacentHTML('beforeend',`<div class="date-divider">${d}</div>`); lastDate=d; lastSender=''; }
      if(m.sender==='system'){ box.insertAdjacentHTML('beforeend',`<div class="message-wrapper system"><div class="system-message">${esc(m.text)}</div></div>`); lastSender='system'; continue; }
      const hideAv = m.sender===lastSender;
      box.insertAdjacentHTML('beforeend', msgHtml(m, s, hideAv));
      lastSender=m.sender;
    }
    scrollToBottom();
    bindMsgEvents();
  }

  function msgHtml(m, s, hideAv){
    const av = m.sender==='me'
      ? `<div class="message-avatar ${hideAv?'hidden':''}" style="background-image:url('${s.meAvatar||'assets/default-avatar.svg'}')"></div>`
      : `<div class="message-avatar ${hideAv?'hidden':''}" style="background-image:url('${s.otherAvatar||'assets/default-avatar.svg'}')"></div>`;
    let inner='';
    if(m.quote){ inner += `<div class="reply-quote">${esc(m.quote.sender)}：${esc(m.quote.text)}</div>`; }
    if(m.type==='text'||m.type==='sticker-emoji'){ inner += `<span>${esc(m.text)}</span>`; }
    else if(m.type==='image'||m.type==='sticker-img'){ inner += `<img class="message-img" src="${m.dataUrl}" data-full="${m.dataUrl}">`; }
    else if(m.type==='voice'){ inner += voiceHtml(m); }
    const readTag = m.sender==='me' ? ` · <span class="message-read ${m.read||'sent'}">${readLabel(m.read)}</span>` : '';
    const dir = m.sender==='me'?'sent':'received';
    return `<div class="message-wrapper ${dir}" data-id="${m.id}">
      ${av}
      <div class="message-bubble-wrap">
        <div class="message">${inner}</div>
        <div class="message-meta">${timeStr(m.ts)}${readTag}</div>
      </div>
    </div>`;
  }
  function readLabel(r){ return r==='read'?'已读':r==='noreply'?'已读不回':'已送达'; }
  function voiceHtml(m){
    let bars=''; for(let i=0;i<10;i++){ const h=4+Math.round(Math.random()*12); bars+=`<i style="height:${h}px"></i>`; }
    return `<div class="message-voice" data-voice="${m.dataUrl}"><div class="voice-wave">${bars}</div><span class="voice-dur">${m.dur||0}"</span></div>`;
  }

  function bindMsgEvents(){
    document.querySelectorAll('.message-wrapper.received .message-avatar').forEach(av=>av.onclick=()=>H.poke.openPanel('other'));
    document.querySelectorAll('.message-wrapper.sent .message-avatar').forEach(av=>av.onclick=()=>H.poke.openPanel('me'));
    document.querySelectorAll('.message-img').forEach(img=>img.onclick=()=>H.ui.previewImg(img.dataset.full));
    document.querySelectorAll('[data-voice]').forEach(v=>v.onclick=()=>H.voice.play(v.dataset.voice));
    // 长按/点击我方消息：回复或删除
    document.querySelectorAll('.message-wrapper').forEach(w=>{
      let pressT;
      w.addEventListener('pointerdown',()=>{
        pressT=setTimeout(()=>showMsgActions(w.dataset.id),500);
      });
      w.addEventListener('pointerup',()=>clearTimeout(pressT));
      w.addEventListener('pointerleave',()=>clearTimeout(pressT));
    });
  }
  function showMsgActions(id){
    const m = messages.find(x=>x.id===id);
    if(!m||m.sender==='system') return;
    const actions = [
      {label:'回复', fn:()=>setReply(m)},
      {label:'删除', danger:true, fn:async()=>{
        messages = messages.filter(x=>x.id!==id);
        await save(); render();
      }}
    ];
    // 我发的消息才有撤回功能
    if(m.sender==='me'){
      actions.push({label:'撤回', danger:true, fn:async()=>{
        const s = await H.store.getSettings();
        const name = s.meName || '我';
        messages = messages.filter(x=>x.id!==id);
        messages.push({ id:H.store.uid(), sender:'system', type:'system', text:`${name}撤回了一条消息`, ts:now() });
        await save(); render();
      }});
    }
    H.ui.actionSheet(actions);
  }

  function setReply(m){ replyTarget=m; const box=document.getElementById('replyPreview'); document.getElementById('replyName').textContent=(m.sender==='me'?'我':m.senderName||'TA'); document.getElementById('replyText').textContent=(m.text||'[图片/语音]'); box.hidden=false; }
  function clearReply(){ replyTarget=null; document.getElementById('replyPreview').hidden=true; }

  function scrollToBottom(){ const a=document.getElementById('chatArea'); a.scrollTop=a.scrollHeight; }

  // ---- 发送 ----
  async function sendText(text){
    text=(text||'').trim(); if(!text) return;
    const m={ id:H.store.uid(), sender:'me', type:'text', text, quote:replyTarget?{sender:replyTarget.sender==='me'?'我':(replyTarget.senderName||'TA'), text:replyTarget.text||'[非文字]'}:null, ts:now(), read:'sent' };
    messages.push(m); await save(); clearReply(); render();
    startReadMachine(m.id);
  }
  async function sendImage(dataUrl){
    const m={ id:H.store.uid(), sender:'me', type:'image', dataUrl, text:'', quote:null, ts:now(), read:'sent' };
    messages.push(m); await save(); render(); startReadMachine(m.id);
  }
  async function sendVoice(dataUrl, dur){
    const m={ id:H.store.uid(), sender:'me', type:'voice', dataUrl, dur, text:'', quote:null, ts:now(), read:'sent' };
    messages.push(m); await save(); render(); startReadMachine(m.id);
  }
  async function sendStickerEmoji(emoji){
    const m={ id:H.store.uid(), sender:'me', type:'sticker-emoji', text:emoji, quote:null, ts:now(), read:'sent' };
    messages.push(m); await save(); render(); startReadMachine(m.id);
  }
  async function sendStickerImg(dataUrl){
    const m={ id:H.store.uid(), sender:'me', type:'sticker-img', dataUrl, text:'', quote:null, ts:now(), read:'sent' };
    messages.push(m); await save(); render(); startReadMachine(m.id);
  }
  async function appendSystem(text){
    messages.push({ id:H.store.uid(), sender:'system', type:'system', text, ts:now() });
    await save(); render();
  }

  // ---- 已读状态机（后台安全） ----
  function startReadMachine(msgId){
    H.store.getSettings().then(s=>{
      const delay = s.readDelayMin + Math.random()*(s.readDelayMax - s.readDelayMin);
      const fireAt = Date.now() + delay;
      const timer = setTimeout(()=>{ pendingReads.delete(msgId); processRead(msgId, s); }, delay);
      pendingReads.set(msgId, {ts:Date.now(), delay, fireAt, s, timer});
    });
  }

  async function processRead(msgId, s){
    const m = messages.find(x=>x.id===msgId);
    if(!m) return;
    const noReply = Math.random()*100 < (s.noReplyChance||0);
    if(noReply){
      m.read='noreply'; await save(); render();
    } else {
      m.read='read'; await save(); render();
      triggerReply(s);
    }
  }

  // 页面切回前台时，立即处理到期的已读和回复
  function processPending(){
    const now = Date.now();
    for(const [msgId, info] of pendingReads){
      if(now >= info.fireAt){
        clearTimeout(info.timer);
        pendingReads.delete(msgId);
        processRead(msgId, info.s);
      }
    }
    if(pendingReply && now >= pendingReply.fireAt){
      clearTimeout(pendingReply.timer);
      const s = pendingReply.s;
      pendingReply = null;
      fireReply(s);
    }
  }

  async function triggerReply(s){
    s = s || await H.store.getSettings();
    const tMin = Number(s.typingMin)||1, tMax = Number(s.typingMax)||3;
    const delay = (tMin + Math.random()*(tMax - tMin))*1000;
    const el = document.getElementById('typingHint');
    if(el){
      const nameEl = el.querySelector('.typing-name');
      if(nameEl) nameEl.textContent = (s.partnerName||'TA');
      el.hidden = false;
    }
    const fireAt = Date.now() + delay;
    const timer = setTimeout(()=>{ pendingReply=null; fireReply(s); }, delay);
    pendingReply = {s, timer, fireAt};
  }

  async function fireReply(s){
    const el = document.getElementById('typingHint');
    if(el) el.hidden = true;
    const tMin = Number(s.typingMin)||1, tMax = Number(s.typingMax)||3;
    try {
      const msgs = await H.cards.generateReply();
      for(let i=0;i<msgs.length;i++){
        // 根据概率决定是否发表情包图片
        const imgChance = s.replyStickerImgChance || 20;
        if(Math.random()*100 < imgChance){
          const img = await H.sticker.randomAttachImg('other');
          if(img){
            const msg={ id:H.store.uid(), sender:'other', senderName:s.partnerName||'白厄', type:'sticker-img', dataUrl:img, text:'', quote:null, ts:now() };
            messages.push(msg);
            await save(); render();
            H.app.playNotifySound(s.partnerName||'TA', '[表情包]');
            if(i<msgs.length-1){
              const gap=(tMin + Math.random()*(tMax - tMin))*1000;
              await new Promise(r=>setTimeout(r,gap));
            }
            continue;
          }
        }
        // 否则发送文字消息
        const msg={ id:H.store.uid(), sender:'other', senderName:s.partnerName||'白厄', type:'text', text:msgs[i], quote:null, ts:now() };
        messages.push(msg);
        await save(); render();

        // 触发通知（使用新的通知函数）
        H.app.playNotifySound(s.partnerName||'TA', msgs[i]);

        if(i<msgs.length-1){
          const gap=(tMin + Math.random()*(tMax - tMin))*1000;
          await new Promise(r=>setTimeout(r,gap));
        }
      }
    } catch(e){ console.error('fireReply:',e); }
  }

  return {
    load, render, save,
    sendText, sendImage, sendVoice, sendStickerEmoji, sendStickerImg, appendSystem,
    setReply, clearReply, scrollToBottom, triggerReply,
    get messages(){return messages;}, get replyTarget(){return replyTarget;}
  };
})();
