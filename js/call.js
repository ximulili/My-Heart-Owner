/* call.js — 通话模拟：全屏覆盖层 + 最小化浮块 */
H.call = (function(){
  let state='idle'; // idle|calling|incoming|connected
  let type='voice';
  let timer=null, seconds=0, hangupT=null, callStart=0, incomingTimer=null;
  let dragStartX=0, dragStartY=0;

  const HANGUP_SVG='<svg viewBox="0 0 24 24" class="icon"><path d="M12 9c-1.6 0-3.1.3-4.5.8v3c0 .5-.4 1-1 1H4.5c-.5 0-1-.4-1-1V9.8C5.5 7.8 8.6 6.5 12 6.5s6.5 1.3 8.5 3.3v3c0 .5-.4 1-1 1h-2c-.5 0-1-.4-1-1v-3C15.1 9.3 13.6 9 12 9z" fill="currentColor"/></svg>';

  function fmt(n){ const m=Math.floor(n/60),s=n%60; return (m<10?'0':'')+m+':'+(s<10?'0':'')+s; }
  function delay(ms){ return new Promise(r=>setTimeout(r,ms)); }
  function el(id){ return document.getElementById(id); }

  async function start(t){
    if(state!=='idle') return;
    type=t; state='calling';
    showOverlay('calling');
    await delay(2000+Math.random()*2000);
    if(state!=='calling') return;
    const s=await H.store.getSettings();
    const r=Math.random()*100;
    if(r < s.callAnswerRate){ connect(); }
    else if(r < s.callAnswerRate + s.callBusyRate){ H.chat.appendSystem(`${s.partnerName||'TA'}正在忙，未接听来电`); reset(); }
    else { H.chat.appendSystem(`${s.partnerName||'TA'}拒绝了通话`); reset(); }
  }

  async function incoming(t){
    if(state!=='idle') return;
    type=t; state='incoming';
    showOverlay('incoming');
    incomingTimer=setTimeout(()=>{
      if(state==='incoming'){
        H.store.getSettings().then(s=>H.chat.appendSystem(`📞${s.meName||'我'}未接听${s.partnerName||'TA'}的来电`));
        reset();
      }
    },20000);
  }

  function connect(){
    state='connected'; seconds=0; callStart=Date.now();
    el('callStatusDot').classList.add('connected');
    el('callStatusText').textContent='通话中';
    if(type==='video') el('callVideoPane').hidden=false;
    setActions('connected');
    timer=setInterval(()=>{
      seconds=Math.floor((Date.now()-callStart)/1000);
      el('callTimer').textContent=fmt(seconds);
      if(el('callMiniTimer')) el('callMiniTimer').textContent=fmt(seconds);
    },1000);
    H.store.getSettings().then(s=>{
      if(Math.random()*100 < (s.hangupChance||0)){
        const after=(s.hangupMinSec||15)*1000 + Math.random()*10000;
        hangupT=setTimeout(()=>{
          if(state==='connected'){ H.chat.appendSystem(`${s.partnerName||'TA'} 挂断了通话`); hangup(); }
        }, after);
      }
    });
  }

  function hangup(){
    if(state==='idle') return;
    const cur=Math.floor((Date.now()-callStart)/1000), curType=type;
    clearInterval(timer); timer=null; clearTimeout(hangupT); hangupT=null;
    H.store.getSettings().then(s=>{
      if(state==='connected' && cur>0){
        H.chat.appendSystem(`📞 ${curType==='video'?'视频':'语音'}通话 ${fmt(cur)}`);
      }
      reset();
    });
  }

  function answer(){
    if(state!=='incoming') return;
    clearTimeout(incomingTimer); incomingTimer=null;
    connect();
  }

  function rejectIncoming(){
    if(state!=='incoming') return;
    clearTimeout(incomingTimer); incomingTimer=null;
    reset();
    H.store.getSettings().then(s=>H.chat.appendSystem((s.meName||'我')+'拒绝了通话'));
  }

  function reset(){
    state='idle'; seconds=0; callStart=0;
    clearInterval(timer); timer=null;
    clearTimeout(hangupT); hangupT=null;
    clearTimeout(incomingTimer); incomingTimer=null;
    el('callOverlay').hidden=true;
    el('callOverlay').classList.remove('video-mode');
    el('callStatusDot').classList.remove('connected');
    el('callTimer').textContent='00:00';
    el('callStatusText').textContent='呼叫中...';
    el('callVideoPane').hidden=true;
    el('callMiniBar').hidden=true;
    el('callMiniBar').style.top=''; el('callMiniBar').style.left=''; el('callMiniBar').style.right='12px';
  }

  function showOverlay(st){
    el('callOverlay').hidden=false;
    el('callMiniBar').hidden=true;
    el('callStatusDot').classList.remove('connected');
    el('callTimer').textContent='00:00';
    el('callVideoPane').hidden=true;
    if(type==='video') el('callOverlay').classList.add('video-mode');
    else el('callOverlay').classList.remove('video-mode');
    H.store.getSettings().then(s=>{
      el('callName').textContent=s.partnerName||'TA';
      el('callAvatar').style.backgroundImage=`url('${s.otherAvatar||'assets/default-avatar.svg'}')`;
    });
    el('callStatusText').textContent = st==='calling' ? '呼叫中...' : '来电...';
    setActions(st);
  }

  function setActions(st){
    const box=el('callActions');
    const hangIcon=`<svg viewBox="0 0 24 24" class="icon" style="width:28px;height:28px;transform:rotate(135deg)"><path d="M12 9c-1.6 0-3.1.3-4.5.8v3c0 .5-.4 1-1 1H4.5c-.5 0-1-.4-1-1V9.8C5.5 7.8 8.6 6.5 12 6.5s6.5 1.3 8.5 3.3v3c0 .5-.4 1-1 1h-2c-.5 0-1-.4-1-1v-3C15.1 9.3 13.6 9 12 9z" fill="currentColor"/></svg>`;
    const acceptIcon=`<svg viewBox="0 0 24 24" class="icon" style="width:28px;height:28px"><path d="M20.01 15.38c-1.23 0-2.42-.2-3.53-.56a.977.977 0 0 0-1.01.24l-1.57 1.97c-2.83-1.35-5.48-3.9-6.89-6.83l1.95-1.66c.27-.28.35-.67.24-1.02-.37-1.11-.56-2.3-.56-3.53 0-.54-.45-.99-.99-.99H4.19C3.65 3 3 3.24 3 3.99 3 13.28 10.73 21 20.01 21c.71 0 .99-.63.99-1.18v-3.45c0-.54-.45-.99-.99-.99z" fill="currentColor"/></svg>`;
    if(st==='incoming'){
      box.innerHTML=`
        <div class="call-action-wrap"><button class="call-action-btn accept" id="callAnswerBtn">${acceptIcon}</button><span class="call-action-label">接听</span></div>
        <div class="call-action-wrap"><button class="call-action-btn mini" id="callMiniBtn">⬇️</button><span class="call-action-label">缩小</span></div>
        <div class="call-action-wrap"><button class="call-action-btn reject" id="callRejectBtn">${hangIcon}</button><span class="call-action-label">拒接</span></div>`;
      el('callAnswerBtn').onclick=answer;
      el('callRejectBtn').onclick=rejectIncoming;
    } else {
      box.innerHTML=`
        <div class="call-action-wrap"><button class="call-action-btn mini" id="callMiniBtn">⬇️</button><span class="call-action-label">缩小</span></div>
        <div class="call-action-wrap"><button class="call-action-btn reject" id="callHangupBtn">${hangIcon}</button><span class="call-action-label">挂断</span></div>`;
      el('callHangupBtn').onclick=hangup;
    }
    const miniBtn=el('callMiniBtn');
    if(miniBtn) miniBtn.onclick=minimize;
  }

  function minimize(){
    el('callOverlay').hidden=true;
    el('callMiniBar').hidden=false;
    el('callMiniTimer').textContent=fmt(seconds);
    H.store.getSettings().then(s=>{
      el('callMiniName').textContent=s.partnerName||'TA';
      el('callMiniAvatar').style.backgroundImage=`url('${s.otherAvatar||'assets/default-avatar.svg'}')`;
    });
  }

  function restore(){
    el('callMiniBar').hidden=true;
    el('callOverlay').hidden=false;
  }

  function initDrag(){
    const bar=el('callMiniBar');
    if(!bar) return;
    let dx,dy,dragging=false;
    bar.addEventListener('pointerdown',(e)=>{
      if(e.target.closest('#callMiniHangup')) return;
      dragging=true; dragStartX=e.clientX; dragStartY=e.clientY;
      dx=e.clientX-bar.offsetLeft; dy=e.clientY-bar.offsetTop;
      bar.setPointerCapture(e.pointerId);
    });
    bar.addEventListener('pointermove',(e)=>{
      if(dragging){
        bar.style.left=(e.clientX-dx)+'px';
        bar.style.top=(e.clientY-dy)+'px';
        bar.style.right='auto';
      }
    });
    bar.addEventListener('pointerup',()=>dragging=false);
    bar.addEventListener('click',(e)=>{
      if(e.target.closest('#callMiniHangup')) return;
      if(Math.abs(e.clientX-dragStartX)<5 && Math.abs(e.clientY-dragStartY)<5) restore();
    });
    el('callMiniHangup').onclick=hangup;
  }

  return { start, incoming, hangup, answer, initDrag, get state(){return state;} };
})();
